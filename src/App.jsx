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

// Redirige a /pos si el usuario es de sucursal (Cofradia/Granada)
function AdminRoute({ children }) {
  const { isBranchUser, loading } = useUserRole();
  if (loading) return null;
  if (isBranchUser) return <Navigate to="/pos" replace />;
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
        <Route path="/" element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="/pos" element={<POS />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/accounts-receivable" element={<AccountsReceivable />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/purchases" element={<AdminRoute><Purchases /></AdminRoute>} />
        <Route path="/accounts-payable" element={<AdminRoute><AccountsPayable /></AdminRoute>} />
        <Route path="/cash-register" element={<CashRegisterPage />} />
        <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
        <Route path="/reports" element={<Reports />} />
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