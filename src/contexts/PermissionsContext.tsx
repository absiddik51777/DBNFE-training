import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import { Role } from '../types';
import { useAuth } from './AuthContext';
import { dataService } from '../lib/dataService';
import {
  DEFAULT_ROLES,
  ALL_PERMISSION_KEYS,
  PATH_TO_PAGE_PERMISSION,
} from '../lib/permissions';

interface PermissionsContextType {
  roles: Role[];
  loading: boolean;
  hasPermission: (permissionKey: string) => boolean;
  can: (permissionKey: string) => boolean;
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
  can: () => false,
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

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, userProfile } = useAuth();
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [loading, setLoading] = useState(true);

  const isActiveMember = Boolean(
    user && userProfile && userProfile.status === 'Active' && userProfile.role !== 'Pending'
  );
  const isCourseDirector = isActiveMember && userProfile?.role === 'Course Director';

  const fetchRoles = useCallback(async () => {
    if (!isActiveMember) {
      setRoles(DEFAULT_ROLES);
      setLoading(false);
      return;
    }
    try {
      const list = await dataService.getItems<Role>('roles', true);
      if (list && list.length > 0) {
        setRoles(list);
      } else {
        setRoles(DEFAULT_ROLES);
      }
    } catch (err) {
      console.warn('Could not fetch roles:', err);
      setRoles(DEFAULT_ROLES);
    } finally {
      setLoading(false);
    }
  }, [isActiveMember]);

  useEffect(() => {
    if (!isActiveMember) {
      setRoles(DEFAULT_ROLES);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchRoles();

    const unsub = dataService.subscribeCollection<Role>(
      'roles',
      (list) => {
        if (cancelled) return;
        setRoles(list && list.length > 0 ? list : DEFAULT_ROLES);
        setLoading(false);
      },
      () => {
        if (!cancelled) setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [isActiveMember, user?.uid, fetchRoles]);

  // Determine active user's role object strictly from live userProfile.role
  const currentRole = useMemo(() => {
    if (!isActiveMember || !userProfile?.role) return null;
    const userRoleStr = userProfile.role.trim().toLowerCase();
    return (
      roles.find(
        (r) =>
          r.name.trim().toLowerCase() === userRoleStr ||
          r.code.trim().toLowerCase() === userRoleStr ||
          r.nameBn.trim().toLowerCase() === userRoleStr
      ) || null
    );
  }, [isActiveMember, roles, userProfile?.role]);

  // Determine active user's permissions strictly from live role + live roles list
  const userPermissions = useMemo<string[]>(() => {
    if (!isActiveMember) {
      return [];
    }
    if (isCourseDirector) {
      return [...ALL_PERMISSION_KEYS];
    }
    if (currentRole) {
      return currentRole.permissions.filter(
        (p) => p !== 'view_roles' && p !== 'manage_roles'
      );
    }
    if (userProfile?.role === 'Trainer') {
      return DEFAULT_ROLES[2].permissions;
    }
    if (userProfile?.role === 'FMA') {
      return DEFAULT_ROLES[1].permissions;
    }
    return [];
  }, [isActiveMember, isCourseDirector, currentRole, userProfile?.role]);

  const hasPermission = useCallback(
    (permissionKey: string): boolean => {
      if (!isActiveMember) return false;
      if (permissionKey === 'view_roles' || permissionKey === 'manage_roles') {
        return isCourseDirector;
      }
      if (isCourseDirector) return true;
      return userPermissions.includes(permissionKey);
    },
    [isActiveMember, isCourseDirector, userPermissions]
  );

  const canViewPage = useCallback(
    (path: string): boolean => {
      if (!isActiveMember) return false;

      const cleanPath = path.split('?')[0].replace(/\/+$/, '') || '/';

      if (cleanPath === '/roles' || cleanPath.startsWith('/roles/')) {
        return isCourseDirector;
      }

      if (cleanPath === '/brn-verification' || cleanPath.startsWith('/brn-verification/')) {
        return isCourseDirector && hasPermission('view_brn_verification');
      }

      const permKey = PATH_TO_PAGE_PERMISSION[cleanPath];
      if (!permKey) {
        const matchedKey = Object.keys(PATH_TO_PAGE_PERMISSION).find(
          (p) => p !== '/' && cleanPath.startsWith(p)
        );
        if (matchedKey) {
          return hasPermission(PATH_TO_PAGE_PERMISSION[matchedKey]);
        }
        return true;
      }

      return hasPermission(permKey);
    },
    [isActiveMember, isCourseDirector, hasPermission]
  );

  const getDefaultLandingRoute = useCallback(
    (targetAttemptedPath?: string): string => {
      if (!isActiveMember) return '/login';

      if (targetAttemptedPath && targetAttemptedPath !== '/' && canViewPage(targetAttemptedPath)) {
        return targetAttemptedPath;
      }

      if (userProfile?.role === 'Trainer' || currentRole?.code === 'trainer') {
        return '/trainer-dashboard';
      }

      if (currentRole?.defaultLandingRoute && currentRole.defaultLandingRoute !== '/' && canViewPage(currentRole.defaultLandingRoute)) {
        return currentRole.defaultLandingRoute;
      }

      if (canViewPage('/')) {
        return '/';
      }

      const allRoutes = [
        '/attendance',
        '/attendance-sheet',
        '/batches',
        '/trainees',
        '/institutes',
        '/trades',
        '/exams',
        '/results',
        '/reports',
        '/certificates',
        '/settings',
      ];
      for (const route of allRoutes) {
        if (canViewPage(route)) return route;
      }

      return '/notifications';
    },
    [isActiveMember, canViewPage, currentRole, userProfile?.role]
  );

  const setRoleLandingRoute = async (roleId: string, route: string) => {
    const targetRole = roles.find((r) => r.id === roleId);
    if (!targetRole) return;

    const updatedRole: Role = {
      ...targetRole,
      defaultLandingRoute: route,
      updatedAt: Date.now(),
    };

    await dataService.saveItem<Role>('roles', updatedRole);
    setRoles((prev) => prev.map((r) => (r.id === roleId ? updatedRole : r)));
  };

  const updateRolePermissions = async (roleId: string, permissions: string[]) => {
    if (!isCourseDirector) {
      throw new Error(
        'শুধুমাত্র কোর্স পরিচালক (Course Director) রোল ও পারমিশন পরিবর্তন করতে পারেন।'
      );
    }

    const targetRole = roles.find((r) => r.id === roleId);
    if (!targetRole) {
      throw new Error('রোল পাওয়া যায়নি।');
    }

    let finalPerms = [...permissions];
    if (
      targetRole.name === 'Course Director' ||
      targetRole.code === 'course_director'
    ) {
      finalPerms = [...ALL_PERMISSION_KEYS];
    }

    const updatedRole: Role = {
      ...targetRole,
      permissions: finalPerms,
      updatedAt: Date.now(),
    };

    await dataService.saveItem<Role>('roles', updatedRole);
    setRoles((prev) => prev.map((r) => (r.id === roleId ? updatedRole : r)));
  };

  const createRole = async (roleData: {
    name: string;
    nameBn?: string;
    code?: string;
    description: string;
    permissions: string[];
    defaultLandingRoute?: string;
  }): Promise<Role> => {
    if (!isCourseDirector) {
      throw new Error(
        'শুধুমাত্র কোর্স পরিচালক (Course Director) নতুন রোল তৈরি করতে পারেন।'
      );
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
    setRoles((prev) => [...prev, newRole]);
    return newRole;
  };

  const deleteRole = async (roleId: string) => {
    if (!isCourseDirector) {
      throw new Error(
        'শুধুমাত্র কোর্স পরিচালক (Course Director) রোল মুছে ফেলতে পারেন।'
      );
    }

    const targetRole = roles.find((r) => r.id === roleId);
    if (!targetRole) return;

    if (targetRole.isSystem) {
      throw new Error('সিস্টেমের ডিফল্ট রোল (System Role) মুছে ফেলা সম্ভব নয়।');
    }

    await dataService.deleteItem('roles', roleId);
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
  };

  const refreshRoles = async () => {
    await fetchRoles();
  };

  const contextValue = useMemo(
    () => ({
      roles,
      loading,
      hasPermission,
      can: hasPermission,
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
    }),
    [
      roles,
      loading,
      hasPermission,
      canViewPage,
      userPermissions,
      currentRole,
      isCourseDirector,
      getDefaultLandingRoute,
    ]
  );

  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  );
};
