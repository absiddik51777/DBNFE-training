import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  User, 
  signOut as firebaseSignOut, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';
import { dataService } from '../lib/dataService';
import { logActivity } from '../lib/firebase';

const SUPER_ADMIN_EMAILS = [
  'unfeohaluaghat@gmail.com',
  'absiddik5177@gmail.com'
];

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (emailOrPhone: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  quickLoginAsRole: (role: UserRole, customName?: string, instituteId?: string, batchId?: string) => Promise<void>;
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
  permissionError: boolean;
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
  permissionError: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);

  const isRegisteringRef = useRef(false);

  // Cached profile is strictly for fast UI display during auth verification; never used as proof of identity
  const getCachedProfile = (uid: string): UserProfile | null => {
    try {
      const saved = localStorage.getItem(`bnfe_cached_profile_${uid}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Could not read display cache:", e);
    }
    return null;
  };

  const setCachedProfile = (profile: UserProfile) => {
    try {
      localStorage.setItem(`bnfe_cached_profile_${profile.id}`, JSON.stringify(profile));
    } catch (e) {
      console.warn("Could not save display cache:", e);
    }
  };

  const clearCachedProfile = (uid?: string) => {
    try {
      if (uid) {
        localStorage.removeItem(`bnfe_cached_profile_${uid}`);
      }
      localStorage.removeItem('bnfe_last_active_user');
    } catch (e) {}
  };

  const fetchUserProfile = async (uid: string, email?: string | null): Promise<UserProfile | null> => {
    const cleanEmail = email?.trim().toLowerCase() || '';
    const isSuper = isSuperAdminEmail(cleanEmail);

    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap && docSnap.exists()) {
        const p = { id: docSnap.id, ...docSnap.data() } as UserProfile;
        
        // Ensure super admin always retains Course Director role and Active status
        if (isSuper && (p.role !== 'Course Director' || p.status !== 'Active')) {
          p.role = 'Course Director';
          p.status = 'Active';
          await setDoc(docRef, p, { merge: true });
        }

        setCachedProfile(p);
        setPermissionError(false);
        return p;
      }
    } catch (err: any) {
      console.warn("Firestore profile fetch notice:", err?.message || err);
      if (err?.message && err.message.includes('permission')) {
        setPermissionError(true);
      }
    }

    // If document does not exist yet in Firestore
    if (auth.currentUser) {
      // Recognized system director receives Course Director; all others receive safe 'Pending' role
      const defaultRole: UserRole = isSuper ? 'Course Director' : 'Pending';
      const defaultStatus: 'Active' | 'Pending Approval' = isSuper ? 'Active' : 'Pending Approval';

      const initialProfile: UserProfile = {
        id: uid,
        name: auth.currentUser.displayName || (cleanEmail ? cleanEmail.split('@')[0] : 'কর্মকর্তা'),
        email: cleanEmail,
        phone: auth.currentUser.phoneNumber || '',
        role: defaultRole,
        status: defaultStatus,
        createdAt: Date.now(),
      };

      try {
        await setDoc(doc(db, 'users', uid), initialProfile, { merge: true });
      } catch (e) {
        console.warn("Notice bootstrapping initial profile in Firestore:", e);
      }

      setCachedProfile(initialProfile);
      return initialProfile;
    }

    return null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        if (isRegisteringRef.current) {
          setLoading(false);
          return;
        }

        const profile = await fetchUserProfile(currentUser.uid, currentUser.email);
        if (profile) {
          if (profile.status === 'Inactive') {
            await firebaseSignOut(auth);
            clearCachedProfile(currentUser.uid);
            setUser(null);
            setUserProfile(null);
          } else {
            setUserProfile(profile);
          }
        } else {
          setUserProfile(null);
        }
      } else {
        // Strictly revoke application session if Firebase Authentication reports no active user
        clearCachedProfile();
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const email = cred.user.email?.toLowerCase() || '';

      const profile = await fetchUserProfile(cred.user.uid, email);
      if (profile?.status === 'Inactive') {
        await firebaseSignOut(auth);
        clearCachedProfile(cred.user.uid);
        throw new Error('আপনার অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে। অনুগ্রহ করে কোর্স পরিচালকের সাথে যোগাযোগ করুন।');
      }

      setUser(cred.user);
      setUserProfile(profile);
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed' || err?.message?.includes('operation-not-allowed')) {
        throw new Error(
          'Firebase Authentication-এ Google প্রোভাইডার বন্ধ রয়েছে। অনুগ্রহ করে Firebase Console > Authentication > Sign-in method-এ গিয়ে Google প্রোভাইডার সক্রিয় (Enable) করুন।'
        );
      }
      throw err;
    }
  };

  const quickLoginAsRole = async () => {
    // Deliberately disabled for zero-trust security
    throw new Error('নিরাপত্তা নীতির কারণে সরাসরি রোলে লগইন নিষ্ক্রিয় রাখা হয়েছে। অনুগ্রহ করে প্রমাণপত্র দিয়ে প্রবেশ করুন।');
  };

  const signIn = async (emailOrPhone: string, password: string) => {
    let emailToAuth = emailOrPhone.trim();

    // If phone number was entered, look up mapped email
    if (!emailToAuth.includes('@')) {
      const cleanPhone = emailToAuth.replace(/[^0-9]/g, '');
      const allUsers = await dataService.getItems<UserProfile>('users');
      const matched = allUsers.find(u => u.phone && u.phone.replace(/[^0-9]/g, '') === cleanPhone);
      if (matched && matched.email) {
        emailToAuth = matched.email;
      } else {
        throw new Error('প্রদত্ত মোবাইল নম্বরের সাথে সংযুক্ত কোনো অ্যাকাউন্ট পাওয়া যায়নি।');
      }
    }

    try {
      // Authenticate strictly with Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, emailToAuth, password);
      const profile = await fetchUserProfile(cred.user.uid, cred.user.email);
      
      if (profile) {
        if (profile.status === 'Inactive') {
          await firebaseSignOut(auth);
          clearCachedProfile(cred.user.uid);
          throw new Error('আপনার অ্যাকাউন্টটি নিষ্ক্রিয় অবস্থায় রয়েছে। অনুগ্রহ করে প্রশাসকের সাথে যোগাযোগ করুন।');
        }
        setUser(cred.user);
        setUserProfile(profile);
        return;
      }

      throw new Error('ব্যবহারকারীর প্রোফাইল পাওয়া যায়নি।');
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed' || err?.message?.includes('operation-not-allowed')) {
        throw new Error(
          'Firebase Authentication-এ "Email/Password" প্রোভাইডার সক্রিয় নেই। অনুগ্রহ করে Firebase Console > Authentication > Sign-in method-এ গিয়ে Email/Password সক্রিয় (Enable) করুন অথবা Google দিয়ে লগইন করুন।'
        );
      }
      throw err;
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
    const cleanEmail = params.email.trim().toLowerCase();

    // Check if Course Director has allowed public self-registration
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

    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
      const uid = cred.user.uid;
      const isSuper = isSuperAdminEmail(cleanEmail);

      // Safe default role: New public accounts always receive 'Pending' role and 'Pending Approval' status
      const safeRole: UserRole = isSuper ? 'Course Director' : 'Pending';
      const safeStatus: 'Active' | 'Pending Approval' = isSuper ? 'Active' : 'Pending Approval';

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

      setCachedProfile(newProfile);
      setUser(cred.user);
      setUserProfile(newProfile);

      // Write strictly according to Firestore security rules
      await setDoc(doc(db, 'users', uid), newProfile);
      
      logActivity(
        uid,
        newProfile.name,
        `নতুন অ্যাকাউন্ট নিবন্ধন সম্পন্ন (${safeRole} - ${safeStatus})`,
        'Auth',
        uid,
        `ইমেইল: ${cleanEmail}, ফোন: ${params.phone}`
      );
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed' || err?.message?.includes('operation-not-allowed')) {
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
    try {
      await firebaseSignOut(auth);
    } catch (e) {}
    clearCachedProfile();
    setUser(null);
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    if (auth.currentUser) {
      const p = await fetchUserProfile(auth.currentUser.uid, auth.currentUser.email);
      if (p) setUserProfile(p);
    }
  };

  const authContextValue = useMemo(() => ({
    user, 
    userProfile, 
    loading, 
    signIn, 
    signInWithGoogle,
    quickLoginAsRole,
    signUp, 
    signOut, 
    refreshProfile, 
    permissionError 
  }), [
    user, 
    userProfile, 
    loading, 
    permissionError
  ]);

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};
