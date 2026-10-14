import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  User, 
  signOut as firebaseSignOut, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';
import { dataService } from '../lib/dataService';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (emailOrPhone: string, password: string) => Promise<void>;
  signUp: (params: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: UserRole;
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

  const getCachedProfile = (uid: string): UserProfile | null => {
    try {
      const saved = localStorage.getItem(`bnfe_user_profile_${uid}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Could not read cached profile:", e);
    }
    return null;
  };

  const setCachedProfile = (profile: UserProfile) => {
    try {
      localStorage.setItem(`bnfe_user_profile_${profile.id}`, JSON.stringify(profile));
      localStorage.setItem(`bnfe_last_active_user`, profile.id);
      if (profile.phone && profile.email) {
        localStorage.setItem(`bnfe_phone_map_${profile.phone.trim()}`, profile.email.trim().toLowerCase());
      }
    } catch (e) {
      console.warn("Could not save cached profile:", e);
    }
  };

  const fetchUserProfile = async (uid: string, email?: string | null): Promise<UserProfile | null> => {
    // 1. Check local cache first for fast, non-blocking UI
    const cached = getCachedProfile(uid);

    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap && docSnap.exists()) {
        const p = { id: docSnap.id, ...docSnap.data() } as UserProfile;
        setCachedProfile(p);
        setPermissionError(false);
        return p;
      }
    } catch (err: any) {
      console.warn("Firestore profile fetch handled cleanly via cache:", err?.message || err);
      if (err?.message && err.message.includes('permission')) {
        setPermissionError(true);
      }
    }

    if (cached) return cached;

    // 2. Synthesize a clean active profile if authenticated
    if (auth.currentUser) {
      const fallback: UserProfile = {
        id: uid,
        name: auth.currentUser.displayName || (email ? email.split('@')[0] : 'কর্মকর্তা'),
        email: email || '',
        phone: '',
        role: 'Course Director',
        status: 'Active',
        createdAt: Date.now()
      };
      setCachedProfile(fallback);
      return fallback;
    }

    return null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (isRegisteringRef.current) {
          return;
        }

        const profile = await fetchUserProfile(currentUser.uid, currentUser.email);
        if (profile) {
          if (profile.status === 'Inactive') {
            await firebaseSignOut(auth);
            setUser(null);
            setUserProfile(null);
          } else {
            setUserProfile(profile);
          }
        } else {
          const defaultProf: UserProfile = {
            id: currentUser.uid,
            name: currentUser.displayName || currentUser.email?.split('@')[0] || 'ব্যবহারকারী',
            email: currentUser.email || '',
            phone: '',
            role: 'Course Director',
            status: 'Active',
            createdAt: Date.now(),
          };
          setCachedProfile(defaultProf);
          setUserProfile(defaultProf);
          try {
            await setDoc(doc(db, 'users', currentUser.uid), defaultProf, { merge: true });
          } catch (e) {
            console.warn("Profile Firestore sync notice:", e);
          }
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (emailOrPhone: string, password: string) => {
    let emailToAuth = emailOrPhone.trim();

    // If phone number was entered instead of email
    if (!emailToAuth.includes('@')) {
      const mappedEmail = localStorage.getItem(`bnfe_phone_map_${emailToAuth}`);
      if (mappedEmail) {
        emailToAuth = mappedEmail;
      } else {
        const cachedLastId = localStorage.getItem('bnfe_last_active_user');
        if (cachedLastId) {
          const cached = getCachedProfile(cachedLastId);
          if (cached && cached.phone === emailToAuth && cached.email) {
            emailToAuth = cached.email;
          }
        }
      }

      if (!emailToAuth.includes('@')) {
        throw new Error('ফোন নম্বর দিয়ে অ্যাকাউন্ট শনাক্ত করা যায়নি। অনুগ্রহ করে আপনার নিবন্ধিত ইমেইল ঠিকানা দিয়ে লগইন করুন। (Please sign in with your email address)');
      }
    }

    const cred = await signInWithEmailAndPassword(auth, emailToAuth, password);
    const profile = await fetchUserProfile(cred.user.uid, cred.user.email);
    if (!profile) {
      const fbProfile: UserProfile = {
        id: cred.user.uid,
        name: cred.user.displayName || emailToAuth.split('@')[0] || 'কর্মকর্তা',
        email: emailToAuth,
        phone: '',
        role: 'Course Director',
        status: 'Active',
        createdAt: Date.now()
      };
      setCachedProfile(fbProfile);
      setUser(cred.user);
      setUserProfile(fbProfile);
      return;
    }
    if (profile.status === 'Inactive') {
      await firebaseSignOut(auth);
      throw new Error('আপনার অ্যাকাউন্টটি নিষ্ক্রিয় অবস্থায় রয়েছে।');
    }
    setUser(cred.user);
    setUserProfile(profile);
  };

  const signUp = async (params: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: UserRole;
    instituteId?: string;
    batchId?: string;
  }) => {
    isRegisteringRef.current = true;
    const cleanEmail = params.email.trim().toLowerCase();

    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
      
      const newProfile: UserProfile = {
        id: cred.user.uid,
        name: params.name.trim(),
        email: cleanEmail,
        phone: params.phone.trim(),
        role: params.role,
        instituteId: params.instituteId || '',
        batchId: params.batchId || '',
        status: 'Active',
        createdAt: Date.now(),
      };

      setCachedProfile(newProfile);
      setUser(cred.user);
      setUserProfile(newProfile);

      try {
        await setDoc(doc(db, 'users', cred.user.uid), newProfile);
        setPermissionError(false);
      } catch (firestoreErr: any) {
        console.warn("Profile saved locally, Firestore remote sync pending rules:", firestoreErr);
      }

      try {
        await dataService.saveItem('users', newProfile);
      } catch (e) {
        console.warn("Could not save profile into dataService:", e);
      }
    } finally {
      isRegisteringRef.current = false;
      setLoading(false);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    if (auth.currentUser) {
      const p = await fetchUserProfile(auth.currentUser.uid, auth.currentUser.email);
      if (p) setUserProfile(p);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signIn, signUp, signOut, refreshProfile, permissionError }}>
      {children}
    </AuthContext.Provider>
  );
};
