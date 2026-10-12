import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Building2, 
  Wrench, 
  Users, 
  Layers, 
  CalendarCheck, 
  FileText, 
  Award, 
  BarChart, 
  Settings, 
  LogOut,
  Menu,
  X,
  UserCheck,
  Shield,
  GraduationCap
} from 'lucide-react';

const Layout: React.FC = () => {
  const { userProfile, signOut, permissionError } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dismissPermNotice, setDismissPermNotice] = useState(false);

  const menuItems = [
    { path: '/', name: 'ড্যাশবোর্ড', sub: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/institutes', name: 'প্রতিষ্ঠান', sub: 'Institutes', icon: <Building2 size={20} /> },
    { path: '/trades', name: 'ট্রেড', sub: 'Trades', icon: <Wrench size={20} /> },
    { path: '/batches', name: 'ব্যাচ', sub: 'Batches', icon: <Layers size={20} /> },
    { path: '/trainees', name: 'প্রশিক্ষণার্থী', sub: 'Trainees', icon: <Users size={20} /> },
    { path: '/attendance', name: 'উপস্থিতি', sub: 'Attendance', icon: <CalendarCheck size={20} /> },
    { path: '/exams', name: 'পরীক্ষা', sub: 'Exams', icon: <FileText size={20} /> },
    { path: '/results', name: 'ফলাফল', sub: 'Results', icon: <BarChart size={20} /> },
    { path: '/reports', name: 'প্রতিবেদন', sub: 'Reports', icon: <FileText size={20} /> },
    { path: '/certificates', name: 'সার্টিফিকেট', sub: 'Certificates', icon: <Award size={20} /> },
  ];

  // User management visible for Course Director and FMA
  const showUserMgmt = userProfile?.role === 'Course Director' || userProfile?.role === 'FMA';
  if (showUserMgmt) {
    menuItems.push({ path: '/users', name: 'ব্যবহারকারী', sub: 'Users', icon: <UserCheck size={20} /> });
  }

  // Settings
  menuItems.push({ path: '/settings', name: 'সেটিংস', sub: 'Settings', icon: <Settings size={20} /> });

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'Course Director':
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">কোর্স পরিচালক</span>;
      case 'FMA':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">FMA</span>;
      case 'Trainer':
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">প্রশিক্ষক</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row antialiased">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col justify-between transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Header & Logo */}
          <div className="h-20 px-6 flex items-center justify-between border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <GraduationCap size={24} />
              </div>
              <div>
                <span className="font-bold text-lg text-white tracking-wide block">BNFE ট্রেইনিং</span>
                <span className="text-[11px] text-emerald-400 font-medium block">উপানুষ্ঠানিক শিক্ষা ব্যুরো</span>
              </div>
            </div>
            <button 
              className="lg:hidden text-slate-400 hover:text-white p-1"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={22} />
            </button>
          </div>

          {/* User quick card in sidebar */}
          <div className="p-4 mx-4 my-4 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
                {userProfile?.name?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="font-semibold text-sm text-slate-100 truncate">{userProfile?.name}</p>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <Shield size={12} className="text-emerald-400 shrink-0" />
                  <span className="text-xs text-slate-400 truncate">{userProfile?.role}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="px-3 space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                    <span>{item.name}</span>
                  </div>
                  <span className={`text-[10px] ${isActive ? 'text-emerald-100' : 'text-slate-500'}`}>{item.sub}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Logout bottom button */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-sm font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors border border-red-900/40"
          >
            <LogOut size={18} />
            <span>লগআউট (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu size={22} />
            </button>
            <div className="hidden sm:block text-slate-700 font-semibold text-sm">
              ঝরে পড়া শিক্ষার্থীদের দক্ষতা উন্নয়ন প্রশিক্ষণ কর্মসূচি (Class 8 Dropout Program)
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {getRoleBadge(userProfile?.role)}
            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
            <div className="text-right hidden sm:block">
              <span className="block text-xs font-semibold text-slate-800">{userProfile?.name}</span>
              <span className="block text-[11px] text-slate-500">{userProfile?.phone}</span>
            </div>
            <button
              onClick={() => signOut()}
              title="লগআউট"
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {permissionError && !dismissPermNotice && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start justify-between gap-3 shadow-xs">
              <div className="space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-amber-800 text-sm">
                  <span>ফায়ারবেস ডেটাবেস পারমিশন সংক্রান্ত নির্দেশনা (Firestore Rules Note):</span>
                </div>
                <p className="text-amber-700">
                  আপনার ফায়ারবেস কনসোলে Firestore Database তৈরি বা Rules আপডেট না থাকলে তথ্য লোড/সংরক্ষণ ব্যাহত হতে পারে। ফায়ারবেস কনসোলের <b>Firestore Database &gt; Rules</b> ট্যাবে <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">allow read, write: if request.auth != null;</code> নিয়ম নিশ্চিত করুন।
                </p>
              </div>
              <button
                onClick={() => setDismissPermNotice(true)}
                className="text-amber-600 hover:text-amber-800 font-bold p-1 shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
