import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  collection,
  doc,
  DocumentData,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  getLogDate,
  parseAuditDateValue,
  sortAuditLogsNewestFirst,
} from '../lib/auditDate';
import type { ActivityLog } from '../types';

const NOTIFICATION_WINDOW_DAYS = 30;
const REALTIME_FETCH_LIMIT = 30;
export const DROPDOWN_NOTIFICATIONS_LIMIT = 10;
export const NOTIFICATIONS_PAGE_SIZE = 20;

export const REQUIRED_NOTIFICATION_COMPOSITE_INDEXES: ReadonlyArray<{
  collection: string;
  fields: string;
  usedBy: string;
}> = [
  {
    collection: 'activityLogs',
    fields: 'notifyRoles (Arrays) ASC, createdAt DESC',
    usedBy: 'Role-based notifications stream & pagination (Course Director, FMA)',
  },
  {
    collection: 'activityLogs',
    fields: 'notifyUserIds (Arrays) ASC, createdAt DESC',
    usedBy: 'User-targeted notifications stream & pagination (FMA rejection/settle alerts)',
  },
];

interface NotificationsContextValue {
  notifications: ActivityLog[];
  dropdownItems: ActivityLog[];
  unreadCount: number;
  unreadIds: Set<string>;
  seenAtMs: number;
  clearedAtMs: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  bannerVisible: boolean;
  bannerUnreadCount: number;
  dismissBanner: () => void;
  activeUrgentNotification: ActivityLog | null;
  acknowledgeUrgentNotification: (logId: string) => Promise<void>;
  soundEnabled: boolean;
  toggleSound: () => void;
  markAllSeen: () => Promise<void>;
  scheduleAutoMarkSeen: (delayMs?: number) => void;
  cancelAutoMarkSeen: () => void;
  clearAllNotifications: () => Promise<void>;
  loadMore: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  dropdownItems: [],
  unreadCount: 0,
  unreadIds: new Set<string>(),
  seenAtMs: 0,
  clearedAtMs: 0,
  loading: false,
  loadingMore: false,
  hasMore: false,
  error: null,
  bannerVisible: false,
  bannerUnreadCount: 0,
  dismissBanner: () => {},
  activeUrgentNotification: null,
  acknowledgeUrgentNotification: async () => {},
  soundEnabled: true,
  toggleSound: () => {},
  markAllSeen: async () => {},
  scheduleAutoMarkSeen: () => {},
  cancelAutoMarkSeen: () => {},
  clearAllNotifications: async () => {},
  loadMore: async () => {},
  refreshNotifications: async () => {},
});

function docToActivityLog(d: QueryDocumentSnapshot<DocumentData>): ActivityLog {
  return {
    id: d.id,
    ...d.data(),
    hasPendingWrites: d.metadata.hasPendingWrites,
  } as ActivityLog;
}

function playNotificationTone(): void {
  if (typeof window === 'undefined') return;
  try {
    const audio = new Audio('/sounds/notify.mp3');
    audio.volume = 0.45;
    void audio.play().catch(() => {
      // Fail silently if /sounds/notify.mp3 is absent or autoplay is blocked
    });
  } catch {
    // Fail silently
  }
}

function getSoundStorageKey(uid?: string): string {
  return `bnfe_notif_sound_${uid || 'anon'}`;
}

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, userProfile } = useAuth();
  const uid = user?.uid || '';
  const userRole = (userProfile?.role || '').trim();
  const isActiveSession = Boolean(
    uid && userProfile && userProfile.status === 'Active' && userRole
  );

  // Realtime snapshots
  const [roleLiveItems, setRoleLiveItems] = useState<ActivityLog[]>([]);
  const [userLiveItems, setUserLiveItems] = useState<ActivityLog[]>([]);
  // Extra paginated snapshots loaded via "আরও দেখুন"
  const [pagedItems, setPagedItems] = useState<ActivityLog[]>([]);

  const [seenAtMs, setSeenAtMs] = useState<number>(0);
  const [clearedAtMs, setClearedAtMs] = useState<number>(0);

  const [loadingRole, setLoadingRole] = useState<boolean>(false);
  const [loadingUser, setLoadingUser] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination cursors and flags
  const roleLastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const userLastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreRoleServer, setHasMoreRoleServer] = useState<boolean>(false);
  const [hasMoreUserServer, setHasMoreUserServer] = useState<boolean>(false);

  // Session UI states
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [bannerInitialUnread, setBannerInitialUnread] = useState<number | null>(null);
  const [acknowledgedUrgentIds, setAcknowledgedUrgentIds] = useState<Set<string>>(
    () => new Set()
  );

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const initialRoleHydratedRef = useRef<boolean>(false);
  const initialUserHydratedRef = useRef<boolean>(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const autoSeenTimerRef = useRef<number | null>(null);

  // Sync sound preference per uid
  useEffect(() => {
    if (!uid || typeof window === 'undefined') {
      setSoundEnabled(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(getSoundStorageKey(uid));
      setSoundEnabled(raw !== 'false');
    } catch {
      setSoundEnabled(true);
    }
  }, [uid]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (uid && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(getSoundStorageKey(uid), next ? 'true' : 'false');
        } catch {
          // ignore storage errors
        }
      }
      return next;
    });
  }, [uid]);

  // Keep user's own notificationsSeenAt & notificationsClearedAt in sync
  useEffect(() => {
    if (!isActiveSession || !uid) {
      setSeenAtMs(0);
      setClearedAtMs(0);
      return;
    }

    const userRef = doc(db, 'users', uid);
    const unsubUser = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const seenDate = parseAuditDateValue(data.notificationsSeenAt);
        const clearedDate = parseAuditDateValue(data.notificationsClearedAt);
        setSeenAtMs((prev) => Math.max(prev, seenDate ? seenDate.getTime() : 0));
        setClearedAtMs((prev) => Math.max(prev, clearedDate ? clearedDate.getTime() : 0));
      },
      (err) => {
        console.warn('Notification user timestamp listener notice:', err?.message || err);
      }
    );

    return () => {
      try {
        unsubUser();
      } catch {
        // ignore
      }
    };
  }, [isActiveSession, uid]);

  // Reset state cleanly on logout / user switch
  useEffect(() => {
    if (!isActiveSession) {
      setRoleLiveItems([]);
      setUserLiveItems([]);
      setPagedItems([]);
      setLoadingRole(false);
      setLoadingUser(false);
      setLoadingMore(false);
      setError(null);
      setHasMoreRoleServer(false);
      setHasMoreUserServer(false);
      setBannerDismissed(false);
      setBannerInitialUnread(null);
      setAcknowledgedUrgentIds(new Set());
      roleLastDocRef.current = null;
      userLastDocRef.current = null;
      initialRoleHydratedRef.current = false;
      initialUserHydratedRef.current = false;
      knownIdsRef.current = new Set();
      if (autoSeenTimerRef.current !== null) {
        window.clearTimeout(autoSeenTimerRef.current);
        autoSeenTimerRef.current = null;
      }
    }
  }, [isActiveSession, uid]);

  // Shared 30-day rolling cutoff per active session
  const cutoffTimestamp = useMemo(() => {
    const ms = Date.now() - NOTIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return Timestamp.fromMillis(ms);
  }, [isActiveSession, uid]);

  // Single pair of Firestore listeners (notifyRoles + notifyUserIds)
  useEffect(() => {
    if (!isActiveSession || !uid || !userRole) return;

    setLoadingRole(true);
    setLoadingUser(true);
    setError(null);
    initialRoleHydratedRef.current = false;
    initialUserHydratedRef.current = false;
    knownIdsRef.current = new Set();

    const logsCol = collection(db, 'activityLogs');

    const roleQuery = query(
      logsCol,
      where('notifyRoles', 'array-contains', userRole),
      where('createdAt', '>=', cutoffTimestamp),
      orderBy('createdAt', 'desc'),
      limit(REALTIME_FETCH_LIMIT)
    );

    const userQuery = query(
      logsCol,
      where('notifyUserIds', 'array-contains', uid),
      where('createdAt', '>=', cutoffTimestamp),
      orderBy('createdAt', 'desc'),
      limit(REALTIME_FETCH_LIMIT)
    );

    const handleSnapshotError = (err: any) => {
      const code = String(err?.code || '');
      const msg = String(err?.message || '');
      if (code === 'failed-precondition' || msg.toLowerCase().includes('index')) {
        setError(
          'বিজ্ঞপ্তি লোড করতে Firestore-এ Composite Index প্রয়োজন (notifyRoles/notifyUserIds + createdAt)।'
        );
      } else if (code === 'permission-denied') {
        setError('বিজ্ঞপ্তি দেখার প্রয়োজনীয় অনুমতি নেই।');
      } else {
        setError('বিজ্ঞপ্তি লোড করতে সমস্যা হয়েছে।');
      }
    };

    const unsubRole = onSnapshot(
      roleQuery,
      (snap) => {
        const docs = snap.docs.map(docToActivityLog);
        if (!roleLastDocRef.current && snap.docs.length > 0) {
          roleLastDocRef.current = snap.docs[snap.docs.length - 1];
        }
        if (!initialRoleHydratedRef.current) {
          docs.forEach((d) => knownIdsRef.current.add(d.id));
          initialRoleHydratedRef.current = true;
          setHasMoreRoleServer(snap.docs.length >= REALTIME_FETCH_LIMIT);
        } else {
          let hasNewIncoming = false;
          docs.forEach((d) => {
            if (!knownIdsRef.current.has(d.id)) {
              knownIdsRef.current.add(d.id);
              if (!d.replacedBy) hasNewIncoming = true;
            }
          });
          if (hasNewIncoming && soundEnabledRef.current) {
            playNotificationTone();
          }
        }
        setRoleLiveItems(docs);
        setLoadingRole(false);
      },
      (err) => {
        console.warn('Role notification listener error:', err);
        handleSnapshotError(err);
        setLoadingRole(false);
      }
    );

    const unsubUser = onSnapshot(
      userQuery,
      (snap) => {
        const docs = snap.docs.map(docToActivityLog);
        if (!userLastDocRef.current && snap.docs.length > 0) {
          userLastDocRef.current = snap.docs[snap.docs.length - 1];
        }
        if (!initialUserHydratedRef.current) {
          docs.forEach((d) => knownIdsRef.current.add(d.id));
          initialUserHydratedRef.current = true;
          setHasMoreUserServer(snap.docs.length >= REALTIME_FETCH_LIMIT);
        } else {
          let hasNewIncoming = false;
          docs.forEach((d) => {
            if (!knownIdsRef.current.has(d.id)) {
              knownIdsRef.current.add(d.id);
              if (!d.replacedBy) hasNewIncoming = true;
            }
          });
          if (hasNewIncoming && soundEnabledRef.current) {
            playNotificationTone();
          }
        }
        setUserLiveItems(docs);
        setLoadingUser(false);
      },
      (err) => {
        console.warn('User notification listener error:', err);
        handleSnapshotError(err);
        setLoadingUser(false);
      }
    );

    return () => {
      try {
        unsubRole();
      } catch {
        // ignore
      }
      try {
        unsubUser();
      } catch {
        // ignore
      }
    };
  }, [isActiveSession, uid, userRole, cutoffTimestamp]); // soundEnabled intentionally read dynamically via ref-like closure? Wait: let's sync via ref!

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Deduplicate, drop replaced & cleared entries, sort newest-first
  const notifications = useMemo(() => {
    const byId = new Map<string, ActivityLog>();
    for (const item of pagedItems) byId.set(item.id, item);
    for (const item of roleLiveItems) byId.set(item.id, item);
    for (const item of userLiveItems) byId.set(item.id, item);

    const filtered: ActivityLog[] = [];
    for (const item of byId.values()) {
      if (item.replacedBy) continue;
      if (clearedAtMs > 0) {
        const dt = getLogDate(item);
        if (dt && dt.getTime() <= clearedAtMs) continue;
      }
      filtered.push(item);
    }

    return sortAuditLogsNewestFirst(filtered);
  }, [pagedItems, roleLiveItems, userLiveItems, clearedAtMs]);

  const unreadIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of notifications) {
      const dt = getLogDate(item);
      const ms = dt ? dt.getTime() : 0;
      if (ms > seenAtMs) {
        ids.add(item.id);
      }
    }
    return ids;
  }, [notifications, seenAtMs]);

  const unreadCount = unreadIds.size;

  // Capture initial unread count once after first load for the per-session dismissible banner
  useEffect(() => {
    if (!isActiveSession || loadingRole || loadingUser) return;
    if (bannerInitialUnread === null) {
      setBannerInitialUnread(unreadCount);
    }
  }, [isActiveSession, loadingRole, loadingUser, unreadCount, bannerInitialUnread]);

  const bannerUnreadCount = bannerDismissed
    ? 0
    : unreadCount > 0
    ? unreadCount
    : 0;
  const bannerVisible =
    isActiveSession && !bannerDismissed && bannerUnreadCount > 0;

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  // Newest unread urgent alert that hasn't been acknowledged in this session
  const activeUrgentNotification = useMemo(() => {
    if (!isActiveSession) return null;
    for (const item of notifications) {
      if (
        item.priority === 'urgent' &&
        unreadIds.has(item.id) &&
        !acknowledgedUrgentIds.has(item.id)
      ) {
        return item;
      }
    }
    return null;
  }, [isActiveSession, notifications, unreadIds, acknowledgedUrgentIds]);

  const dropdownItems = useMemo(
    () => notifications.slice(0, DROPDOWN_NOTIFICATIONS_LIMIT),
    [notifications]
  );

  const markAllSeen = useCallback(async () => {
    if (!uid || !isActiveSession) return;
    const optimisticNow = Date.now();
    setSeenAtMs((prev) => Math.max(prev, optimisticNow));
    setBannerDismissed(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        notificationsSeenAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Could not update notificationsSeenAt:', err);
    }
  }, [uid, isActiveSession]);

  const scheduleAutoMarkSeen = useCallback(
    (delayMs: number = 1000) => {
      if (autoSeenTimerRef.current !== null) {
        window.clearTimeout(autoSeenTimerRef.current);
      }
      autoSeenTimerRef.current = window.setTimeout(() => {
        autoSeenTimerRef.current = null;
        void markAllSeen();
      }, delayMs);
    },
    [markAllSeen]
  );

  const cancelAutoMarkSeen = useCallback(() => {
    if (autoSeenTimerRef.current !== null) {
      window.clearTimeout(autoSeenTimerRef.current);
      autoSeenTimerRef.current = null;
    }
  }, []);

  const clearAllNotifications = useCallback(async () => {
    if (!uid || !isActiveSession) return;
    const optimisticNow = Date.now();
    setClearedAtMs((prev) => Math.max(prev, optimisticNow));
    setSeenAtMs((prev) => Math.max(prev, optimisticNow));
    setBannerDismissed(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        notificationsClearedAt: serverTimestamp(),
        notificationsSeenAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Could not update notificationsClearedAt:', err);
    }
  }, [uid, isActiveSession]);

  const acknowledgeUrgentNotification = useCallback(
    async (logId: string) => {
      setAcknowledgedUrgentIds((prev) => {
        const next = new Set(prev);
        next.add(logId);
        return next;
      });
      await markAllSeen();
    },
    [markAllSeen]
  );

  const loadMore = useCallback(async () => {
    if (!isActiveSession || !uid || !userRole || loadingMore) return;
    if (!hasMoreRoleServer && !hasMoreUserServer) return;

    setLoadingMore(true);
    try {
      const logsCol = collection(db, 'activityLogs');
      const fetched: ActivityLog[] = [];

      if (hasMoreRoleServer && roleLastDocRef.current) {
        const qRoleMore = query(
          logsCol,
          where('notifyRoles', 'array-contains', userRole),
          where('createdAt', '>=', cutoffTimestamp),
          orderBy('createdAt', 'desc'),
          startAfter(roleLastDocRef.current),
          limit(NOTIFICATIONS_PAGE_SIZE)
        );
        const snap = await getDocs(qRoleMore);
        snap.docs.forEach((d) => fetched.push(docToActivityLog(d)));
        if (snap.docs.length > 0) {
          roleLastDocRef.current = snap.docs[snap.docs.length - 1];
        }
        setHasMoreRoleServer(snap.docs.length >= NOTIFICATIONS_PAGE_SIZE);
      }

      if (hasMoreUserServer && userLastDocRef.current) {
        const qUserMore = query(
          logsCol,
          where('notifyUserIds', 'array-contains', uid),
          where('createdAt', '>=', cutoffTimestamp),
          orderBy('createdAt', 'desc'),
          startAfter(userLastDocRef.current),
          limit(NOTIFICATIONS_PAGE_SIZE)
        );
        const snap = await getDocs(qUserMore);
        snap.docs.forEach((d) => fetched.push(docToActivityLog(d)));
        if (snap.docs.length > 0) {
          userLastDocRef.current = snap.docs[snap.docs.length - 1];
        }
        setHasMoreUserServer(snap.docs.length >= NOTIFICATIONS_PAGE_SIZE);
      }

      if (fetched.length > 0) {
        setPagedItems((prev) => {
          const map = new Map<string, ActivityLog>();
          prev.forEach((item) => map.set(item.id, item));
          fetched.forEach((item) => map.set(item.id, item));
          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.warn('Error loading older notifications:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [
    isActiveSession,
    uid,
    userRole,
    loadingMore,
    hasMoreRoleServer,
    hasMoreUserServer,
    cutoffTimestamp,
  ]);

  const refreshNotifications = useCallback(async () => {
    if (!isActiveSession || !uid || !userRole) return;
    setError(null);
    try {
      const logsCol = collection(db, 'activityLogs');
      const [roleSnap, userSnap] = await Promise.all([
        getDocs(
          query(
            logsCol,
            where('notifyRoles', 'array-contains', userRole),
            where('createdAt', '>=', cutoffTimestamp),
            orderBy('createdAt', 'desc'),
            limit(REALTIME_FETCH_LIMIT)
          )
        ),
        getDocs(
          query(
            logsCol,
            where('notifyUserIds', 'array-contains', uid),
            where('createdAt', '>=', cutoffTimestamp),
            orderBy('createdAt', 'desc'),
            limit(REALTIME_FETCH_LIMIT)
          )
        ),
      ]);
      setRoleLiveItems(roleSnap.docs.map(docToActivityLog));
      setUserLiveItems(userSnap.docs.map(docToActivityLog));
      if (roleSnap.docs.length > 0) {
        roleLastDocRef.current = roleSnap.docs[roleSnap.docs.length - 1];
      }
      if (userSnap.docs.length > 0) {
        userLastDocRef.current = userSnap.docs[userSnap.docs.length - 1];
      }
      setHasMoreRoleServer(roleSnap.docs.length >= REALTIME_FETCH_LIMIT);
      setHasMoreUserServer(userSnap.docs.length >= REALTIME_FETCH_LIMIT);
    } catch (err) {
      console.warn('Error refreshing notifications:', err);
    }
  }, [isActiveSession, uid, userRole, cutoffTimestamp]);

  const hasMore = hasMoreRoleServer || hasMoreUserServer;
  const loading = loadingRole || loadingUser;

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      dropdownItems,
      unreadCount,
      unreadIds,
      seenAtMs,
      clearedAtMs,
      loading,
      loadingMore,
      hasMore,
      error,
      bannerVisible,
      bannerUnreadCount,
      dismissBanner,
      activeUrgentNotification,
      acknowledgeUrgentNotification,
      soundEnabled,
      toggleSound,
      markAllSeen,
      scheduleAutoMarkSeen,
      cancelAutoMarkSeen,
      clearAllNotifications,
      loadMore,
      refreshNotifications,
    }),
    [
      notifications,
      dropdownItems,
      unreadCount,
      unreadIds,
      seenAtMs,
      clearedAtMs,
      loading,
      loadingMore,
      hasMore,
      error,
      bannerVisible,
      bannerUnreadCount,
      dismissBanner,
      activeUrgentNotification,
      acknowledgeUrgentNotification,
      soundEnabled,
      toggleSound,
      markAllSeen,
      scheduleAutoMarkSeen,
      cancelAutoMarkSeen,
      clearAllNotifications,
      loadMore,
      refreshNotifications,
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
