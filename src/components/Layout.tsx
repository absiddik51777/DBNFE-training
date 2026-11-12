import React, { useState, useMemo } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Building2, 
  Wrench, 
  Users, 
  Layers, 
  CalendarCheck, 
  CalendarDays,
  FileText, 
  Award, 
  BarChart, 
  Settings, 
  LogOut,
  Menu,
  X,
  UserCheck,
  Shield,
  ShieldCheck,
  GraduationCap,
  BookOpen
} from 'lucide-react';

import { usePermissions } from '../contexts/PermissionsContext';
import { SHOW_CALENDAR_MODULES } from '../config/features';
import { MobileBottomNav } from './navigation/MobileBottomNav';
import { MobileMoreMenu } from './navigation/MobileMoreMenu';

const Layout: React.FC = () => {
  const { userProfile, signOut, permissionError } = useAuth();
  const { canViewPage, isCourseDirector } = usePermissions();
  const location = useLocation();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [dismissPermNotice, setDismissPermNotice] = useState(false);

  const isTrainer = userProfile?.role === 'Trainer';

  const baseMenuItems = useMemo(() => {
    const items = [];

    if (isTrainer) {
      items.push({ 
        path: '/trainer-dashboard', 
        name: 'প্রশিক্ষক ড্যাশবোর্ড', 
        sub: 'Trainer Dashboard', 
        icon: <LayoutDashboard size={20} /> 
      });
    } else {
      items.push({ 
        path: '/', 
        name: 'সার্বিক ড্যাশবোর্ড', 
        sub: 'Overview Dashboard', 
        icon: <LayoutDashboard size={20} /> 
      });
      // Course Director and FMA can also access Trainer Dashboard to inspect any batch
      items.push({ 
        path: '/trainer-dashboard', 
        name: 'প্রশিক্ষক ড্যাশবোর্ড', 
        sub: 'Trainer Dashboard', 
        icon: <UserCheck size={20} /> 
      });
    }

    items.push(
      { path: '/institutes', name: 'প্রতিষ্ঠান', sub: 'Institutes', icon: <Building2 size={20} /> },
      { path: '/trades', name: 'ট্রেড', sub: 'Trades', icon: <Wrench size={20} /> }
    );

    if (SHOW_CALENDAR_MODULES) {
      items.push({ path: '/trade-calendar', name: 'ট্রেড কারিকুলাম', sub: 'Trade Curriculum', icon: <GraduationCap size={20} /> });
    }

    items.push(
      { path: '/batches', name: 'ব্যাচ', sub: 'Batches', icon: <Layers size={20} /> },
      { path: '/trainees', name: 'প্রশিক্ষণার্থী', sub: 'Trainees', icon: <Users size={20} /> }
    );

    if (SHOW_CALENDAR_MODULES) {
      items.push({ path: '/shikhon-calendar', name: 'ব্যাচ শিখন ক্যালেন্ডার', sub: 'Batch Calendar', icon: <BookOpen size={20} /> });
    }

    items.push(
      { path: '/attendance', name: 'দৈনিক হাজিরা', sub: 'Daily Attendance', icon: <CalendarCheck size={20} /> },
      { path: '/attendance-sheet', name: 'হাজিরা শিট', sub: 'Attendance Sheet', icon: <CalendarDays size={20} /> },
      { path: '/exams', name: 'পরীক্ষা', sub: 'Exams', icon: <FileText size={20} /> },
      { path: '/results', name: 'ফলাফল', sub: 'Results', icon: <BarChart size={20} /> },
      { path: '/reports', name: 'প্রতিবেদন', sub: 'Reports', icon: <FileText size={20} /> },
      { path: '/certificates', name: 'সার্টিফিকেট', sub: 'Certificates', icon: <Award size={20} /> },
      { path: '/users', name: 'ব্যবহারকারী', sub: 'Users', icon: <UserCheck size={20} /> }
    );

    // Course Director Exclusive Tools (BRN verification, Roles & Permissions)
    if (isCourseDirector) {
      items.push({ 
        path: '/brn-verification', 
        name: 'BRN verification', 
        sub: 'জন্ম নিবন্ধন যাচাই', 
        icon: <ShieldCheck size={20} /> 
      });
      items.push({ path: '/roles', name: 'রোল ও পারমিশন', sub: 'Roles & Perms', icon: <Shield size={20} /> });
    }

    // Settings
    items.push({ path: '/settings', name: 'সেটিংস', sub: 'Settings', icon: <Settings size={20} /> });

    return items;
  }, [isTrainer, isCourseDirector]);

  // Filter menu items dynamically according to role's page view permissions
  const menuItems = baseMenuItems.filter(item => canViewPage(item.path));

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'Course Director':
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">কোর্স পরিচালক</span>;
      case 'FMA':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">FMA</span>;
      case 'Trainer':
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">প্রশিক্ষক</span>;
      default:
        return role ? <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">{role}</span> : null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row antialiased">
      {/* Desktop and Large Tablet Sidebar (Unchanged on Desktop, Hidden on Mobile) */}
      <aside 
        className="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen lg:shrink-0 w-72 bg-slate-900 text-white justify-between shadow-none z-30"
      >
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Header & Logo */}
          <div className="h-20 px-6 flex items-center justify-between border-b border-slate-800 bg-slate-950/60 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <GraduationCap size={24} />
              </div>
              <div>
                <span className="font-bold text-lg text-white tracking-wide block">BNFE ট্রেইনিং</span>
                <span className="text-[11px] text-emerald-400 font-medium block">উপানুষ্ঠানিক শিক্ষা ব্যুরো</span>
              </div>
            </div>
          </div>

          {/* User quick card in sidebar */}
          <div className="p-4 mx-4 my-3 rounded-xl bg-slate-800/80 border border-slate-700/60 shrink-0">
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

          {/* Nav links: flex-1 takes exact remaining height, smoothly scrollable */}
          <nav className="flex-1 min-h-0 px-3 py-1 space-y-1 overflow-y-auto overscroll-contain">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
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
        <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-950/40">
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
            {/* Mobile Native App Branding */}
            <div className="flex items-center space-x-2.5 lg:hidden">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                <GraduationCap size={20} />
              </div>
              <div className="leading-tight">
                <span className="font-bold text-slate-900 text-sm block tracking-tight">BNFE ট্রেইনিং</span>
                <span className="text-[10px] text-emerald-700 font-semibold block">উপানুষ্ঠানিক শিক্ষা ব্যুরো</span>
              </div>
            </div>

            {/* Desktop Program Title */}
            <div className="hidden lg:block text-slate-700 font-semibold text-sm">
              ঝরে পড়া শিক্ষার্থীদের দক্ষতা উন্নয়ন প্রশিক্ষণ কর্মসূচি (Class 8 Dropout Program)
            </div>
          </div>

          <div className="flex items-center space-x-2.5 sm:space-x-3">
            {getRoleBadge(userProfile?.role)}
            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
            <div className="text-right hidden sm:block">
              <span className="block text-xs font-semibold text-slate-800">{userProfile?.name}</span>
              <span className="block text-[11px] text-slate-500">{userProfile?.phone}</span>
            </div>
            <button
              onClick={() => signOut()}
              title="লগআউট"
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition active:scale-95"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page Container: pb-24 ensures page content is never hidden behind mobile bottom nav */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 overflow-y-auto pb-24 lg:pb-8">
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

      {/* Mobile Native Bottom Navigation */}
      <MobileBottomNav 
        onOpenMore={() => setMobileMoreOpen(true)} 
        isMoreOpen={mobileMoreOpen} 
      />

      {/* Mobile More Modules Sheet / Menu */}
      <MobileMoreMenu 
        isOpen={mobileMoreOpen} 
        onClose={() => setMobileMoreOpen(false)} 
      />
    </div>
  );
};

export default Layout;
