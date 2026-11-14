import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
} from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import type { ActivityLog } from '../types';
import {
  getLogDate,
  hasValidFirestoreCreatedAt,
  mergeAndSortAuditLogs,
  sortAuditLogsNewestFirst,
} from '../lib/auditDate';
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
    statuses: appliedFilters.statuses,
    range: appliedFilters.range,
    from: appliedFilters.from,
    to: appliedFilters.to,
    userId: appliedFilters.userId,
    withLocation: appliedFilters.withLocation,
  });

  // Fetched logs + pagination + status
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const allMatchedLogsRef = useRef<ActivityLog[]>([]);
  const [legacyFixCount, setLegacyFixCount] = useState(0);
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

  // Fetch all matching docs without orderBy('createdAt') so old entries missing createdAt
  // are never dropped, then sort newest-first on the client and paginate stably.
  const fetchLogs = useCallback(async () => {
    if (!isAdmin) {
      allMatchedLogsRef.current = [];
      setLogs([]);
      setHasMoreLogs(false);
      setLegacyFixCount(0);
      setLogsError(null);
      setLoadingLogs(false);
      return;
    }

    const gen = ++fetchGenerationRef.current;
    setLoadingLogs(true);
    setLogsError(null);
    allMatchedLogsRef.current = [];

    const executeQuery = async (fallbackMode: boolean) => {
      const constraints = buildAuditFirestoreConstraints(queryPlan, {
        baseOrderOnly: fallbackMode,
      });
      return getDocs(query(collection(db, 'activityLogs'), ...constraints));
    };

    try {
      let fallbackMode = false;
      let snap;
      try {
        snap = await executeQuery(false);
      } catch (err) {
        if (isMissingIndexError(err)) {
          console.warn(
            'Firestore composite index missing for audit query; falling back to client-side filtering.',
            err
          );
          fallbackMode = true;
          snap = await executeQuery(true);
        } else {
          throw err;
        }
      }

      if (gen !== fetchGenerationRef.current) return;

      const rawDocs: ActivityLog[] = snap.docs.map(
        (d) =>
          ({
            id: d.id,
            ...d.data(),
            hasPendingWrites: d.metadata.hasPendingWrites,
          }) as ActivityLog
      );
      recordObservedUsers(rawDocs);

      const needFixCount = rawDocs.filter(
        (item) => !hasValidFirestoreCreatedAt(item) && getLogDate(item) !== null
      ).length;
      setLegacyFixCount(needFixCount);

      const matched = rawDocs.filter((item) =>
        matchesAuditClientFilters(item, appliedFilters, queryPlan, {
          includeServerConstraints: fallbackMode,
        })
      );

      const sortedMatched = sortAuditLogsNewestFirst(matched);
      allMatchedLogsRef.current = sortedMatched;

      setLogs(sortedMatched.slice(0, AUDIT_PAGE_SIZE));
      setHasMoreLogs(sortedMatched.length > AUDIT_PAGE_SIZE);
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
    if (!isAdmin || loadingMoreLogs || !hasMoreLogs) return;
    setLoadingMoreLogs(true);
    try {
      const pool = allMatchedLogsRef.current;
      const nextSlice = pool.slice(logs.length, logs.length + AUDIT_PAGE_SIZE);
      const merged = mergeAndSortAuditLogs(logs, nextSlice);
      setLogs(merged);
      setHasMoreLogs(merged.length < pool.length);
    } finally {
      setLoadingMoreLogs(false);
    }
  }, [hasMoreLogs, isAdmin, loadingMoreLogs, logs]);

  // Trigger query when applied filters change
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
      statuses: appliedFilters.statuses,
      range: appliedFilters.range,
      from: appliedFilters.from,
      to: appliedFilters.to,
      userId: appliedFilters.userId,
      withLocation: appliedFilters.withLocation,
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
      statuses: draftFilters.statuses,
      range: draftFilters.range,
      from: draftFilters.range === 'custom' ? draftFilters.from : '',
      to: draftFilters.range === 'custom' ? draftFilters.to : '',
      userId: draftFilters.userId,
      withLocation: draftFilters.withLocation,
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

        // Client-filtered count (when search, Dhaka date range, or missing index fallback applies)
        let snap;
        let usedBaseFallback = false;
        try {
          const constraints = buildAuditFirestoreConstraints(draftPlan, {
            baseOrderOnly: false,
          });
          snap = await getDocs(query(collection(db, 'activityLogs'), ...constraints));
        } catch (err) {
          if (!isMissingIndexError(err)) throw err;
          usedBaseFallback = true;
          const constraints = buildAuditFirestoreConstraints(draftPlan, {
            baseOrderOnly: true,
          });
          snap = await getDocs(query(collection(db, 'activityLogs'), ...constraints));
        }

        if (cancelled) return;
        const docs = snap.docs.map(
          (d) =>
            ({
              id: d.id,
              ...d.data(),
              hasPendingWrites: d.metadata.hasPendingWrites,
            }) as ActivityLog
        );
        recordObservedUsers(docs);
        const filtered = docs.filter((item) =>
          matchesAuditClientFilters(item, candidateFilters, draftPlan, {
            includeServerConstraints: usedBaseFallback,
          })
        );
        setPendingCount(filtered.length);
        setPendingCountCapped(false);
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
    legacyFixCount,
    refreshLogs: fetchLogs,
    loadMoreLogs,
    availableUsers,
    activeSheetFilterCount,
    activeSheetSummaryText,
    hasAnyActiveFilter,
  };
}
