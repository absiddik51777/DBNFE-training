import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Role } from '../types';
import { useAuth } from './AuthContext';
import { dataService } from '../lib/dataService';
import { DEFAULT_ROLES, ALL_PERMISSION_KEYS, PATH_TO_PAGE_PERMISSION } from '../lib/permissions';

interface PermissionsContextType {
  roles: Role[];
  loading: boolean;
  hasPermission: (permissionKey: string) => boolean;
  canViewPage: (path: string) => boolean;
  userPermissions: string[];
  currentRole: Role | null;
  isCourseDirector: boolean;
  getDefaultLandingRoute: (currentPath?: string) => string;
  setRoleLandingRoute: (roleId: string, route: string) => Promise<void>;
  updateRolePermissions: (roleId: string, permissions: string[]) => Promise<void>;
  createRole: (roleData: {
    name: string;
    nameBn?: string;
    code?: string;
    description: string;
    permissions: string[];
    defaultLandingRoute?: string;
  }) => Promise<Role>;
  deleteRole: (roleId: string) => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType>({
  roles: DEFAULT_ROLES,
  loading: true,
  hasPermission: () => false,
  canViewPage: () => false,
  userPermissions: [],
  currentRole: null,
  isCourseDirector: false,
  getDefaultLandingRoute: () => '/attendance',
  setRoleLandingRoute: async () => {},
  updateRolePermissions: async () => {},
  createRole: async () => DEFAULT_ROLES[0],
  deleteRole: async () => {},
  refreshRoles: async () => {},
});

export const usePermissions = () => useContext(PermissionsContext);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [loading, setLoading] = useState(true);

  const isCourseDirector = userProfile?.role === 'Course Director';

  const fetchRoles = async () => {
    try {
      const list = await dataService.getItems<Role>('roles');
      if (list && list.length > 0) {
        setRoles(list);
      } else {
        setRoles(DEFAULT_ROLES);
      }
    } catch (err) {
      console.warn("Could not fetch roles:", err);
      setRoles(DEFAULT_ROLES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  // Determine active user's role object
  const currentRole = useMemo(() => {
    if (!userProfile?.role) return null;
    const userRoleStr = userProfile.role.trim().toLowerCase();
    return (
      roles.find(
        r =>
          r.name.trim().toLowerCase() === userRoleStr ||
          r.code.trim().toLowerCase() === userRoleStr ||
          r.nameBn.trim().toLowerCase() === userRoleStr
      ) || null
    );
  }, [roles, userProfile?.role]);

  // Determine active user's permissions
  const userPermissions = useMemo<string[]>(() => {
    if (isCourseDirector) {
      // Course Director is the ultimate super-admin with all permissions
      return [...ALL_PERMISSION_KEYS];
    }
    if (currentRole) {
      // Filter out role-management permissions for non-Course Director roles as safeguard
      return currentRole.permissions.filter(p => p !== 'view_roles' && p !== 'manage_roles');
    }
    // Fallback default for Trainer or other roles if not yet loaded
    if (userProfile?.role === 'Trainer') {
      return DEFAULT_ROLES[2].permissions;
    }
    if (userProfile?.role === 'FMA') {
      return DEFAULT_ROLES[1].permissions;
    }
    return [];
  }, [isCourseDirector, currentRole, userProfile?.role]);

  // Check if current user has permission
  const hasPermission = useCallback((permissionKey: string): boolean => {
    // Role and permission system strictly under Course Director only
    if (permissionKey === 'view_roles' || permissionKey === 'manage_roles') {
      return isCourseDirector;
    }

    if (isCourseDirector) return true;

    return userPermissions.includes(permissionKey);
  }, [isCourseDirector, userPermissions]);

  // Check if current user can view a specific page route
  const canViewPage = useCallback((path: string): boolean => {
    // Normalise path (strip trailing slash or query)
    const cleanPath = path.split('?')[0].replace(/\/+$/, '') || '/';
    
    // Roles page strictly under Course Director only
    if (cleanPath === '/roles' || cleanPath.startsWith('/roles/')) {
      return isCourseDirector;
    }

    // Match exact or prefix
    const permKey = PATH_TO_PAGE_PERMISSION[cleanPath];
    if (!permKey) {
      // Find matching prefix if applicable
      const matchedKey = Object.keys(PATH_TO_PAGE_PERMISSION).find(
        p => p !== '/' && cleanPath.startsWith(p)
      );
      if (matchedKey) {
        return hasPermission(PATH_TO_PAGE_PERMISSION[matchedKey]);
      }
      return true;
    }

    return hasPermission(permKey);
  }, [isCourseDirector, hasPermission]);

  // Determine fallback landing route for the current user
  const getDefaultLandingRoute = useCallback((targetAttemptedPath?: string): string => {
    // 1. If attempted path is valid and accessible (and not generic root), stay there
    if (targetAttemptedPath && targetAttemptedPath !== '/' && canViewPage(targetAttemptedPath)) {
      return targetAttemptedPath;
    }

    // 2. Trainers are always redirected to the dedicated Trainer Dashboard
    if (userProfile?.role === 'Trainer' || currentRole?.code === 'trainer') {
      return '/trainer-dashboard';
    }

    // 3. For all other roles, the redirect URL is the main Dashboard ('/')
    if (canViewPage('/')) {
      return '/';
    }

    // 4. Fallback if '/' is not permitted
    const allRoutes = ['/attendance', '/batches', '/trainees', '/institutes'];
    for (const route of allRoutes) {
      if (canViewPage(route)) return route;
    }

    return '/attendance';
  }, [canViewPage, currentRole, userProfile?.role]);

  // Configurable fallback landing route updater (Course Director or role customization)
  const setRoleLandingRoute = async (roleId: string, route: string) => {
    const targetRole = roles.find(r => r.id === roleId);
    if (!targetRole) return;

    const updatedRole: Role = {
      ...targetRole,
      defaultLandingRoute: route,
      updatedAt: Date.now(),
    };

    try {
      localStorage.setItem(`bnfe_landing_${targetRole.id}`, route);
      localStorage.setItem(`bnfe_landing_${targetRole.code}`, route);
    } catch (e) {}

    await dataService.saveItem<Role>('roles', updatedRole);
    setRoles(prev => prev.map(r => (r.id === roleId ? updatedRole : r)));
  };

  // Update permissions for a role (Course Director only)
  const updateRolePermissions = async (roleId: string, permissions: string[]) => {
    if (!isCourseDirector) {
      throw new Error('শুধুমাত্র কোর্স পরিচালক (Course Director) রোল ও পারমিশন পরিবর্তন করতে পারেন।');
    }

    const targetRole = roles.find(r => r.id === roleId);
    if (!targetRole) {
      throw new Error('রোল পাওয়া যায়নি।');
    }

    let finalPerms = [...permissions];
    // If it's Course Director role, ensure all permissions remain intact
    if (targetRole.name === 'Course Director' || targetRole.code === 'course_director') {
      finalPerms = [...ALL_PERMISSION_KEYS];
    }

    const updatedRole: Role = {
      ...targetRole,
      permissions: finalPerms,
      updatedAt: Date.now(),
    };

    await dataService.saveItem<Role>('roles', updatedRole);
    setRoles(prev => prev.map(r => (r.id === roleId ? updatedRole : r)));
  };

  // Create new role (Course Director only)
  const createRole = async (roleData: {
    name: string;
    nameBn?: string;
    code?: string;
    description: string;
    permissions: string[];
    defaultLandingRoute?: string;
  }): Promise<Role> => {
    if (!isCourseDirector) {
      throw new Error('শুধুমাত্র কোর্স পরিচালক (Course Director) নতুন রোল তৈরি করতে পারেন।');
    }

    const cleanCode = (roleData.code || roleData.name)
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    const newRole: Role = {
      id: `role_${Date.now()}_${cleanCode}`,
      name: roleData.name.trim(),
      nameBn: roleData.nameBn?.trim() || roleData.name.trim(),
      code: cleanCode,
      description: roleData.description.trim(),
      isSystem: false,
      permissions: roleData.permissions,
      defaultLandingRoute: roleData.defaultLandingRoute || '/attendance',
      createdAt: Date.now(),
    };

    await dataService.saveItem<Role>('roles', newRole);
    setRoles(prev => [...prev, newRole]);
    return newRole;
  };

  // Delete a custom role (Course Director only)
  const deleteRole = async (roleId: string) => {
    if (!isCourseDirector) {
      throw new Error('শুধুমাত্র কোর্স পরিচালক (Course Director) রোল মুছে ফেলতে পারেন।');
    }

    const targetRole = roles.find(r => r.id === roleId);
    if (!targetRole) return;

    if (targetRole.isSystem) {
      throw new Error('সিস্টেমের ডিফল্ট রোল (System Role) মুছে ফেলা সম্ভব নয়।');
    }

    await dataService.deleteItem('roles', roleId);
    setRoles(prev => prev.filter(r => r.id !== roleId));
  };

  const refreshRoles = async () => {
    await fetchRoles();
  };

  const contextValue = useMemo(() => ({
    roles,
    loading,
    hasPermission,
    canViewPage,
    userPermissions,
    currentRole,
    isCourseDirector,
    getDefaultLandingRoute,
    setRoleLandingRoute,
    updateRolePermissions,
    createRole,
    deleteRole,
    refreshRoles,
  }), [
    roles,
    loading,
    hasPermission,
    canViewPage,
    userPermissions,
    currentRole,
    isCourseDirector,
    getDefaultLandingRoute,
  ]);

  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  );
};
