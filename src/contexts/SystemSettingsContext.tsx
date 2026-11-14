import React, { createContext, useContext, useEffect, useState } from 'react';
import { SystemSettings } from '../types';
import { dataService, DEFAULT_SYSTEM_SETTINGS } from '../lib/dataService';
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

  const getActor = () =>
    userProfile
      ? {
          userId: userProfile.id || '',
          user: userProfile.name || 'User',
          userRole: userProfile.role || '',
        }
      : undefined;

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
    const updated = await dataService.saveSystemSettings(updates, getActor());
    setSettings(updated);
    return updated;
  };

  const toggleDataDeletion = async (explicitState?: boolean): Promise<boolean> => {
    const nextState = explicitState !== undefined ? explicitState : !settings.allowDataDeletion;
    await updateSettings({ allowDataDeletion: nextState });
    return nextState;
  };

  const deleteAttendanceForBatchAndDate = async (batchId: string, date: string): Promise<number> => {
    return await dataService.deleteAttendance({ batchId, date }, getActor());
  };

  const deleteAllAttendance = async (batchId?: string): Promise<number> => {
    return await dataService.deleteAttendance(batchId ? { batchId } : undefined, getActor());
  };

  const deleteAllTrainees = async (options?: { batchId?: string; deleteAttendanceToo?: boolean }) => {
    return await dataService.deleteAllTrainees(options, getActor());
  };

  const deleteAllExamsAndMarks = async (batchId?: string) => {
    return await dataService.deleteAllExamsAndMarks(batchId ? { batchId } : undefined, getActor());
  };

  const deleteAllInstitutes = async (): Promise<number> => {
    return await dataService.deleteAllInstitutes(getActor());
  };

  const deleteAllTrades = async (): Promise<number> => {
    return await dataService.deleteAllTrades(getActor());
  };

  const deleteAllBatches = async (): Promise<number> => {
    return await dataService.deleteAllBatches(getActor());
  };

  const deleteInstitute = async (id: string): Promise<void> => {
    await dataService.deleteInstitute(id, true, getActor());
  };

  const deleteTrade = async (id: string): Promise<void> => {
    await dataService.deleteTrade(id, true, getActor());
  };

  const deleteBatch = async (id: string, cascade?: boolean): Promise<void> => {
    await dataService.deleteBatch(id, cascade, true, getActor());
  };

  const purgeAllSystemData = async (options?: { keepInstitutesAndTrades?: boolean; keepLogs?: boolean }) => {
    return await dataService.purgeAllSystemData({ ...options, keepLogs: true }, getActor());
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
