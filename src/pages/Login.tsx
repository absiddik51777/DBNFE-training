import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useNavigate } from 'react-router-dom';
import { Institute, UserRole, Batch, Trade } from '../types';
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
  ArrowRight,
  Sparkles
} from 'lucide-react';

const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const { signIn, signInWithGoogle, signUp, userProfile } = useAuth();
  const { getDefaultLandingRoute } = usePermissions();
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
  const [regBatchId, setRegBatchId] = useState('');

  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch institutes, batches, trades for Trainer assignment
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [instList, batchList, tradeList] = await Promise.all([
          dataService.getItems<Institute>('institutes'),
          dataService.getItems<Batch>('batches'),
          dataService.getItems<Trade>('trades')
        ]);
        setInstitutes(instList);
        setBatches(batchList);
        setTrades(tradeList);
        if (instList.length > 0 && !regInstituteId) {
          setRegInstituteId(instList[0].id);
          const matching = batchList.filter(b => b.instituteId === instList[0].id);
          if (matching.length > 0) {
            setRegBatchId(matching[0].id);
          }
        }
      } catch (err) {
        setInstitutes([]);
        setBatches([]);
        setTrades([]);
      }
    };
    fetchData();
  }, []);

  // Redirect if logged in to role's authorized landing page (Trainers -> Trainer Dashboard, Others -> Overview Dashboard)
  useEffect(() => {
    if (userProfile) {
      if (userProfile.role === 'Trainer') {
        navigate('/trainer-dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [userProfile]);

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccessMsg('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.warn("Google sign in notice:", err?.message || err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google সাইন-ইন উইন্ডো বন্ধ করা হয়েছে।');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Ignored
      } else if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        setError('ফায়ারবেস কনসোলে Google সাইন-ইন সক্রিয় (Enabled) করা নেই।');
      } else {
        setError(err.message || 'Google দিয়ে লগইন ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await signIn(loginIdentifier, loginPassword);
    } catch (err: any) {
      console.warn("Login attempt notice:", err?.message || err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('ভুল ইমেইল/ফোন অথবা পাসওয়ার্ড। আবার চেষ্টা করুন।');
      } else if (err.code === 'auth/too-many-requests') {
        setError('অতিরিক্ত প্রচেষ্টার কারণে সাময়িক ব্লক। কিছুক্ষণ পর চেষ্টা করুন।');
      } else if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        setError('ফায়ারবেস কনসোলে Email/Password সাইন-ইন পদ্ধতি সক্রিয় (Enabled) করা নেই।');
      } else {
        setError(err.message || 'লগইন ব্যর্থ হয়েছে। তথ্য যাচাই করে পুনরায় চেষ্টা করুন।');
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
        requestedRole: regRole,
        instituteId: regRole === 'Trainer' ? regInstituteId : undefined,
        batchId: regRole === 'Trainer' ? regBatchId : undefined,
      });
      setSuccessMsg('নিবন্ধন সফল হয়েছে! আপনার অ্যাকাউন্টটি কোর্স পরিচালকের অনুমোদনের জন্য অপেক্ষমাণ রয়েছে।');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1000);
    } catch (err: any) {
      console.warn("Register attempt notice:", err?.message || err);
      if (err.code === 'auth/email-already-in-use') {
        setError('এই ইমেইলটি ইতিমধ্যে নিবন্ধিত আছে। লগইন করার চেষ্টা করুন।');
      } else if (err.code === 'auth/invalid-email') {
        setError('সঠিক ইমেইল ঠিকানা প্রদান করুন।');
      } else if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        setError('ফায়ারবেস কনসোলে Email/Password সাইন-ইন পদ্ধতি সক্রিয় (Enabled) করা নেই।');
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
        {/* Top 1-Click Google Sign-In */}
        <div className="p-5 pb-0">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 font-bold rounded-xl border border-slate-300 shadow-xs flex items-center justify-center space-x-3 transition disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span className="text-xs sm:text-sm">
              {googleLoading ? 'Google দিয়ে সংযোগ হচ্ছে...' : 'Google দিয়ে সরাসরি প্রবেশ করুন'}
            </span>
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-semibold uppercase">অথবা ইমেইল / পাসওয়ার্ড</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>
        </div>

        {/* Switcher Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-1.5 mx-5 rounded-xl">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              !isRegister
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            লগইন (Sign In)
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              isRegister
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            নতুন নিবন্ধন (Register)
          </button>
        </div>

        <div className="p-5 sm:p-6 pt-4">
          {error && (() => {
            const isOperationNotAllowed = 
              error.toLowerCase().includes('operation-not-allowed') ||
              error.includes('auth/operation-not-allowed') ||
              error.includes('সক্রিয় (Enabled) করা নেই') ||
              error.includes('প্রোভাইডার বন্ধ');

            return (
              <div className={`mb-4 p-3.5 rounded-xl border text-xs sm:text-sm ${
                isOperationNotAllowed ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <div className="flex items-start space-x-2.5">
                  <AlertCircle size={18} className={`shrink-0 mt-0.5 ${isOperationNotAllowed ? 'text-amber-600' : 'text-red-600'}`} />
                  <div className="flex-1">
                    <p className="font-semibold">{error}</p>
                    {isOperationNotAllowed && (
                      <div className="mt-2.5 pt-2.5 border-t border-amber-200 text-[11px] text-amber-800 space-y-2">
                        <p className="font-bold text-amber-950">🛠️ সমাধান নির্দেশিকা (Firebase Console Setup):</p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-700 leading-relaxed">
                          <li>নিচের লিঙ্কে ক্লিক করে Firebase কনসোলে যান (Project: <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">feisty-utility-6mn89</code>)</li>
                          <li><strong>Authentication &gt; Sign-in method</strong>-এ যান</li>
                          <li><strong>Email/Password</strong> অথবা <strong>Google</strong> প্রোভাইডার নির্বাচন করে <strong>Enable</strong> চালু করুন এবং <strong>Save</strong> করুন।</li>
                        </ol>
                        <div className="pt-1">
                          <a
                            href="https://console.firebase.google.com/project/feisty-utility-6mn89/authentication/providers"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition shadow-xs"
                          >
                            <span>Firebase Authentication কনসোল খুলুন</span>
                            <ArrowRight size={13} />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {successMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5 text-emerald-800 text-xs sm:text-sm">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {!isRegister ? (
            /* Login Form */
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  ইমেইল বা মোবাইল নম্বর (Email or Phone)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. director@bnfe.gov.bd বা 017xxxxxxxx"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-xs sm:text-sm transition"
                  />
                  <Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  পাসওয়ার্ড (Password)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-xs sm:text-sm transition"
                  />
                  <Lock className="absolute left-3 top-2.5 text-slate-400" size={16} />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full mt-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs shadow-emerald-600/25 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 text-xs sm:text-sm cursor-pointer"
              >
                {loading ? (
                  <span>যাচাই হচ্ছে...</span>
                ) : (
                  <>
                    <span>লগইন করুন (Login)</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Registration Form */
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-0.5">
                  পূর্ণ নাম (Full Name) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="আপনার পূর্ণ নাম লিখুন"
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-xs"
                  />
                  <UserIcon className="absolute left-3 top-2 text-slate-400" size={15} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-0.5">
                  ইমেইল (Email) *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="name@bnfe.gov.bd"
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-xs"
                  />
                  <Mail className="absolute left-3 top-2 text-slate-400" size={15} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-0.5">
                  মোবাইল নম্বর (Phone Number) *
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="01712-345678"
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-xs"
                  />
                  <Phone className="absolute left-3 top-2 text-slate-400" size={15} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-0.5">
                  পাসওয়ার্ড (Password) *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="কমপক্ষে ৬ অক্ষর"
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-xs"
                  />
                  <Lock className="absolute left-3 top-2 text-slate-400" size={15} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-0.5">
                  আবেদনকৃত দায়িত্ব (Requested Designation) *
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-xs"
                >
                  <option value="Trainer">প্রশিক্ষক (Trainer - হাজিরা ও মূল্যায়ন)</option>
                  <option value="FMA">ফিল্ড মনিটরিং অফিসার (FMA)</option>
                  <option value="Staff">সাধারণ কর্মকর্তা (Field Staff)</option>
                </select>
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/70 p-2 rounded-lg mt-1.5 leading-relaxed">
                  নিরাপত্তা নির্দেশিকা: নতুন নিবন্ধিত সকল অ্যাকাউন্ট প্রাথমিক অবস্থায় 'Pending Approval' থাকবে এবং কোর্স পরিচালক কর্তৃক যাচাই ও চূড়ান্ত ভূমিকা বরাদ্দ সাপেক্ষে পোর্টাল সক্রিয় হবে।
                </p>
              </div>

              {regRole === 'Trainer' && (
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      প্রশিক্ষণ কেন্দ্র (Training Center) *
                    </label>
                    <select
                      value={regInstituteId}
                      onChange={(e) => {
                        const newInstId = e.target.value;
                        setRegInstituteId(newInstId);
                        const matching = batches.filter(b => b.instituteId === newInstId);
                        if (matching.length > 0) {
                          setRegBatchId(matching[0].id);
                        } else {
                          setRegBatchId('');
                        }
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    >
                      {institutes.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      নির্ধারিত ব্যাচ (Assigned Batch) *
                    </label>
                    <select
                      value={regBatchId}
                      onChange={(e) => setRegBatchId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    >
                      {batches
                        .filter(b => !regInstituteId || b.instituteId === regInstituteId)
                        .map(b => {
                          const tradeName = trades.find(t => t.id === b.tradeId)?.name;
                          return (
                            <option key={b.id} value={b.id}>
                              {b.name} {tradeName ? `(${tradeName})` : ''}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full mt-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs shadow-emerald-600/25 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all disabled:opacity-50 text-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                {loading ? (
                  <span>নিবন্ধন তৈরি হচ্ছে...</span>
                ) : (
                  <>
                    <span>নিবন্ধন সম্পন্ন করুন (Register)</span>
                    <CheckCircle2 size={15} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-5 text-center text-xs text-slate-500">
        বাংলাদেশ উপানুষ্ঠানিক শিক্ষা ব্যুরো (BNFE) • প্রাথমিক ও গণশিক্ষা মন্ত্রণালয়
      </div>
    </div>
  );
};

export default Login;
