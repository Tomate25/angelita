import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign, AlertTriangle, CreditCard,
  ArrowUpRight, TrendingUp, TrendingDown, Package2, Receipt
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(18,90%,55%)', 'hsl(174,60%,40%)', 'hsl(45,95%,55%)', 'hsl(280,65%,60%)', 'hsl(340,75%,55%)'];

const fmt = (n) => Number(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const now = new Date();
const YEARS = Array.from({ length: 4 }, (_, i) => String(now.getFullYear() - i));
const MONTHS = [
  { value: 'all', label: 'Todo el año' },
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

function getDaysInMonth(year, month) {
  if (month === 'all') return [];
  const count = new Date(parseInt(year), parseInt(month), 0).getDate();
  return Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, '0'));
}

export default function Dashboard() {
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [day, setDay] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

  const { data: orders = [] } = useQuery({
    queryKey: ['orders-dashboard', year, month],
    queryFn: async () => {
      const all = [];
      let skip = 0;
      const limit = 200;
      // Build date prefix to stop early
      const prefix = month !== 'all' ? `${year}-${month}` : year;
      while (true) {
        const batch = await base44.entities.Order.list('-created_date', limit, skip);
        all.push(...batch);
        if (batch.length < limit) break;
        const oldest = batch[batch.length - 1];
        if (oldest?.created_date) {
          const oldestStr = (oldest.created_date || '').substring(0, prefix.length);
          if (oldestStr < prefix) break;
        }
        skip += limit;
        if (skip > 5000) break;
      }
      return all;
    },
    staleTime: 0,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-dashboard'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory-dashboard'],
    queryFn: () => base44.entities.Inventory.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-dashboard'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-dashboard'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: ar = [] } = useQuery({
    queryKey: ['ar-dashboard'],
    queryFn: () => base44.entities.AccountReceivable.filter({ status: 'pending' }),
  });

  const { data: supplierInvoices = [] } = useQuery({
    queryKey: ['ap-dashboard'],
    queryFn: () => base44.entities.SupplierInvoice.list(),
  });

  // Filter paid orders by selected period and branch
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status !== 'paid') return false;
      const d = o.created_date || o.closed_at || '';
      if (!d.startsWith(year)) return false;
      if (month !== 'all' && !d.startsWith(`${year}-${month}`)) return false;
      if (day !== 'all' && !d.startsWith(`${year}-${month}-${day}`)) return false;
      if (branchFilter !== 'all' && o.branch_id !== branchFilter) return false;
      return true;
    });
  }, [orders, year, month, day, branchFilter]);

  // KPIs
  const totalSales = filteredOrders.reduce((s, o) => s + (o.total || 0), 0);

  // COGS: product.cost como base, sobreescrito por avg_cost del inventario si está disponible
  const invCostMap = useMemo(() => {
    const map = {};
    products.forEach(p => { map[p.id] = p.cost || 0; });
    inventory.forEach(i => { if (i.avg_cost > 0) map[i.product_id] = i.avg_cost; });
    return map;
  }, [inventory, products]);

  const totalCOGS = useMemo(() => {
    return filteredOrders.reduce((sum, o) => {
      return sum + (o.items || []).reduce((s, item) => {
        const cost = invCostMap[item.product_id] || 0;
        return s + cost * (item.quantity || 0);
      }, 0);
    }, 0);
  }, [filteredOrders, invCostMap]);

  const totalUtility = totalSales - totalCOGS;
  const margin = totalSales > 0 ? (totalUtility / totalSales) * 100 : 0;
  const totalAR = ar.reduce((s, a) => s + (a.balance || 0), 0);
  const apPending = supplierInvoices.filter(i => ['pending', 'partial', 'overdue'].includes(i.status));
  const totalAP = apPending.reduce((s, i) => s + (i.balance || 0), 0);
  const lowStock = inventory.filter(i => i.quantity <= (i.min_stock || 5));

  // Payment breakdown
  const paymentData = ['efectivo', 'transferencia', 'tarjeta', 'credito'].map(m => ({
    name: m.charAt(0).toUpperCase() + m.slice(1),
    value: filteredOrders.filter(o => o.payment_method === m).reduce((s, o) => s + (o.total || 0), 0),
  })).filter(d => d.value > 0);

  // Top products
  const productSales = {};
  filteredOrders.forEach(o => (o.items || []).forEach(item => {
    productSales[item.product_name] = (productSales[item.product_name] || 0) + (item.subtotal || 0);
  }));
  const topProducts = Object.entries(productSales)
    .sort(([, a], [, b]) => b - a).slice(0, 5)
    .map(([name, total]) => ({ name: name?.substring(0, 16), total }));

  const days = getDaysInMonth(year, month);
  const periodLabel = day !== 'all'
    ? `${day}/${month}/${year}`
    : month !== 'all'
    ? `${MONTHS.find(m => m.value === month)?.label} ${year}`
    : year;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Período: {periodLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={year} onValueChange={v => { setYear(v); setDay('all'); }}>
            <SelectTrigger className="w-24 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={month} onValueChange={v => { setMonth(v); setDay('all'); }}>
            <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          {month !== 'all' && (
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className="w-28 h-9 text-sm"><SelectValue placeholder="Día" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los días</SelectItem>
                {days.map(d => <SelectItem key={d} value={d}>Día {d}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Sucursal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sucursales</SelectItem>
              {branches.filter(b => !b.is_warehouse).map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Ventas */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ventas</p>
                <p className="text-xl font-heading font-bold mt-1">C${fmt(totalSales)}</p>
                <p className="text-xs text-muted-foreground mt-1">{filteredOrders.length} órdenes</p>
              </div>
              <div className="p-3 rounded-xl bg-primary"><DollarSign className="w-5 h-5 text-white" /></div>
            </div>
          </CardContent>
        </Card>

        {/* Costo */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Costo Vendido</p>
                <p className="text-xl font-heading font-bold mt-1">C${fmt(totalCOGS)}</p>
                <p className="text-xs text-muted-foreground mt-1">COGS del período</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500"><Package2 className="w-5 h-5 text-white" /></div>
            </div>
          </CardContent>
        </Card>

        {/* Utilidad */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Utilidad Bruta</p>
                <p className={`text-xl font-heading font-bold mt-1 ${totalUtility >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  C${fmt(totalUtility)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {totalUtility >= 0
                    ? <ArrowUpRight className="w-3 h-3 text-green-500" />
                    : <TrendingDown className="w-3 h-3 text-destructive" />}
                  <span className={`text-xs font-semibold ${margin >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    Margen {margin.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-xl ${totalUtility >= 0 ? 'bg-green-500' : 'bg-destructive'}`}>
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CxC */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cuentas x Cobrar</p>
                <p className="text-xl font-heading font-bold mt-1">C${fmt(totalAR)}</p>
                <p className="text-xs text-muted-foreground mt-1">{ar.length} pendientes</p>
              </div>
              <div className="p-3 rounded-xl bg-secondary"><CreditCard className="w-5 h-5 text-white" /></div>
            </div>
          </CardContent>
        </Card>

        {/* CxP */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cuentas x Pagar</p>
                <p className="text-xl font-heading font-bold mt-1 text-orange-600">C${fmt(totalAP)}</p>
                <p className="text-xs text-muted-foreground mt-1">{apPending.length} pendientes</p>
              </div>
              <div className="p-3 rounded-xl bg-orange-500"><Receipt className="w-5 h-5 text-white" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Productos Más Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topProducts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => `C$${v.toFixed(2)}`} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Sin ventas en el período</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Ventas por Método de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={220}>
                  <PieChart>
                    <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80}>
                      {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `C$${v.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {paymentData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-medium ml-auto">C${d.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Sin ventas en el período</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Últimas Órdenes del Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredOrders.slice(0, 5).map(order => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{order.order_number || `ORD-${order.id?.slice(-4)}`}</p>
                    <p className="text-xs text-muted-foreground">{order.customer_name || 'Consumidor Final'}</p>
                  </div>
                  <p className="font-heading font-semibold text-sm">C${(order.total || 0).toFixed(2)}</p>
                </div>
              ))}
              {filteredOrders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Sin órdenes en el período</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Inventario Crítico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStock.slice(0, 5).map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{inv.product_name}</p>
                    <p className="text-xs text-muted-foreground">{inv.branch_name}</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">{inv.quantity} uds</Badge>
                </div>
              ))}
              {lowStock.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Todo el inventario está bien</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}