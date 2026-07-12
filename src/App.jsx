import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import POS from '@/pages/POS';
import Orders from '@/pages/Orders';
import Customers from '@/pages/Customers';
import AccountsReceivable from '@/pages/AccountsReceivable';
import InventoryPage from '@/pages/Inventory';
import Purchases from '@/pages/Purchases';
import CashRegisterPage from '@/pages/CashRegister';
import Settings from '@/pages/Settings';
import AccountsPayable from '@/pages/AccountsPayable';
import ApprovePurchase from '@/pages/ApprovePurchase';
import Reports from '@/pages/Reports';
import PrintReceipt from '@/pages/PrintReceipt';
import PrintCashRegisterPage from '@/pages/PrintCashRegister';
import Login from '@/pages/Login';

// Protected route based on permissions
function ProtectedRoute({ permission, children }) {
  const { hasPermission, loading } = useUserRole();
  if (loading) return null;
  if (!hasPermission(permission)) {
    if (hasPermission('pos')) return <Navigate to="/pos" replace />;
    if (hasPermission('cash_register')) return <Navigate to="/cash-register" replace />;
    if (hasPermission('inventory')) return <Navigate to="/inventory" replace />;
    if (hasPermission('orders')) return <Navigate to="/orders" replace />;
    return <Navigate to="/login" replace />;
  }
  return children;
}

const AuthenticatedApp = () => {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  // Public route: no auth required
  if (window.location.pathname === '/approve-purchase') {
    return (
      <Routes>
        <Route path="/approve-purchase" element={<ApprovePurchase />} />
      </Routes>
    );
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground font-medium">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  if (authError && authError.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/approve-purchase" element={<ApprovePurchase />} />
      <Route path="/print-receipt" element={<PrintReceipt />} />
      <Route path="/print-cash-register" element={<PrintCashRegisterPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<ProtectedRoute permission="dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute permission="pos"><POS /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute permission="orders"><Orders /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute permission="customers"><Customers /></ProtectedRoute>} />
        <Route path="/accounts-receivable" element={<ProtectedRoute permission="ar"><AccountsReceivable /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute permission="inventory"><InventoryPage /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute permission="purchases"><Purchases /></ProtectedRoute>} />
        <Route path="/accounts-payable" element={<ProtectedRoute permission="ap"><AccountsPayable /></ProtectedRoute>} />
        <Route path="/cash-register" element={<ProtectedRoute permission="cash_register"><CashRegisterPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute permission="settings"><Settings /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute permission="reports"><Reports /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App