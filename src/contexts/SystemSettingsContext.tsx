import React, { createContext, useContext, useEffect, useState } from 'react';
import { SystemSettings } from '../types';
import { dataService, DEFAULT_SYSTEM_SETTINGS } from '../lib/dataService';
import { logActivity } from '../lib/firebase';
import { useAuth } from './AuthContext';

interface SystemSettingsContextType {
  settings: SystemSettings;
  loading: boolean;
  isDeletionAllowed: boolean;
  updateSettings: (updates: Partial<SystemSettings>) => Promise<SystemSettings>;
  toggleDataDeletion: (enabled?: boolean) => Promise<boolean>;
  deleteAttendanceForBatchAndDate: (batchId: string, date: string) => Promise<number>;
  deleteAllAttendance: (batchId?: string) => Promise<number>;
  deleteAllTrainees: (options?: { batchId?: string; deleteAttendanceToo?: boolean }) => Promise<{ deletedTrainees: number; deletedAttendance: number }>;
  deleteAllExamsAndMarks: (batchId?: string) => Promise<{ deletedExams: number; deletedMarks: number }>;
  deleteAllInstitutes: () => Promise<number>;
  deleteAllTrades: () => Promise<number>;
  deleteAllBatches: () => Promise<number>;
  deleteInstitute: (id: string) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  deleteBatch: (id: string, cascade?: boolean) => Promise<void>;
  purgeAllSystemData: (options?: { keepInstitutesAndTrades?: boolean; keepLogs?: boolean }) => Promise<Record<string, number>>;
}

const SystemSettingsContext = createContext<SystemSettingsContextType>({
  settings: DEFAULT_SYSTEM_SETTINGS,
  loading: true,
  isDeletionAllowed: false,
  updateSettings: async () => DEFAULT_SYSTEM_SETTINGS,
  toggleDataDeletion: async () => false,
  deleteAttendanceForBatchAndDate: async () => 0,
  deleteAllAttendance: async () => 0,
  deleteAllTrainees: async () => ({ deletedTrainees: 0, deletedAttendance: 0 }),
  deleteAllExamsAndMarks: async () => ({ deletedExams: 0, deletedMarks: 0 }),
  deleteAllInstitutes: async () => 0,
  deleteAllTrades: async () => 0,
  deleteAllBatches: async () => 0,
  deleteInstitute: async () => {},
  deleteTrade: async () => {},
  deleteBatch: async () => {},
  purgeAllSystemData: async () => ({})
});

export const SystemSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem('bnfe_system_settings');
      if (saved) return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {}
    return DEFAULT_SYSTEM_SETTINGS;
  });
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    // 1. Initial fetch from Firestore
    dataService.getSystemSettings().then(s => {
      setSettings(s);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // 2. Real-time subscription to settings changes
    const unsubscribe = dataService.subscribeSystemSettings((newSettings) => {
      setSettings(newSettings);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateSettings = async (updates: Partial<SystemSettings>): Promise<SystemSettings> => {
    const updated = await dataService.saveSystemSettings(updates);
    setSettings(updated);

    if (userProfile) {
      const deletionStatusChanged = updates.allowDataDeletion !== undefined;
      await logActivity(
        userProfile.id || '',
        userProfile.name || 'User',
        deletionStatusChanged 
          ? `সিস্টেম ডাটা ডিলিট কন্ট্রোল পরিবর্তিত: ${updates.allowDataDeletion ? 'অনুমতি সক্রিয়' : 'লক/বন্ধ করা হয়েছে'}`
          : 'সিস্টেম সেটিংস আপডেট করা হয়েছে',
        'Settings',
        'system_config'
      );
    }
    return updated;
  };

  const toggleDataDeletion = async (explicitState?: boolean): Promise<boolean> => {
    const nextState = explicitState !== undefined ? explicitState : !settings.allowDataDeletion;
    await updateSettings({ allowDataDeletion: nextState });
    return nextState;
  };

  const deleteAttendanceForBatchAndDate = async (batchId: string, date: string): Promise<number> => {
    const count = await dataService.deleteAttendance({ batchId, date });
    if (userProfile) {
      await logActivity(
        userProfile.id || '',
        userProfile.name || 'User',
        `তারিখভিত্তিক হাজিরা রেকর্ড মোছা হয়েছে (${date}, ব্যাচ: ${batchId}, মোট: ${count}টি)`,
        'Attendance',
        batchId
      );
    }
    return count;
  };

  const deleteAllAttendance = async (batchId?: string): Promise<number> => {
    const count = await dataService.deleteAttendance(batchId ? { batchId } : undefined);
    if (userProfile) {
      await logActivity(
        userProfile.id || '',
        userProfile.name || 'User',
        `সকল হাজিরা রেকর্ড মোছা হয়েছে (মোট: ${count}টি)`,
        'Attendance',
        batchId || 'all'
      );
    }
    return count;
  };

  const deleteAllTrainees = async (options?: { batchId?: string; deleteAttendanceToo?: boolean }) => {
    const result = await dataService.deleteAllTrainees(options);
    if (userProfile) {
      await logActivity(
        userProfile.id || '',
        userProfile.name || 'User',
        `প্রশিক্ষণার্থী তালিকা মোছা হয়েছে (শিক্ষার্থী: ${result.deletedTrainees}টি, হাজিরা: ${result.deletedAttendance}টি)`,
        'Trainees',
        options?.batchId || 'all'
      );
    }
    return result;
  };

  const deleteAllExamsAndMarks = async (batchId?: string) => {
    const result = await dataService.deleteAllExamsAndMarks(batchId ? { batchId } : undefined);
    if (userProfile) {
      await logActivity(
        userProfile.id || '',
        userProfile.name || 'User',
        `পরীক্ষা ও ফলাফল নম্বর মোছা হয়েছে (পরীক্ষা: ${result.deletedExams}টি, মার্কস: ${result.deletedMarks}টি)`,
        'Exams',
        batchId || 'all'
      );
    }
    return result;
  };

  const deleteAllInstitutes = async (): Promise<number> => {
    const count = await dataService.deleteAllInstitutes();
    if (userProfile) {
      await logActivity(userProfile.id || '', userProfile.name || 'User', `সকল প্রতিষ্ঠান মোছা হয়েছে (মোট: ${count}টি)`, 'Institutes', 'all');
    }
    return count;
  };

  const deleteAllTrades = async (): Promise<number> => {
    const count = await dataService.deleteAllTrades();
    if (userProfile) {
      await logActivity(userProfile.id || '', userProfile.name || 'User', `সকল ট্রেড মোছা হয়েছে (মোট: ${count}টি)`, 'Trades', 'all');
    }
    return count;
  };

  const deleteAllBatches = async (): Promise<number> => {
    const count = await dataService.deleteAllBatches();
    if (userProfile) {
      await logActivity(userProfile.id || '', userProfile.name || 'User', `সকল ব্যাচ মোছা হয়েছে (মোট: ${count}টি)`, 'Batches', 'all');
    }
    return count;
  };

  const deleteInstitute = async (id: string): Promise<void> => {
    await dataService.deleteInstitute(id);
    if (userProfile) {
      await logActivity(userProfile.id || '', userProfile.name || 'User', `প্রতিষ্ঠান অপসারণ করা হয়েছে (আইডি: ${id})`, 'Institutes', id);
    }
  };

  const deleteTrade = async (id: string): Promise<void> => {
    await dataService.deleteTrade(id);
    if (userProfile) {
      await logActivity(userProfile.id || '', userProfile.name || 'User', `ট্রেড অপসারণ করা হয়েছে (আইডি: ${id})`, 'Trades', id);
    }
  };

  const deleteBatch = async (id: string, cascade?: boolean): Promise<void> => {
    await dataService.deleteBatch(id, cascade);
    if (userProfile) {
      await logActivity(userProfile.id || '', userProfile.name || 'User', `ব্যাচ অপসারণ করা হয়েছে (আইডি: ${id})`, 'Batches', id);
    }
  };

  const purgeAllSystemData = async (options?: { keepInstitutesAndTrades?: boolean; keepLogs?: boolean }) => {
    const counts = await dataService.purgeAllSystemData(options);
    if (userProfile) {
      await logActivity(
        userProfile.id || '',
        userProfile.name || 'User',
        'সম্পূর্ণ সিস্টেম ডাটা ওয়াইপ / ফ্যাক্টরি রিসেট সম্পন্ন হয়েছে',
        'System',
        'purge'
      );
    }
    return counts;
  };

  return (
    <SystemSettingsContext.Provider
      value={{
        settings,
        loading,
        isDeletionAllowed: settings.allowDataDeletion === true,
        updateSettings,
        toggleDataDeletion,
        deleteAttendanceForBatchAndDate,
        deleteAllAttendance,
        deleteAllTrainees,
        deleteAllExamsAndMarks,
        deleteAllInstitutes,
        deleteAllTrades,
        deleteAllBatches,
        deleteInstitute,
        deleteTrade,
        deleteBatch,
        purgeAllSystemData
      }}
    >
      {children}
    </SystemSettingsContext.Provider>
  );
};

export const useSystemSettings = () => useContext(SystemSettingsContext);
