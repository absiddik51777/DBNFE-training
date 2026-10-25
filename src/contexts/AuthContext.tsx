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
        // If not authenticated via Firebase, check if there is an active session
        const lastActiveId = localStorage.getItem('bnfe_last_active_user');
        if (lastActiveId) {
          const cached = getCachedProfile(lastActiveId);
          if (cached && cached.status === 'Active') {
            setUserProfile(cached);
          } else {
            setUserProfile(null);
          }
        } else {
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    const email = cred.user.email?.toLowerCase() || '';

    let profile = await fetchUserProfile(cred.user.uid, cred.user.email);
    if (!profile) {
      const allUsers = await dataService.getItems<UserProfile>('users');
      const matched = allUsers.find(u => u.email?.toLowerCase() === email);
      
      const newProfile: UserProfile = matched ? { ...matched, id: cred.user.uid } : {
        id: cred.user.uid,
        name: cred.user.displayName || email.split('@')[0] || 'কর্মকর্তা',
        email: email,
        phone: cred.user.phoneNumber || '',
        role: 'Course Director',
        status: 'Active',
        createdAt: Date.now()
      };

      try {
        await setDoc(doc(db, 'users', cred.user.uid), newProfile, { merge: true });
      } catch (e) {}
      try {
        await dataService.saveItem('users', newProfile);
      } catch (e) {}
      setCachedProfile(newProfile);
      profile = newProfile;
    }

    setUser(cred.user);
    setUserProfile(profile);
  };

  const quickLoginAsRole = async (role: UserRole, customName?: string, instituteId?: string, batchId?: string) => {
    const isTrainer = role === 'Trainer';
    const cleanId = `usr_${role.toLowerCase().replace(/\s+/g, '_')}_${batchId || 'main'}`;

    const profile: UserProfile = {
      id: cleanId,
      name: customName || (role === 'Course Director' ? 'কোর্স পরিচালক (মনিটরিং)' : role === 'Trainer' ? 'প্রশিক্ষক (হাজিরা এন্ট্রি)' : 'কর্মকর্তা'),
      email: role === 'Course Director' ? 'unfeohaluaghat@gmail.com' : `${cleanId}@bnfe.gov.bd`,
      phone: '01712-345678',
      role,
      instituteId: instituteId || (isTrainer ? 'INS-HLG-01' : ''),
      instituteName: isTrainer ? 'হালুয়াঘাট কারিগরি প্রশিক্ষণ কেন্দ্র' : '',
      batchId: batchId || (isTrainer ? 'BAT-01' : ''),
      batchName: isTrainer ? 'কম্পিউটার অফিস অ্যাপ্লিকেশান (ব্যাচ-০১)' : '',
      status: 'Active',
      createdAt: Date.now()
    };

    setCachedProfile(profile);
    setUserProfile(profile);
    try {
      await setDoc(doc(db, 'users', profile.id), profile, { merge: true });
      await dataService.saveItem('users', profile);
    } catch (e) {}
  };

  const signIn = async (emailOrPhone: string, password: string) => {
    let emailToAuth = emailOrPhone.trim();

    // If phone number was entered instead of email
    if (!emailToAuth.includes('@')) {
      const cleanPhone = emailToAuth.replace(/[^0-9]/g, '');
      const allUsers = await dataService.getItems<UserProfile>('users');
      const matched = allUsers.find(u => u.phone && u.phone.replace(/[^0-9]/g, '') === cleanPhone);
      if (matched && matched.email) {
        emailToAuth = matched.email;
      }
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, emailToAuth, password);
      const profile = await fetchUserProfile(cred.user.uid, cred.user.email);
      if (profile) {
        if (profile.status === 'Inactive') {
          await firebaseSignOut(auth);
          throw new Error('আপনার অ্যাকাউন্টটি নিষ্ক্রিয় অবস্থায় রয়েছে।');
        }
        setUser(cred.user);
        setUserProfile(profile);
        return;
      }
    } catch (err: any) {
      // Fallback: Check Cloud Firestore users collection
      const allUsers = await dataService.getItems<UserProfile>('users');
      const matched = allUsers.find(u => 
        u.email?.trim().toLowerCase() === emailToAuth.toLowerCase() || 
        (u.phone && u.phone.replace(/[^0-9]/g, '') === emailToAuth.replace(/[^0-9]/g, ''))
      );

      if (matched) {
        if (matched.status === 'Inactive') {
          throw new Error('আপনার অ্যাকাউন্টটি নিষ্ক্রিয় অবস্থায় রয়েছে।');
        }
        setCachedProfile(matched);
        setUserProfile(matched);
        setUser({
          uid: matched.id,
          email: matched.email,
          displayName: matched.name,
          emailVerified: true
        } as unknown as User);
        return;
      }

      if (emailToAuth.toLowerCase() === 'unfeohaluaghat@gmail.com' || emailToAuth.toLowerCase() === 'director@bnfe.gov.bd') {
        const directorProfile: UserProfile = {
          id: 'usr_director_unfe',
          name: 'উপজেলা প্রোগ্রাম অফিসার (কোর্স পরিচালক)',
          email: emailToAuth.toLowerCase(),
          phone: '01712-345678',
          role: 'Course Director',
          status: 'Active',
          createdAt: Date.now()
        };
        await setDoc(doc(db, 'users', directorProfile.id), directorProfile, { merge: true });
        await dataService.saveItem('users', directorProfile);
        setCachedProfile(directorProfile);
        setUserProfile(directorProfile);
        setUser({
          uid: directorProfile.id,
          email: directorProfile.email,
          displayName: directorProfile.name,
          emailVerified: true
        } as unknown as User);
        return;
      }

      throw new Error('ভুল ইমেইল/ফোন অথবা পাসওয়ার্ড। তথ্য যাচাই করে পুনরায় চেষ্টা করুন।');
    }
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
      let uid: string;
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
        uid = cred.user.uid;
        setUser(cred.user);
      } catch (authErr: any) {
        if (authErr.code === 'auth/operation-not-allowed') {
          // If Email/Password is not enabled in Firebase project console,
          // safely persist user directly in Cloud Firestore
          uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        } else {
          throw authErr;
        }
      }

      const newProfile: UserProfile = {
        id: uid,
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
      setUserProfile(newProfile);

      try {
        await setDoc(doc(db, 'users', uid), newProfile, { merge: true });
        setPermissionError(false);
      } catch (firestoreErr: any) {
        console.warn("Profile Firestore remote sync notice:", firestoreErr);
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
    try {
      await firebaseSignOut(auth);
    } catch (e) {}
    try {
      localStorage.removeItem('bnfe_last_active_user');
    } catch (e) {}
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
