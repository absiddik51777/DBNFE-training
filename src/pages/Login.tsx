import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Institute, UserRole } from '../types';
import { dataService } from '../lib/dataService';
import { 
  Building2, 
  Lock, 
  Mail, 
  Phone, 
  User as UserIcon, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';

const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const { signIn, signUp, userProfile } = useAuth();
  const navigate = useNavigate();

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Course Director');
  const [regInstituteId, setRegInstituteId] = useState('');

  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch real institutes for Trainer assignment
  useEffect(() => {
    const fetchInsts = async () => {
      try {
        const list = await dataService.getItems<Institute>('institutes');
        setInstitutes(list);
        if (list.length > 0 && !regInstituteId) {
          setRegInstituteId(list[0].id);
        }
      } catch (err) {
        setInstitutes([]);
      }
    };
    fetchInsts();
  }, []);

  // Redirect if logged in
  useEffect(() => {
    if (userProfile) {
      navigate('/', { replace: true });
    }
  }, [userProfile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await signIn(loginIdentifier, loginPassword);
      navigate('/');
    } catch (err: any) {
      console.warn("Login attempt notice:", err?.message || err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('ভুল ইমেইল/ফোন অথবা পাসওয়ার্ড। আবার চেষ্টা করুন। (Invalid email or password)');
      } else if (err.code === 'auth/too-many-requests') {
        setError('অতিরিক্ত প্রচেষ্টার কারণে সাময়িক ব্লক। কিছুক্ষণ পর চেষ্টা করুন।');
      } else {
        setError(err.message || 'লগইন ব্যর্থ হয়েছে। তথ্য যাচাই করুন।');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (regPassword.length < 6) {
      setError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে। (Password must be at least 6 characters)');
      return;
    }

    if (regPhone.trim().length < 11) {
      setError('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন। (Enter a valid 11-digit mobile number)');
      return;
    }

    setLoading(true);
    try {
      await signUp({
        name: regName,
        email: regEmail,
        password: regPassword,
        phone: regPhone,
        role: regRole,
        instituteId: regRole === 'Trainer' ? regInstituteId : undefined,
      });
      setSuccessMsg('নিবন্ধন সফল হয়েছে! সিস্টেমে প্রবেশ করা হচ্ছে...');
      setTimeout(() => {
        navigate('/');
      }, 800);
    } catch (err: any) {
      console.warn("Register attempt notice:", err?.message || err);
      if (err.code === 'auth/email-already-in-use') {
        setError('এই ইমেইলটি ইতিমধ্যে নিবন্ধিত আছে। লগইন করার চেষ্টা করুন। (Email is already registered)');
      } else if (err.code === 'auth/invalid-email') {
        setError('সঠিক ইমেইল ঠিকানা প্রদান করুন। (Invalid email format)');
      } else {
        setError(err.message || 'নিবন্ধন ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white">
      {/* Header Banner */}
      <div className="w-full max-w-md text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 text-white rounded-2xl shadow-lg mb-3 shadow-emerald-600/20">
          <Building2 size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
          উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE)
        </h1>
        <p className="text-sm font-medium text-slate-600 mt-1">
          ঝরে পড়া কিশোর-কিশোরীদের বৃত্তিমূলক দক্ষতা প্রশিক্ষণ ব্যবস্থাপনা
        </p>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200 overflow-hidden">
        {/* Switcher Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-1.5">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              !isRegister
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            লগইন (Sign In)
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              isRegister
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            নতুন নিবন্ধন (Register)
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2.5 text-red-700 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5 text-emerald-800 text-sm">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {!isRegister ? (
            /* Login Form */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  ইমেইল বা মোবাইল নম্বর (Email or Phone)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. director@bnfe.gov.bd বা 017xxxxxxxx"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition"
                  />
                  <Mail className="absolute left-3.5 top-3 text-slate-400" size={17} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  পাসওয়ার্ড (Password)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition"
                  />
                  <Lock className="absolute left-3.5 top-3 text-slate-400" size={17} />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md shadow-emerald-600/25 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 text-sm"
              >
                {loading ? (
                  <span>প্রবেশ করা হচ্ছে...</span>
                ) : (
                  <>
                    <span>লগইন করুন (Login)</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Notice to new users */}
              <div className="pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500">
                  এখনো কোনো অ্যাকাউন্ট নেই?{' '}
                  <button
                    type="button"
                    onClick={() => setIsRegister(true)}
                    className="text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    নতুন নিবন্ধন করুন
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* Registration Form */
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  পূর্ণ নাম (Full Name) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="আপনার পূর্ণ নাম লিখুন"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                  <UserIcon className="absolute left-3.5 top-2.5 text-slate-400" size={17} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  ইমেইল (Email) *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="name@bnfe.gov.bd"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                  <Mail className="absolute left-3.5 top-2.5 text-slate-400" size={17} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  মোবাইল নম্বর (Phone Number) *
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                  <Phone className="absolute left-3.5 top-2.5 text-slate-400" size={17} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  পাসওয়ার্ড (Password - Min 6 chars) *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                  <Lock className="absolute left-3.5 top-2.5 text-slate-400" size={17} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  পদবী / ভূমিকা (User Role) *
                </label>
                <div className="relative">
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm font-medium"
                  >
                    <option value="Course Director">Course Director (কোর্স পরিচালক - সর্বময় ক্ষমতা)</option>
                    <option value="FMA">FMA (ফিল্ড মনিটরিং অ্যাসোসিয়েট)</option>
                    <option value="Trainer">Trainer (প্রশিক্ষক)</option>
                  </select>
                  <ShieldCheck className="absolute left-3.5 top-2.5 text-slate-400" size={17} />
                </div>
              </div>

              {regRole === 'Trainer' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    নির্ধারিত প্রতিষ্ঠান (Assigned Institute)
                  </label>
                  <select
                    value={regInstituteId}
                    onChange={(e) => setRegInstituteId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  >
                    {institutes.length === 0 ? (
                      <option value="">প্রতিষ্ঠান এখনও তৈরি করা হয়নি (পরে সংযুক্ত করা যাবে)</option>
                    ) : (
                      institutes.map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md shadow-emerald-600/25 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all disabled:opacity-50 text-sm flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <span>নিবন্ধন তৈরি হচ্ছে...</span>
                ) : (
                  <>
                    <span>নিবন্ধন সম্পন্ন করুন (Complete Registration)</span>
                    <CheckCircle2 size={16} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6 text-center text-xs text-slate-500">
        বাংলাদেশ উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE) • প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়
      </div>
    </div>
  );
};

export default Login;
