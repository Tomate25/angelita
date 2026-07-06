import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useUserRole() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const isAdmin = user?.role === 'admin';
  const isBranchUser = !isAdmin && !!user?.role;
  const userBranchId = user?.branch_id || null;
  const userBranchName = user?.branch_name || null;
  const userRole = user?.role || null;

  return { user, loading, isAdmin, isBranchUser, userBranchId, userBranchName, userRole };
}