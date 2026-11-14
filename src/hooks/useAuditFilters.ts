import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  DocumentData,
  getCountFromServer,
  getDocs,
  limit,
  query,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import type { ActivityLog } from '../types';
import {
  AUDIT_PAGE_SIZE,
  AuditFiltersState,
  AuditSheetFilters,
  buildAuditFirestoreConstraints,
  buildAuditQueryPlan,
  countActiveSheetFilters,
  DEFAULT_AUDIT_FILTERS,
  DEFAULT_SHEET_FILTERS,
  formatActiveSheetSummary,
  matchesAuditClientFilters,
  parseAuditFiltersFromSearch,
  serializeAuditFiltersToSearch,
  validateCustomDateRange,
} from '../lib/auditQueryBuilder';

export interface AuditLogUserOption {
  userId: string;
  label: string;
}

const PREVIEW_CAP = 200;
const FALLBACK_PAGE_SIZE = 80;
const AUTO_ADVANCE_MAX_PAGES = 2;

function isMissingIndexError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  return (
    e.code === 'failed-precondition' ||
    String(e.message || '').toLowerCase().includes('requires an index')
  );
}

export function useAuditFilters(isAdmin: boolean) {
  const location = useLocation();
  const navigate = useNavigate();

  // Source of truth derived from URL query string
  const appliedFilters = useMemo(
    () => parseAuditFiltersFromSearch(location.search),
    [location.search]
  );

  // Immediate search input bound to the input box, debounced 300ms to URL
  const [searchInput, setSearchInput] = useState<string>(appliedFilters.search);
  const debounceTimerRef = useRef<number | null>(null);

  // Keep search input synchronized on browser Back / Forward / Clear
  useEffect(() => {
    setSearchInput(appliedFilters.search);
  }, [appliedFilters.search]);

  // Filter Sheet draft state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<AuditSheetFilters>({
    types: appliedFilters.types,
    range: appliedFilters.range,
    from: appliedFilters.from,
    to: appliedFilters.to,
    userId: appliedFilters.userId,
  });

  // Fetched logs + pagination + status
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const usingFallbackIndexModeRef = useRef(false);
  const fetchGenerationRef = useRef(0);

  // Known users collected from logs so dropdown remains populated across filters
  const [userMap, setUserMap] = useState<Map<string, string>>(() => new Map());

  // Pending count inside the filter sheet
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [pendingCountCapped, setPendingCountCapped] = useState(false);
  const [loadingPendingCount, setLoadingPendingCount] = useState(false);
  const pendingTimerRef = useRef<number | null>(null);

  const updateUrlFilters = useCallback(
    (nextFilters: AuditFiltersState, options: { replace?: boolean } = {}) => {
      const nextSearch = serializeAuditFiltersToSearch(nextFilters, location.search);
      if (nextSearch === location.search) return;
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch,
          hash: location.hash,
        },
        { replace: options.replace ?? false }
      );
    },
    [location.hash, location.pathname, location.search, navigate]
  );

  const recordObservedUsers = useCallback((items: ActivityLog[]) => {
    if (items.length === 0) return;
    setUserMap((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const item of items) {
        const uid = (item.userId || '').trim();
        if (!uid) continue;
        const label = (item.user || item.userName || '').trim() || uid;
        if (!next.has(uid) || (next.get(uid) === uid && label !== uid)) {
          next.set(uid, label);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const queryPlan = useMemo(
    () => buildAuditQueryPlan(appliedFilters),
    [appliedFilters]
  );

  // Fetch first page whenever applied Firestore-level filters change (or on refresh)
  const fetchLogs = useCallback(async () => {
    if (!isAdmin) {
      setLogs([]);
      setHasMoreLogs(false);
      setLogsError(null);
      setLoadingLogs(false);
      return;
    }

    const gen = ++fetchGenerationRef.current;
    setLoadingLogs(true);
    setLogsError(null);
    lastDocRef.current = null;
    usingFallbackIndexModeRef.current = false;

    const executeQuery = async (
      cursor: QueryDocumentSnapshot<DocumentData> | null,
      fallbackMode: boolean
    ) => {
      const pageSize = fallbackMode ? FALLBACK_PAGE_SIZE : AUDIT_PAGE_SIZE;
      const constraints = buildAuditFirestoreConstraints(queryPlan, {
        pageSize,
        cursor,
        baseOrderOnly: fallbackMode,
      });
      return getDocs(query(collection(db, 'activityLogs'), ...constraints));
    };

    try {
      let fallbackMode = false;
      let snap;
      try {
        snap = await executeQuery(null, false);
      } catch (err) {
        if (isMissingIndexError(err)) {
          console.warn(
            'Firestore composite index missing for audit query; falling back to client-side filtering.',
            err
          );
          fallbackMode = true;
          usingFallbackIndexModeRef.current = true;
          snap = await executeQuery(null, true);
        } else {
          throw err;
        }
      }

      if (gen !== fetchGenerationRef.current) return;

      const pageLimit = fallbackMode ? FALLBACK_PAGE_SIZE : AUDIT_PAGE_SIZE;
      let cursor =
        snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
      let serverHasMore = snap.docs.length === pageLimit;

      const accumulatedDocs: ActivityLog[] = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as ActivityLog
      );
      recordObservedUsers(accumulatedDocs);

      let matched = accumulatedDocs.filter((item) =>
        matchesAuditClientFilters(item, appliedFilters, queryPlan, {
          includeServerConstraints: fallbackMode,
        })
      );

      // If client-side filtering narrowed page 1 to 0 items and more pages exist, peek ahead up to 2 pages
      let extraPages = 0;
      while (
        matched.length === 0 &&
        serverHasMore &&
        cursor &&
        extraPages < AUTO_ADVANCE_MAX_PAGES
      ) {
        extraPages += 1;
        const nextSnap = await executeQuery(cursor, fallbackMode);
        if (gen !== fetchGenerationRef.current) return;
        if (nextSnap.docs.length === 0) {
          serverHasMore = false;
          break;
        }
        cursor = nextSnap.docs[nextSnap.docs.length - 1];
        serverHasMore = nextSnap.docs.length === pageLimit;
        const nextItems = nextSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as ActivityLog
        );
        recordObservedUsers(nextItems);
        const nextMatched = nextItems.filter((item) =>
          matchesAuditClientFilters(item, appliedFilters, queryPlan, {
            includeServerConstraints: fallbackMode,
          })
        );
        matched = [...matched, ...nextMatched];
      }

      if (gen !== fetchGenerationRef.current) return;

      lastDocRef.current = cursor;
      setHasMoreLogs(serverHasMore);
      setLogs(matched);
    } catch (err) {
      if (gen !== fetchGenerationRef.current) return;
      console.warn('Could not fetch filtered activity logs:', err);
      setLogsError('অডিট লগ লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      if (gen === fetchGenerationRef.current) {
        setLoadingLogs(false);
      }
    }
  }, [appliedFilters, isAdmin, queryPlan, recordObservedUsers]);

  const loadMoreLogs = useCallback(async () => {
    if (!isAdmin || !lastDocRef.current || loadingMoreLogs || !hasMoreLogs) return;
    const gen = fetchGenerationRef.current;
    setLoadingMoreLogs(true);
    setLogsError(null);

    const fallbackMode = usingFallbackIndexModeRef.current;
    const pageLimit = fallbackMode ? FALLBACK_PAGE_SIZE : AUDIT_PAGE_SIZE;

    try {
      const constraints = buildAuditFirestoreConstraints(queryPlan, {
        pageSize: pageLimit,
        cursor: lastDocRef.current,
        baseOrderOnly: fallbackMode,
      });
      const snap = await getDocs(query(collection(db, 'activityLogs'), ...constraints));
      if (gen !== fetchGenerationRef.current) return;

      lastDocRef.current =
        snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : lastDocRef.current;
      setHasMoreLogs(snap.docs.length === pageLimit);

      const rawNext = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as ActivityLog
      );
      recordObservedUsers(rawNext);

      const filteredNext = rawNext.filter((item) =>
        matchesAuditClientFilters(item, appliedFilters, queryPlan, {
          includeServerConstraints: fallbackMode,
        })
      );

      setLogs((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const item of filteredNext) {
          if (!seen.has(item.id)) merged.push(item);
        }
        return merged;
      });
    } catch (err) {
      if (gen !== fetchGenerationRef.current) return;
      console.warn('Could not load more activity logs:', err);
      setLogsError('আরও লগ লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      if (gen === fetchGenerationRef.current) {
        setLoadingMoreLogs(false);
      }
    }
  }, [
    appliedFilters,
    hasMoreLogs,
    isAdmin,
    loadingMoreLogs,
    queryPlan,
    recordObservedUsers,
  ]);

  // Trigger query when server-side constraints change; search & client filters re-run fetch cleanly
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Debounced search handler (300ms)
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        updateUrlFilters(
          {
            ...appliedFilters,
            search: value,
          },
          { replace: true }
        );
      }, 300);
    },
    [appliedFilters, updateUrlFilters]
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      if (pendingTimerRef.current) {
        window.clearTimeout(pendingTimerRef.current);
      }
    };
  }, []);

  const setModuleFilter = useCallback(
    (moduleKey: string) => {
      updateUrlFilters({
        ...appliedFilters,
        module: moduleKey || 'ALL',
      });
    },
    [appliedFilters, updateUrlFilters]
  );

  const clearAllFilters = useCallback(() => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setSearchInput('');
    setDraftFilters({ ...DEFAULT_SHEET_FILTERS });
    updateUrlFilters({ ...DEFAULT_AUDIT_FILTERS });
  }, [updateUrlFilters]);

  // Filter Sheet actions
  const openSheet = useCallback(() => {
    setDraftFilters({
      types: appliedFilters.types,
      range: appliedFilters.range,
      from: appliedFilters.from,
      to: appliedFilters.to,
      userId: appliedFilters.userId,
    });
    setSheetOpen(true);
  }, [appliedFilters]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const resetDraft = useCallback(() => {
    setDraftFilters({ ...DEFAULT_SHEET_FILTERS });
  }, []);

  const customRangeError = useMemo(
    () => validateCustomDateRange(draftFilters.range, draftFilters.from, draftFilters.to),
    [draftFilters.from, draftFilters.range, draftFilters.to]
  );

  const applyDraft = useCallback(() => {
    if (customRangeError) return;
    setSheetOpen(false);
    updateUrlFilters({
      ...appliedFilters,
      types: draftFilters.types,
      range: draftFilters.range,
      from: draftFilters.range === 'custom' ? draftFilters.from : '',
      to: draftFilters.range === 'custom' ? draftFilters.to : '',
      userId: draftFilters.userId,
    });
  }, [appliedFilters, customRangeError, draftFilters, updateUrlFilters]);

  // Compute live pending result count whenever sheet is open and draft changes
  useEffect(() => {
    if (!sheetOpen || !isAdmin) return;

    if (pendingTimerRef.current) {
      window.clearTimeout(pendingTimerRef.current);
    }

    if (customRangeError) {
      setPendingCount(null);
      setPendingCountCapped(false);
      setLoadingPendingCount(false);
      return;
    }

    let cancelled = false;
    setLoadingPendingCount(true);

    pendingTimerRef.current = window.setTimeout(async () => {
      const candidateFilters: AuditFiltersState = {
        module: appliedFilters.module,
        search: appliedFilters.search,
        ...draftFilters,
        from: draftFilters.range === 'custom' ? draftFilters.from : '',
        to: draftFilters.range === 'custom' ? draftFilters.to : '',
      };
      const draftPlan = buildAuditQueryPlan(candidateFilters);

      try {
        if (!draftPlan.hasClientOnlyFilters) {
          try {
            const countConstraints = buildAuditFirestoreConstraints(draftPlan, {
              forCount: true,
            });
            const countSnap = await getCountFromServer(
              query(collection(db, 'activityLogs'), ...countConstraints)
            );
            if (!cancelled) {
              setPendingCount(countSnap.data().count);
              setPendingCountCapped(false);
            }
            return;
          } catch (err) {
            if (!isMissingIndexError(err)) throw err;
            // Fallback to sample count if composite index isn't deployed yet
          }
        }

        // Client-filtered count (either search/action+range or missing index fallback)
        const fallbackMode = false;
        let snap;
        let usedBaseFallback = false;
        try {
          const constraints = buildAuditFirestoreConstraints(draftPlan, {
            pageSize: PREVIEW_CAP,
            baseOrderOnly: fallbackMode,
          });
          snap = await getDocs(query(collection(db, 'activityLogs'), ...constraints));
        } catch (err) {
          if (!isMissingIndexError(err)) throw err;
          usedBaseFallback = true;
          const constraints = buildAuditFirestoreConstraints(draftPlan, {
            pageSize: PREVIEW_CAP,
            baseOrderOnly: true,
          });
          snap = await getDocs(query(collection(db, 'activityLogs'), ...constraints));
        }

        if (cancelled) return;
        const docs = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as ActivityLog
        );
        recordObservedUsers(docs);
        const filtered = docs.filter((item) =>
          matchesAuditClientFilters(item, candidateFilters, draftPlan, {
            includeServerConstraints: usedBaseFallback,
          })
        );
        setPendingCount(filtered.length);
        setPendingCountCapped(snap.docs.length === PREVIEW_CAP);
      } catch {
        if (!cancelled) {
          setPendingCount(null);
          setPendingCountCapped(false);
        }
      } finally {
        if (!cancelled) {
          setLoadingPendingCount(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      if (pendingTimerRef.current) {
        window.clearTimeout(pendingTimerRef.current);
      }
    };
  }, [
    appliedFilters.module,
    appliedFilters.search,
    customRangeError,
    draftFilters,
    isAdmin,
    recordObservedUsers,
    sheetOpen,
  ]);

  const availableUsers: AuditLogUserOption[] = useMemo(() => {
    return Array.from(userMap.entries())
      .map(([userId, label]) => ({ userId, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'bn'));
  }, [userMap]);

  const activeSheetFilterCount = useMemo(
    () => countActiveSheetFilters(appliedFilters),
    [appliedFilters]
  );

  const activeSheetSummaryText = useMemo(
    () => formatActiveSheetSummary(appliedFilters, userMap),
    [appliedFilters, userMap]
  );

  const hasAnyActiveFilter = useMemo(
    () =>
      appliedFilters.module !== 'ALL' ||
      appliedFilters.search.trim().length > 0 ||
      activeSheetFilterCount > 0,
    [activeSheetFilterCount, appliedFilters.module, appliedFilters.search]
  );

  return {
    appliedFilters,
    searchInput,
    handleSearchChange,
    setModuleFilter,
    clearAllFilters,
    sheetOpen,
    openSheet,
    closeSheet,
    draftFilters,
    setDraftFilters,
    resetDraft,
    applyDraft,
    customRangeError,
    pendingCount,
    pendingCountCapped,
    loadingPendingCount,
    logs,
    loadingLogs,
    loadingMoreLogs,
    hasMoreLogs,
    logsError,
    refreshLogs: fetchLogs,
    loadMoreLogs,
    availableUsers,
    activeSheetFilterCount,
    activeSheetSummaryText,
    hasAnyActiveFilter,
  };
}
