import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { auth, db } from '../lib/firebase';
import {
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  collection,
  where,
  getDocs,
  DocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';
import { dataService } from '../lib/dataService';
import { recordSimpleAuditLog, setLiveAuditActor } from '../lib/auditLog';
import {
  clearSessionAppCache,
  isPermissionDeniedError,
  registerPermissionDeniedHandler,
  unsubscribeAllListeners,
} from '../lib/sessionGuard';

const SUPER_ADMIN_EMAILS = [
  'unfeohaluaghat@gmail.com',
  'absiddik5177@gmail.com',
];

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

export const isVerifiedSuperAdmin = (u?: User | null): boolean => {
  return Boolean(u?.emailVerified && isSuperAdminEmail(u?.email));
};

export interface SessionToastData {
  id: number;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (emailOrPhone: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  quickLoginAsRole: (
    role: UserRole,
    customName?: string,
    instituteId?: string,
    batchId?: string
  ) => Promise<void>;
  signUp: (params: {
    name: string;
    email: string;
    password: string;
    phone: string;
    requestedRole?: UserRole;
    instituteId?: string;
    batchId?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  permissionError: boolean;
  sessionToast: SessionToastData | null;
  dismissSessionToast: () => void;
  showSessionToast: (type: SessionToastData['type'], message: string) => void;
  sessionNotice: string | null;
  clearSessionNotice: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  signIn: async () => {},
  signInWithGoogle: async () => {},
  quickLoginAsRole: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  sendPasswordReset: async () => {},
  permissionError: false,
  sessionToast: null,
  dismissSessionToast: () => {},
  showSessionToast: () => {},
  sessionNotice: null,
  clearSessionNotice: () => {},
});

export const useAuth = () => useContext(AuthContext);

const MSG_INACTIVE_FORCED_LOGOUT =
  'আপনার অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে। প্রশাসকের সাথে যোগাযোগ করুন।';
const MSG_ACCOUNT_NOT_FOUND = 'অ্যাকাউন্টটি পাওয়া যায়নি';
const MSG_NO_ACTION_PERMISSION = 'আপনার এই কাজের অনুমতি নেই';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [sessionToast, setSessionToast] = useState<SessionToastData | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const isRegisteringRef = useRef(false);
  const isAuthTransitionRef = useRef(false);
  const isForcingLogoutRef = useRef(false);
  const sessionEstablishedRef = useRef(false);
  const bootstrappingUidRef = useRef<string | null>(null);
  const prevRoleRef = useRef<string | null>(null);
  const userDocUnsubRef = useRef<(() => void) | null>(null);
  const activeListenerUidRef = useRef<string | null>(null);
  const serverVerifyPromiseRef = useRef<Promise<'active' | 'pending' | 'logged_out' | 'skipped'> | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const dismissSessionToast = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setSessionToast(null);
  }, []);

  const showSessionToast = useCallback(
    (type: SessionToastData['type'], message: string) => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      setSessionToast({ id: Date.now(), type, message });
      toastTimerRef.current = window.setTimeout(() => {
        setSessionToast(null);
        toastTimerRef.current = null;
      }, 5000);
    },
    []
  );

  const clearSessionNotice = useCallback(() => {
    setSessionNotice(null);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const detachUserDocListener = useCallback(() => {
    if (userDocUnsubRef.current) {
      try {
        userDocUnsubRef.current();
      } catch {
        // ignore
      }
      userDocUnsubRef.current = null;
    }
    activeListenerUidRef.current = null;
  }, []);

  const forceLogout = useCallback(
    async (noticeMessage: string) => {
      if (isForcingLogoutRef.current) return;
      isForcingLogoutRef.current = true;
      try {
        detachUserDocListener();
        unsubscribeAllListeners();
        clearSessionAppCache();
        setLiveAuditActor(null);
        prevRoleRef.current = null;
        sessionEstablishedRef.current = false;
        bootstrappingUidRef.current = null;
        setPermissionError(false);
        setSessionNotice(noticeMessage);
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        try {
          await firebaseSignOut(auth);
        } catch {
          // ignore signOut failures
        }
      } finally {
        isForcingLogoutRef.current = false;
      }
    },
    [detachUserDocListener]
  );

  /**
   * Bootstraps a first-time authenticated user when users/{uid} does not exist yet
   * (either adopting a pre-created email placeholder or creating a Pending / Verified Super Admin doc).
   */
  const bootstrapInitialUserProfile = useCallback(
    async (currentUser: User): Promise<UserProfile | null> => {
      const uid = currentUser.uid;
      const cleanEmail = currentUser.email?.trim().toLowerCase() || '';
      const isSuper = isVerifiedSuperAdmin(currentUser);

      // 1. Check if Course Director pre-created an account with this email under a placeholder ID
      if (cleanEmail) {
        try {
          const emailQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
          const querySnap = await getDocs(emailQuery);
          const matchingDoc = querySnap.docs.find((d) => d.id !== uid);

          if (matchingDoc) {
            const raw = matchingDoc.data();
            const preStatus = String(raw.status || '').trim();
            if (preStatus !== 'Active' && preStatus !== 'Pending Approval') {
              await forceLogout(MSG_INACTIVE_FORCED_LOGOUT);
              throw new Error(MSG_INACTIVE_FORCED_LOGOUT);
            }

            const preExisting = { id: matchingDoc.id, ...raw } as UserProfile;
            const adoptedProfile: UserProfile = {
              ...preExisting,
              id: uid,
              name: preExisting.name || currentUser.displayName || 'ব্যবহারকারী',
              email: cleanEmail,
              phone: preExisting.phone || currentUser.phoneNumber || '',
              status: preStatus as 'Active' | 'Pending Approval',
              updatedAt: Date.now(),
            };

            await setDoc(doc(db, 'users', uid), adoptedProfile);
            try {
              await deleteDoc(doc(db, 'users', matchingDoc.id));
            } catch (delErr) {
              console.warn('Could not remove old placeholder doc:', delErr);
            }

            recordSimpleAuditLog({
              action: 'update',
              module: 'security',
              collectionName: 'users',
              targetId: uid,
              targetLabel: adoptedProfile.name || cleanEmail,
              title: `প্রাক-নিবন্ধিত অ্যাকাউন্ট সংযুক্ত: ${adoptedProfile.name || cleanEmail}`,
              actor: {
                userId: uid,
                user: adoptedProfile.name || cleanEmail,
                userRole: adoptedProfile.role || '',
              },
            }).catch(() => {});

            dataService.broadcastSync('users');
            return adoptedProfile;
          }
        } catch (findErr: any) {
          if (findErr?.message === MSG_INACTIVE_FORCED_LOGOUT) {
            throw findErr;
          }
          console.warn('Notice checking pre-existing user doc:', findErr);
        }
      }

      // 2. Check if Course Director permits new public self-registrations
      try {
        const settings = await dataService.getSystemSettings();
        if (settings.allowPublicRegistration === false && !isSuper) {
          const closedReason =
            settings.registrationClosedReason ||
            'কোর্স পরিচালক কর্তৃক নতুন উন্মুক্ত নিবন্ধন বর্তমানে বন্ধ রাখা হয়েছে। আপনার অনুমোদিত অ্যাকাউন্ট থাকলে পরিচালকের সাথে যোগাযোগ করুন।';
          await forceLogout(closedReason);
          throw new Error(closedReason);
        }
      } catch (settingsErr: any) {
        if (settingsErr?.message && settingsErr.message.includes('বন্ধ')) {
          throw settingsErr;
        }
      }

      // 3. Verified super admin receives Course Director; all others receive Pending role & Pending Approval
      const defaultRole: UserRole = isSuper ? 'Course Director' : 'Pending';
      const defaultStatus: 'Active' | 'Pending Approval' = isSuper
        ? 'Active'
        : 'Pending Approval';

      const initialProfile: UserProfile = {
        id: uid,
        name:
          currentUser.displayName ||
          (cleanEmail ? cleanEmail.split('@')[0] : 'কর্মকর্তা'),
        email: cleanEmail,
        phone: currentUser.phoneNumber || '',
        role: defaultRole,
        status: defaultStatus,
        createdAt: Date.now(),
      };

      await setDoc(doc(db, 'users', uid), initialProfile);
      recordSimpleAuditLog({
        action: 'create',
        module: 'security',
        collectionName: 'users',
        targetId: uid,
        targetLabel: initialProfile.name,
        title: `প্রাথমিক প্রোফাইল তৈরি: ${initialProfile.name} (${defaultRole})`,
        actor: {
          userId: uid,
          user: initialProfile.name,
          userRole: defaultRole,
        },
      }).catch(() => {});
      dataService.broadcastSync('users');

      return initialProfile;
    },
    [forceLogout]
  );

  /**
   * Evaluates a Firestore snapshot of users/{uid} (strictly server-confirmed or pending local write).
   * Enforces live status revocation, Pending Approval transition, and live role-change toast.
   */
  const evaluateUserSnapshot = useCallback(
    async (
      currentUser: User,
      snap: DocumentSnapshot<DocumentData>,
      source: 'snapshot' | 'server-verify'
    ): Promise<'active' | 'pending' | 'logged_out' | 'skipped'> => {
      if (isForcingLogoutRef.current) return 'logged_out';

      // Ignore stale local cache snapshots until server confirms
      if (source === 'snapshot' && snap.metadata.fromCache && !snap.metadata.hasPendingWrites) {
        return 'skipped';
      }

      if (!snap.exists()) {
        if (isRegisteringRef.current || isAuthTransitionRef.current) {
          return 'skipped';
        }
        // If doc previously existed in this session and was deleted by an admin -> force logout
        if (sessionEstablishedRef.current) {
          await forceLogout(MSG_ACCOUNT_NOT_FOUND);
          return 'logged_out';
        }
        // First-time sign-in bootstrap
        if (bootstrappingUidRef.current === currentUser.uid) {
          return 'skipped';
        }
        bootstrappingUidRef.current = currentUser.uid;
        try {
          const bootstrapped = await bootstrapInitialUserProfile(currentUser);
          if (!bootstrapped) {
            await forceLogout(MSG_ACCOUNT_NOT_FOUND);
            return 'logged_out';
          }
          sessionEstablishedRef.current = true;
          prevRoleRef.current = bootstrapped.role;
          if (bootstrapped.status === 'Pending Approval' || bootstrapped.role === 'Pending') {
            unsubscribeAllListeners();
            setLiveAuditActor(null);
            setUserProfile(bootstrapped);
            setLoading(false);
            return 'pending';
          }
          setLiveAuditActor({
            userId: bootstrapped.id,
            user: bootstrapped.name,
            userRole: bootstrapped.role,
          });
          setUserProfile(bootstrapped);
          setLoading(false);
          return 'active';
        } catch (err) {
          console.warn('Initial user profile bootstrap failed:', err);
          if (!isForcingLogoutRef.current) {
            await forceLogout(MSG_ACCOUNT_NOT_FOUND);
          }
          return 'logged_out';
        } finally {
          bootstrappingUidRef.current = null;
        }
      }

      const rawData = snap.data() as Record<string, any>;
      const isSuper = isVerifiedSuperAdmin(currentUser);
      let rawStatus = String(rawData.status || '').trim();
      let rawRole = String(rawData.role || 'Pending').trim() as UserRole;

      // Only verified super-admin email retains guaranteed Course Director + Active recovery
      if (isSuper && (rawRole !== 'Course Director' || rawStatus !== 'Active')) {
        rawRole = 'Course Director';
        rawStatus = 'Active';
        setDoc(
          doc(db, 'users', currentUser.uid),
          { role: 'Course Director', status: 'Active', updatedAt: Date.now() },
          { merge: true }
        ).catch(() => {});
      }

      // Strictly allow only 'Active' or 'Pending Approval'; anything else (e.g. 'Inactive') forces logout
      if (rawStatus !== 'Active' && rawStatus !== 'Pending Approval') {
        await forceLogout(MSG_INACTIVE_FORCED_LOGOUT);
        return 'logged_out';
      }

      const liveProfile: UserProfile = {
        ...(rawData as UserProfile),
        id: snap.id,
        name: rawData.name || rawData.displayName || currentUser.displayName || 'ব্যবহারকারী',
        email: (rawData.email || currentUser.email || '').trim().toLowerCase(),
        phone: rawData.phone || currentUser.phoneNumber || '',
        role: rawRole,
        status: rawStatus as 'Active' | 'Pending Approval',
      };

      // Pending Approval or Pending role -> cancel all data listeners & show Pending screen without logging out
      if (liveProfile.status === 'Pending Approval' || liveProfile.role === 'Pending') {
        unsubscribeAllListeners();
        sessionEstablishedRef.current = true;
        prevRoleRef.current = liveProfile.role;
        setLiveAuditActor(null);
        setPermissionError(false);
        setUserProfile(liveProfile);
        setLoading(false);
        return 'pending';
      }

      // Active member: detect live role change
      const previousRole = prevRoleRef.current;
      const roleChanged = Boolean(previousRole && previousRole !== liveProfile.role);
      if (roleChanged) {
        showSessionToast(
          'info',
          `আপনার ভূমিকা পরিবর্তন হয়েছে: ${previousRole} → ${liveProfile.role}`
        );
      }

      prevRoleRef.current = liveProfile.role;
      sessionEstablishedRef.current = true;
      setPermissionError(false);
      setLiveAuditActor({
        userId: liveProfile.id,
        user: liveProfile.name,
        userRole: liveProfile.role,
      });
      setUserProfile(liveProfile);
      setLoading(false);

      return 'active';
    },
    [bootstrapInitialUserProfile, forceLogout, showSessionToast]
  );

  /**
   * Attaches the live onSnapshot(doc(db, 'users', uid), { includeMetadataChanges: true }) listener.
   * Kept separate from sessionGuard's data listeners so Pending Approval transitions keep it alive.
   */
  const attachUserDocListener = useCallback(
    (currentUser: User) => {
      if (activeListenerUidRef.current === currentUser.uid && userDocUnsubRef.current) {
        return;
      }
      detachUserDocListener();
      activeListenerUidRef.current = currentUser.uid;
      const docRef = doc(db, 'users', currentUser.uid);

      userDocUnsubRef.current = onSnapshot(
        docRef,
        { includeMetadataChanges: true },
        (snap) => {
          void evaluateUserSnapshot(currentUser, snap, 'snapshot');
        },
        (err) => {
          console.warn('Live user session snapshot error:', err);
          if (isPermissionDeniedError(err)) {
            setPermissionError(true);
            void forceLogout(MSG_INACTIVE_FORCED_LOGOUT);
          } else {
            setLoading(false);
          }
        }
      );
    },
    [detachUserDocListener, evaluateUserSnapshot, forceLogout]
  );

  /**
   * Single-flight live server verification via getDocFromServer(doc(db, 'users', uid)).
   * Called on: permission-denied errors, app resume (visibilitychange/online), and manual refreshProfile.
   */
  const verifyUserFromServer = useCallback(
    async (
      reason: 'resume' | 'permission-denied' | 'manual'
    ): Promise<'active' | 'pending' | 'logged_out' | 'skipped'> => {
      const currentUser = auth.currentUser;
      if (!currentUser || isRegisteringRef.current || isAuthTransitionRef.current || isForcingLogoutRef.current) {
        return 'skipped';
      }

      if (serverVerifyPromiseRef.current) {
        return serverVerifyPromiseRef.current;
      }

      const roleBeforeVerify = prevRoleRef.current;

      const task = (async (): Promise<'active' | 'pending' | 'logged_out' | 'skipped'> => {
        try {
          const snap = await getDocFromServer(doc(db, 'users', currentUser.uid));
          if (!snap.exists()) {
            await forceLogout(MSG_ACCOUNT_NOT_FOUND);
            return 'logged_out';
          }
          const outcome = await evaluateUserSnapshot(currentUser, snap, 'server-verify');
          if (
            reason === 'permission-denied' &&
            outcome === 'active' &&
            roleBeforeVerify &&
            prevRoleRef.current === roleBeforeVerify
          ) {
            showSessionToast('warning', MSG_NO_ACTION_PERMISSION);
          }
          return outcome;
        } catch (err: any) {
          if (isPermissionDeniedError(err)) {
            await forceLogout(MSG_INACTIVE_FORCED_LOGOUT);
            return 'logged_out';
          }
          console.warn(`Server session verify notice (${reason}):`, err?.message || err);
          return 'skipped';
        } finally {
          serverVerifyPromiseRef.current = null;
        }
      })();

      serverVerifyPromiseRef.current = task;
      return task;
    },
    [evaluateUserSnapshot, forceLogout, showSessionToast]
  );

  // Register global permission-denied handler + app resume listeners (visibilitychange & online)
  useEffect(() => {
    const unregisterPerm = registerPermissionDeniedHandler(() => {
      return verifyUserFromServer('permission-denied').then(() => undefined);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && auth.currentUser) {
        void verifyUserFromServer('resume');
      }
    };

    const handleOnline = () => {
      if (auth.currentUser) {
        void verifyUserFromServer('resume');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      unregisterPerm();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [verifyUserFromServer]);

  // Primary Firebase Auth observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        if (isRegisteringRef.current || isAuthTransitionRef.current) {
          return;
        }
        attachUserDocListener(currentUser);
      } else {
        detachUserDocListener();
        unsubscribeAllListeners();
        clearSessionAppCache();
        setLiveAuditActor(null);
        prevRoleRef.current = null;
        sessionEstablishedRef.current = false;
        bootstrappingUidRef.current = null;
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      detachUserDocListener();
    };
  }, [attachUserDocListener, detachUserDocListener]);

  const signInWithGoogle = async () => {
    isAuthTransitionRef.current = true;
    setSessionNotice(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);

      const snap = await getDocFromServer(doc(db, 'users', cred.user.uid)).catch(() => null);
      if (snap && snap.exists()) {
        const outcome = await evaluateUserSnapshot(cred.user, snap, 'server-verify');
        if (outcome === 'logged_out') {
          throw new Error(MSG_INACTIVE_FORCED_LOGOUT);
        }
      } else {
        const bootstrapped = await bootstrapInitialUserProfile(cred.user);
        if (bootstrapped) {
          sessionEstablishedRef.current = true;
          prevRoleRef.current = bootstrapped.role;
          setUser(cred.user);
          setUserProfile(bootstrapped);
          if (bootstrapped.status === 'Active' && bootstrapped.role !== 'Pending') {
            setLiveAuditActor({
              userId: bootstrapped.id,
              user: bootstrapped.name,
              userRole: bootstrapped.role,
            });
          } else {
            setLiveAuditActor(null);
          }
        }
      }

      setUser(cred.user);
      setLoading(false);
      attachUserDocListener(cred.user);
    } catch (err: any) {
      if (
        err?.code === 'auth/operation-not-allowed' ||
        err?.message?.includes('operation-not-allowed')
      ) {
        throw new Error(
          'Firebase Authentication-এ Google প্রোভাইডার বন্ধ রয়েছে। অনুগ্রহ করে Firebase Console > Authentication > Sign-in method-এ গিয়ে Google প্রোভাইডার সক্রিয় (Enable) করুন।'
        );
      }
      throw err;
    } finally {
      isAuthTransitionRef.current = false;
    }
  };

  const quickLoginAsRole = async () => {
    throw new Error(
      'নিরাপত্তা নীতির কারণে সরাসরি রোলে লগইন নিষ্ক্রিয় রাখা হয়েছে। অনুগ্রহ করে প্রমাণপত্র দিয়ে প্রবেশ করুন।'
    );
  };

  const signIn = async (emailOrPhone: string, password: string) => {
    let emailToAuth = emailOrPhone.trim();
    setSessionNotice(null);

    if (!emailToAuth.includes('@')) {
      const cleanPhone = emailToAuth.replace(/[^0-9]/g, '');
      const allUsers = await dataService.getItems<UserProfile>('users');
      const matched = allUsers.find(
        (u) => u.phone && u.phone.replace(/[^0-9]/g, '') === cleanPhone
      );
      if (matched && matched.email) {
        emailToAuth = matched.email;
      } else {
        throw new Error('প্রদত্ত মোবাইল নম্বরের সাথে সংযুক্ত কোনো অ্যাকাউন্ট পাওয়া যায়নি।');
      }
    }

    isAuthTransitionRef.current = true;
    try {
      const cred = await signInWithEmailAndPassword(auth, emailToAuth, password);
      const snap = await getDocFromServer(doc(db, 'users', cred.user.uid)).catch(() => null);

      if (snap && snap.exists()) {
        const outcome = await evaluateUserSnapshot(cred.user, snap, 'server-verify');
        if (outcome === 'logged_out') {
          throw new Error(MSG_INACTIVE_FORCED_LOGOUT);
        }
      } else {
        const bootstrapped = await bootstrapInitialUserProfile(cred.user);
        if (!bootstrapped) {
          await forceLogout(MSG_ACCOUNT_NOT_FOUND);
          throw new Error('ব্যবহারকারীর প্রোফাইল পাওয়া যায়নি।');
        }
        sessionEstablishedRef.current = true;
        prevRoleRef.current = bootstrapped.role;
        setUserProfile(bootstrapped);
        if (bootstrapped.status === 'Active' && bootstrapped.role !== 'Pending') {
          setLiveAuditActor({
            userId: bootstrapped.id,
            user: bootstrapped.name,
            userRole: bootstrapped.role,
          });
        }
      }

      setUser(cred.user);
      setLoading(false);
      attachUserDocListener(cred.user);
    } catch (err: any) {
      if (
        err?.code === 'auth/operation-not-allowed' ||
        err?.message?.includes('operation-not-allowed')
      ) {
        throw new Error(
          'Firebase Authentication-এ "Email/Password" প্রোভাইডার সক্রিয় নেই। অনুগ্রহ করে Firebase Console > Authentication > Sign-in method-এ গিয়ে Email/Password সক্রিয় (Enable) করুন অথবা Google দিয়ে লগইন করুন।'
        );
      }
      throw err;
    } finally {
      isAuthTransitionRef.current = false;
    }
  };

  const signUp = async (params: {
    name: string;
    email: string;
    password: string;
    phone: string;
    requestedRole?: UserRole;
    instituteId?: string;
    batchId?: string;
  }) => {
    isRegisteringRef.current = true;
    setSessionNotice(null);
    const cleanEmail = params.email.trim().toLowerCase();

    try {
      const settings = await dataService.getSystemSettings();
      if (settings.allowPublicRegistration === false && !isSuperAdminEmail(cleanEmail)) {
        throw new Error(
          settings.registrationClosedReason ||
            'কোর্স পরিচালক কর্তৃক উন্মুক্ত নিবন্ধন সাময়িকভাবে বন্ধ রাখা হয়েছে। অ্যাকাউন্টের জন্য পরিচালকের সাথে যোগাযোগ করুন।'
        );
      }

      if (params.password.length < 6) {
        throw new Error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
      }

      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
      const uid = cred.user.uid;
      const isSuper = isVerifiedSuperAdmin(cred.user);

      // Safe default role: New public accounts always receive 'Pending' role and 'Pending Approval' status
      const safeRole: UserRole = isSuper ? 'Course Director' : 'Pending';
      const safeStatus: 'Active' | 'Pending Approval' = isSuper
        ? 'Active'
        : 'Pending Approval';

      const newProfile: UserProfile = {
        id: uid,
        name: params.name.trim(),
        email: cleanEmail,
        phone: params.phone.trim(),
        role: safeRole,
        instituteId: params.instituteId || '',
        batchId: params.batchId || '',
        status: safeStatus,
        createdAt: Date.now(),
      };

      await setDoc(doc(db, 'users', uid), newProfile);
      dataService.broadcastSync('users');

      sessionEstablishedRef.current = true;
      prevRoleRef.current = safeRole;
      setUser(cred.user);
      setUserProfile(newProfile);
      if (safeStatus === 'Active') {
        setLiveAuditActor({ userId: uid, user: newProfile.name, userRole: safeRole });
      } else {
        setLiveAuditActor(null);
      }

      recordSimpleAuditLog({
        action: 'create',
        module: 'security',
        collectionName: 'users',
        targetId: uid,
        targetLabel: newProfile.name,
        title: `নতুন অ্যাকাউন্ট নিবন্ধন: ${newProfile.name} (${safeRole} - ${safeStatus})`,
        actor: {
          userId: uid,
          user: newProfile.name,
          userRole: safeRole,
        },
      }).catch(() => {});

      attachUserDocListener(cred.user);
    } catch (err: any) {
      if (
        err?.code === 'auth/operation-not-allowed' ||
        err?.message?.includes('operation-not-allowed')
      ) {
        throw new Error(
          'Firebase Authentication-এ "Email/Password" সাইন-ইন পদ্ধতি বন্ধ রয়েছে। অনুগ্রহ করে Firebase Console > Authentication > Sign-in method-এ গিয়ে Email/Password সক্রিয় (Enable) করুন।'
        );
      }
      throw err;
    } finally {
      isRegisteringRef.current = false;
      setLoading(false);
    }
  };

  const signOut = async () => {
    detachUserDocListener();
    unsubscribeAllListeners();
    clearSessionAppCache();
    setLiveAuditActor(null);
    prevRoleRef.current = null;
    sessionEstablishedRef.current = false;
    bootstrappingUidRef.current = null;
    setSessionNotice(null);
    setPermissionError(false);
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
    setUser(null);
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    await verifyUserFromServer('manual');
  };

  const sendPasswordReset = async (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      throw new Error('অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা প্রদান করুন।');
    }
    try {
      await sendPasswordResetEmail(auth, clean);
    } catch (err: any) {
      console.warn('Password reset notice:', err);
      if (err.code === 'auth/user-not-found') {
        throw new Error('এই ইমেইলের সাথে সংযুক্ত কোনো অ্যাকাউন্ট পাওয়া যায়নি।');
      } else if (err.code === 'auth/invalid-email') {
        throw new Error('অকার্যকর ইমেইল ঠিকানা।');
      }
      throw new Error(
        err.message ||
          'পাসওয়ার্ড রিসেট লিংক পাঠাতে সমস্যা হয়েছে। কিছুক্ষণ পর পুনরায় চেষ্টা করুন।'
      );
    }
  };

  const authContextValue = useMemo(
    () => ({
      user,
      userProfile,
      loading,
      signIn,
      signInWithGoogle,
      quickLoginAsRole,
      signUp,
      signOut,
      refreshProfile,
      sendPasswordReset,
      permissionError,
      sessionToast,
      dismissSessionToast,
      showSessionToast,
      sessionNotice,
      clearSessionNotice,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      user,
      userProfile,
      loading,
      permissionError,
      sessionToast,
      sessionNotice,
    ]
  );

  return (
    <AuthContext.Provider value={authContextValue}>{children}</AuthContext.Provider>
  );
};
