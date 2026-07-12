import { useAuth } from '@/lib/AuthContext';

export function useUserRole() {
  const { user, isLoadingAuth } = useAuth();

  const loading = isLoadingAuth;
  const isAdmin = user?.role === 'admin';
  const isBranchUser = !isAdmin && !!user?.role;
  const userBranchId = user?.branch_id || null;
  const userBranchName = user?.branch_name || null;
  const userRole = user?.role || null;

  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];

  const hasPermission = (permission) => {
    if (isAdmin) return true;
    if (permissions.includes(permission)) return true;
    // Fallback: If no permissions are explicitly defined, allow default branch permissions
    if (permissions.length === 0 && isBranchUser) {
      const defaultBranchPermissions = ['pos', 'cash_register', 'orders', 'inventory', 'customers', 'ar', 'reports'];
      return defaultBranchPermissions.includes(permission);
    }
    return false;
  };

  return { user, loading, isAdmin, isBranchUser, userBranchId, userBranchName, userRole, hasPermission };
}