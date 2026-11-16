import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { PendingApproval } from '../../pages/PendingApproval';
import { UserRole } from '../../types';

interface RequireRoleProps {
  roles?: UserRole[];
  permission?: string | string[];
  path?: string;
  redirectTo?: string;
  children: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({
  roles,
  permission,
  path,
  redirectTo,
  children,
}) => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { can, canViewPage, getDefaultLandingRoute, loading: permLoading } =
    usePermissions();
  const location = useLocation();

  if (authLoading || permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-theme-text-secondary">
        <div className="w-8 h-8 border-4 border-theme-primary border-t-transparent rounded-full animate-spin mr-3"></div>
        <span className="text-sm">যাচাই করা হচ্ছে...</span>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <Navigate to="/login" replace />;
  }

  if (userProfile.status === 'Pending Approval' || userProfile.role === 'Pending') {
    return <PendingApproval />;
  }

  if (userProfile.status !== 'Active') {
    return <Navigate to="/login" replace />;
  }

  const roleOk =
    !roles || roles.length === 0 || roles.includes(userProfile.role);

  const permOk = !permission
    ? true
    : Array.isArray(permission)
    ? permission.some((p) => can(p))
    : can(permission);

  const pathOk = !path ? true : canViewPage(path);

  if (!roleOk || !permOk || !pathOk) {
    const candidate = redirectTo || getDefaultLandingRoute(path || location.pathname);
    const safeTarget =
      candidate && candidate !== location.pathname ? candidate : '/notifications';
    return <Navigate to={safeTarget} replace />;
  }

  return <>{children}</>;
};

export default RequireRole;
