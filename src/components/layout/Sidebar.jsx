import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ShoppingCart, LayoutDashboard, Users, Package, Truck, 
  CreditCard, DollarSign, Settings, Menu, X,
  Store, ClipboardList, ArrowLeftRight, BarChart3, MoreHorizontal, LogOut, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
import { base44 } from '@/api/base44Client';

const allNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', adminOnly: true },
  { label: 'Compras', icon: Truck, path: '/purchases', adminOnly: true },
  { label: 'Caja', icon: DollarSign, path: '/cash-register' },
  { label: 'Punto de Venta', icon: ShoppingCart, path: '/pos' },
  { label: 'Órdenes', icon: ClipboardList, path: '/orders' },
  { label: 'Inventario', icon: Package, path: '/inventory' },
  { label: 'Clientes', icon: Users, path: '/customers' },
  { label: 'Cuentas x Cobrar', icon: CreditCard, path: '/accounts-receivable' },
  { label: 'Cuentas x Pagar', icon: ArrowLeftRight, path: '/accounts-payable', adminOnly: true },
  { label: 'Reportes', icon: BarChart3, path: '/reports' },
  { label: 'Configuración', icon: Settings, path: '/settings', adminOnly: true },
];

// Items shown in mobile bottom bar (most used)
const mobileBottomItems = [
  { label: 'POS', icon: ShoppingCart, path: '/pos' },
  { label: 'Caja', icon: DollarSign, path: '/cash-register' },
  { label: 'Órdenes', icon: ClipboardList, path: '/orders' },
  { label: 'C x C', icon: CreditCard, path: '/accounts-receivable' },
];

export default function Sidebar({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { isAdmin, isBranchUser, userBranchName } = useUserRole();

  const navItems = allNavItems.filter(item => isAdmin || !item.adminOnly);

  const isPOS = location.pathname === '/pos';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar — desktop always visible (collapsible), mobile as drawer */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        collapsed ? "lg:w-16" : "w-64"
      )}>
        {/* Logo */}
        <div className={cn("border-b border-sidebar-border", collapsed ? "p-3" : "p-5")}>
          <div className="flex items-center justify-between gap-3">
            {!collapsed && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-heading font-bold text-lg leading-tight">Angelita's</h1>
                  <p className="text-xs text-sidebar-foreground/60">Food ERP POS</p>
                </div>
              </div>
            )}
            {collapsed && (
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mx-auto">
                <Store className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
            <button className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={() => setIsOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-3")}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-all",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-4")}>
          {!collapsed && isBranchUser && userBranchName && (
            <p className="text-xs text-sidebar-primary font-medium text-center mb-1">📍 {userBranchName}</p>
          )}
          {!collapsed && currentUser && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-7 h-7 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-sidebar-foreground/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{currentUser.full_name || currentUser.email}</p>
                <p className="text-[10px] text-sidebar-foreground/50 truncate">{currentUser.email}</p>
              </div>
            </div>
          )}
          {!collapsed && <p className="text-xs text-sidebar-foreground/40 text-center">v1.0 · Angelita's ERP</p>}
          {/* Desktop collapse toggle */}
          <button
            onClick={() => base44.auth.logout()}
            className="flex w-full items-center gap-2 mt-1 p-1.5 rounded-lg text-sidebar-foreground/50 hover:text-red-400 hover:bg-sidebar-accent transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-xs">Cerrar sesión</span>}
          </button>
          <button
            onClick={() => setCollapsed(v => !v)}
            className="hidden lg:flex w-full items-center justify-center mt-2 p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-12 sm:h-14 border-b bg-card flex items-center px-3 sm:px-4 gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => { setIsOpen(!isOpen); }}
          >
            <Menu className="w-5 h-5" />
          </Button>
          {/* Page title on mobile */}
          <span className="lg:hidden font-heading font-semibold text-sm text-foreground/80">
            {navItems.find(n => n.path === location.pathname || (n.path !== '/' && location.pathname.startsWith(n.path)))?.label || "Angelita's"}
          </span>
          <div className="flex-1" />
        </header>

        {/* Page content — add bottom padding on mobile to account for bottom nav */}
        <main className={cn("flex-1 overflow-y-auto", !isPOS && "pb-16 lg:pb-0")}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (hidden on POS because it has its own FAB) */}
      {!isPOS && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t flex items-stretch">
          {mobileBottomItems.map(item => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
          {/* More button opens sidebar */}
          <button
            onClick={() => setIsOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium text-muted-foreground"
          >
            <MoreHorizontal className="w-5 h-5" />
            Más
          </button>
        </nav>
      )}
    </div>
  );
}