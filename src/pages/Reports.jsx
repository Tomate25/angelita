import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight, BarChart3, Download, Users, FileText, List } from 'lucide-react';
import { format } from 'date-fns';
import { parseUTC, toLocalDateString } from '@/utils/time';
import PrintInventoryReport from '@/components/print/PrintInventoryReport';

function MarginBadge({ margin }) {
  const color = margin >= 30 ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md' : margin >= 15 ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md' : 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md';
  return <span className={`text-xs font-bold px-3 py-1 rounded-full ${color}`}>{margin.toFixed(1)}%</span>;
}

// Helper: format number with thousands separator
const formatNumber = (value, decimals = 2) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

function OrderRow({ order, invCostMap }) {
  const [expanded, setExpanded] = useState(false);

  const lines = (order.items || []).map(item => {
    const cost = (invCostMap[item.product_id] || 0) * (item.quantity || 0);
    const venta = item.subtotal || (item.unit_price * item.quantity);
    const utility = venta - cost;
    const margin = venta > 0 ? (utility / venta) * 100 : 0;
    return { ...item, lineCost: cost, lineVenta: venta, lineUtility: utility, lineMargin: margin };
  });

  const orderCOGS = lines.reduce((s, l) => s + l.lineCost, 0);
  const orderUtility = (order.total || 0) - orderCOGS;
  const orderMargin = (order.total || 0) > 0 ? (orderUtility / (order.total || 1)) * 100 : 0;

  const paymentLabels = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta: 'Tarjeta',
    credito: 'Crédito',
    mixto: 'Mixto'
  };

  return (
    <>
      <tr
        className="border-b hover:bg-muted/40 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            <span className="font-medium text-sm">{order.order_number || `ORD-${order.id?.slice(-4)}`}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {order.created_date ? format(parseUTC(order.created_date), 'dd/MM/yy HH:mm') : '-'}
        </td>
        <td className="px-4 py-3 text-sm">{order.customer_name || 'Consumidor Final'}</td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {paymentLabels[order.payment_method] || order.payment_method || '-'}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-right font-heading font-semibold text-blue-600">
          C${formatNumber(order.total || 0)}
        </td>
        <td className="px-4 py-3 text-sm text-right font-medium text-amber-600 bg-amber-50/50">
          C${formatNumber(orderCOGS)}
        </td>
        <td className="px-4 py-3 text-sm text-right font-semibold">
          <span className={orderUtility >= 0 ? 'text-green-600' : 'text-destructive'}>
            C${formatNumber(orderUtility)}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <MarginBadge margin={orderMargin} />
        </td>
      </tr>

      {expanded && lines.map((line, i) => (
        <tr key={i} className="bg-muted/20 border-b border-dashed">
          <td className="px-4 py-2 pl-12 text-xs text-muted-foreground" colSpan={2}>
            <span className="italic">{line.product_name}</span>
            <span className="ml-2 text-muted-foreground/60">× {line.quantity} {line.unit || ''}</span>
          </td>
          <td className="px-4 py-2 text-xs text-muted-foreground">
            @ C${(line.unit_price || 0).toFixed(2)}
          </td>
          <td className="px-4 py-2 text-xs text-right font-semibold text-blue-600 bg-blue-50/30 rounded">
            C${formatNumber(line.lineVenta)}
          </td>
          <td className="px-4 py-2 text-xs text-right text-amber-600 bg-amber-50/50">
            C${formatNumber(line.lineCost)}
          </td>
          <td className="px-4 py-2 text-xs text-right font-semibold">
            <span className={line.lineUtility >= 0 ? 'text-green-600' : 'text-destructive'}>
              C${formatNumber(line.lineUtility)}
            </span>
          </td>
          <td className="px-4 py-2 text-right">
            <MarginBadge margin={line.lineMargin} />
          </td>
        </tr>
      ))}
    </>
  );
}

export default function Reports() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const firstOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

  const [activeTab, setActiveTab] = useState('ventas');
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState('');
  const [customerSearchText, setCustomerSearchText] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders-reports', dateFrom, dateTo, branchFilter],
    queryFn: async () => {
      const all = [];
      let skip = 0;
      const limit = 200;
      while (true) {
        const batch = await base44.entities.Order.list('-created_date', limit, skip);
        all.push(...batch);
        if (batch.length < limit) break;
        // Stop if oldest record in batch is already before dateFrom (with 5 day buffer)
        const oldest = batch[batch.length - 1];
        if (oldest?.created_date && dateFrom) {
          const oldestDate = (oldest.created_date || '').substring(0, 10);
          const bufferDate = new Date(dateFrom);
          bufferDate.setDate(bufferDate.getDate() - 5);
          if (oldestDate < bufferDate.toISOString().substring(0, 10)) break;
        }
        skip += limit;
        if (skip > 5000) break;
      }
      return all;
    },
    staleTime: 0,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory-reports'],
    queryFn: () => base44.entities.Inventory.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-reports'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-reports'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-reports'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: accountsReceivable = [] } = useQuery({
    queryKey: ['ar-reports'],
    queryFn: () => base44.entities.AccountReceivable.list(),
  });

  // Build cost map: prefer avg_cost from inventory (moving average), fallback to product.cost
  const invCostMap = useMemo(() => {
    // First load product base cost
    const map = {};
    products.forEach(p => { map[p.id] = p.cost || 0; });
    // Override with avg_cost from inventory if set (more accurate moving average)
    inventory.forEach(i => {
      if (i.avg_cost > 0) map[i.product_id] = i.avg_cost;
    });
    return map;
  }, [inventory, products]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status !== 'paid') return false;
      const d = toLocalDateString(o.created_date);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (branchFilter !== 'all' && o.branch_id !== branchFilter) return false;
      if (search && !o.order_number?.toLowerCase().includes(search.toLowerCase()) &&
          !o.customer_name?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [orders, dateFrom, dateTo, search, branchFilter]);

  const customerOrders = useMemo(() => {
    // Órdenes de crédito con saldo pendiente (AR no pagado)
    const paidOrderIds = new Set(
      accountsReceivable.filter(ar => ar.status === 'paid').map(ar => ar.order_id)
    );
    return orders.filter(o => {
      if (o.status !== 'paid') return false;
      if (o.payment_method !== 'credito') return false;
      if (paidOrderIds.has(o.id)) return false; // ya fue cobrado, excluir
      const d = toLocalDateString(o.created_date);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (branchFilter !== 'all' && o.branch_id !== branchFilter) return false;
      return true;
    });
  }, [orders, accountsReceivable, dateFrom, dateTo, branchFilter]);

  const customerTotals = useMemo(() => {
    const totals = {};
    customerOrders.forEach(o => {
      const key = o.customer_id || 'consumidor';
      if (!totals[key]) {
        // Buscar cédula del cliente
        const customer = customers.find(c => c.id === o.customer_id);
        totals[key] = {
          customer_id: o.customer_id,
          customer_name: o.customer_name || 'Consumidor Final',
          customer_cedula: customer?.cedula || 'N/A',
          total_orders: 0,
          total_amount: 0,
          last_purchase: null,
          orders: []
        };
      }
      totals[key].total_orders += 1;
      totals[key].total_amount += o.total || 0;
      if (!totals[key].last_purchase || o.created_date > totals[key].last_purchase) {
        totals[key].last_purchase = o.created_date;
      }
      totals[key].orders.push(o);
    });
    return Object.values(totals).sort((a, b) => b.total_amount - a.total_amount);
  }, [customerOrders, customers]);

  const displayedCustomerTotals = useMemo(() => {
    if (!customerSearchText.trim()) return customerTotals;
    const q = customerSearchText.toLowerCase();
    return customerTotals.filter(c =>
      c.customer_name?.toLowerCase().includes(q) ||
      (c.customer_cedula && c.customer_cedula !== 'N/A' && c.customer_cedula.toLowerCase().includes(q))
    );
  }, [customerTotals, customerSearchText]);

  const totals = useMemo(() => {
    let sales = 0, cogs = 0;
    filteredOrders.forEach(o => {
      sales += o.total || 0;
      (o.items || []).forEach(item => {
        cogs += (invCostMap[item.product_id] || 0) * (item.quantity || 0);
      });
    });
    const utility = sales - cogs;
    const margin = sales > 0 ? (utility / sales) * 100 : 0;
    return { sales, cogs, utility, margin };
  }, [filteredOrders, invCostMap]);

  const exportVentasCSV = () => {
    const rows = [['Orden', 'Fecha', 'Cliente', 'Venta', 'Costo', 'Utilidad', 'Margen%', 'Producto', 'Cantidad', 'P.Unit', 'V.Linea', 'C.Linea', 'U.Linea', 'M.Linea%']];
    filteredOrders.forEach(o => {
      const orderCOGS = (o.items || []).reduce((s, item) => s + (invCostMap[item.product_id] || 0) * (item.quantity || 0), 0);
      const orderUtil = (o.total || 0) - orderCOGS;
      const orderMar = (o.total || 0) > 0 ? (orderUtil / (o.total || 1)) * 100 : 0;
      (o.items || []).forEach((item, idx) => {
        const cost = (invCostMap[item.product_id] || 0) * (item.quantity || 0);
        const venta = item.subtotal || 0;
        const util = venta - cost;
        const mar = venta > 0 ? (util / venta) * 100 : 0;
        rows.push([
          idx === 0 ? (o.order_number || o.id) : '',
          idx === 0 ? toLocalDateString(o.created_date) : '',
          idx === 0 ? (o.customer_name || 'Consumidor Final') : '',
          idx === 0 ? (o.total || 0).toFixed(2) : '',
          idx === 0 ? orderCOGS.toFixed(2) : '',
          idx === 0 ? orderUtil.toFixed(2) : '',
          idx === 0 ? orderMar.toFixed(1) : '',
          item.product_name, item.quantity, (item.unit_price || 0).toFixed(2),
          venta.toFixed(2), cost.toFixed(2), util.toFixed(2), mar.toFixed(1)
        ]);
      });
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `reporte_ventas_${dateFrom}_${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportVentasPDF = () => {
    const printComp = document.getElementById('ventas-report-print');
    if (printComp) printComp.click();
  };

  const paymentLabels = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', credito: 'Crédito', mixto: 'Mixto' };

  const listadoOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status === 'voided' || o.status === 'cancelled') return false;
      const d = toLocalDateString(o.created_date);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (branchFilter !== 'all' && o.branch_id !== branchFilter) return false;
      return true;
    });
  }, [orders, dateFrom, dateTo, branchFilter]);

  const exportListadoCSV = () => {
    const rows = [['Fecha', 'No. Orden', 'Cliente', 'Monto', 'Forma de Pago']];
    listadoOrders.forEach(o => {
      rows.push([
        toLocalDateString(o.created_date),
        o.order_number || o.id,
        o.customer_name || 'Consumidor Final',
        (o.total || 0).toFixed(2),
        paymentLabels[o.payment_method] || o.payment_method || '-',
      ]);
    });
    const total = listadoOrders.reduce((s, o) => s + (o.total || 0), 0);
    rows.push(['', 'TOTAL', '', total.toFixed(2), '']);
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `listado_ordenes_${dateFrom}_${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportClientesCSV = () => {
    const rows = [['Cliente', 'Cédula/RUC', 'Total Órdenes', 'Total Comprado', 'Saldo Pendiente', 'Total General']];
    displayedCustomerTotals.forEach(c => {
      rows.push([
        c.customer_name,
        c.customer_cedula || '-',
        c.total_orders,
        c.total_amount.toFixed(2),
        (c.pending_balance || 0).toFixed(2),
        (c.total_amount + (c.pending_balance || 0)).toFixed(2)
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `reporte_clientes_${dateFrom}_${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />Reportes
          </h1>
          <p className="text-sm text-muted-foreground">Análisis de ventas y consumo por cliente</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ventas" className="gap-2">
            <FileText className="w-4 h-4" />Ventas por Fecha
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-2">
            <Users className="w-4 h-4" />Consumo por Cliente
          </TabsTrigger>
          <TabsTrigger value="listado" className="gap-2">
            <List className="w-4 h-4" />Listado de Órdenes
          </TabsTrigger>
        </TabsList>

        {/* TAB: VENTAS POR FECHA */}
        <TabsContent value="ventas" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportVentasCSV} disabled={filteredOrders.length === 0} className="gap-2">
                <Download className="w-4 h-4" />CSV
              </Button>
              <Button variant="outline" onClick={exportVentasPDF} disabled={filteredOrders.length === 0} className="gap-2">
                <Download className="w-4 h-4" />PDF
              </Button>
              <PrintInventoryReport
                id="ventas-report-print"
            title={`Reporte de Ventas ${dateFrom} al ${dateTo}`}
            rows={filteredOrders.map(o => {
              const orderCOGS = (o.items || []).reduce((s, item) => s + (invCostMap[item.product_id] || 0) * (item.quantity || 0), 0);
              const util = (o.total || 0) - orderCOGS;
              const margin = (o.total || 0) > 0 ? (util / (o.total || 1)) * 100 : 0;
              // Buscar cédula del cliente
              const customer = customers.find(c => c.id === o.customer_id);
              return {
                orden: o.order_number || o.id,
                fecha: toLocalDateString(o.created_date),
                cliente: o.customer_name || 'Consumidor Final',
                cedula: customer?.cedula || '-',
                pago: o.payment_method || '',
                venta: `C$${formatNumber(o.total || 0)}`,
                costo: `C$${formatNumber(orderCOGS)}`,
                utilidad: `C$${formatNumber(util)}`,
                margen: `${margin.toFixed(1)}%`,
              };
            })}
            columns={[
              { key: 'orden', label: 'Orden', align: 'left' },
              { key: 'fecha', label: 'Fecha', align: 'left' },
              { key: 'cliente', label: 'Cliente', align: 'left' },
              { key: 'cedula', label: 'Cédula/RUC', align: 'left' },
              { key: 'pago', label: 'Pago', align: 'left' },
              { key: 'venta', label: 'Venta', align: 'right' },
              { key: 'costo', label: 'Costo', align: 'right' },
              { key: 'utilidad', label: 'Utilidad', align: 'right' },
              { key: 'margen', label: 'Margen', align: 'right' },
            ]}
            summary={[
              { label: 'Ventas Totales', value: `C$${formatNumber(totals.sales)}` },
              { label: 'Costo Vendido', value: `C$${formatNumber(totals.cogs)}` },
              { label: 'Utilidad Bruta', value: `C$${formatNumber(totals.utility)}` },
              { label: 'Margen Promedio', value: `${totals.margin.toFixed(1)}%` },
            ]}
          />
        </div>
          </div>

          {/* Filters */}
          <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-40" />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-40" />
            </div>
            <div>
              <Label className="text-xs">Sucursal</Label>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="h-9 w-48">
                  <SelectValue placeholder="Todas las sucursales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sucursales</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs">Buscar orden / cliente</Label>
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Órdenes</p>
          <p className="text-2xl font-heading font-bold mt-1">{filteredOrders.length}</p>
        </CardContent></Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200"><CardContent className="p-4">
          <p className="text-xs text-blue-700 uppercase tracking-wide font-semibold">Ventas</p>
          <p className="text-2xl font-heading font-bold mt-1 text-blue-600">C${formatNumber(totals.sales)}</p>
        </CardContent></Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"><CardContent className="p-4">
          <p className="text-xs text-amber-700 uppercase tracking-wide font-semibold">Costo Vendido</p>
          <p className="text-2xl font-heading font-bold mt-1 text-amber-600">C${formatNumber(totals.cogs)}</p>
        </CardContent></Card>
        <Card className={`bg-gradient-to-br ${totals.utility >= 0 ? 'from-green-50 to-emerald-50 border-green-200' : 'from-red-50 to-rose-50 border-red-200'}`}><CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs uppercase tracking-wide font-semibold ${totals.utility >= 0 ? 'text-green-700' : 'text-red-700'}`}>Utilidad Bruta</p>
              <p className={`text-2xl font-heading font-bold mt-1 ${totals.utility >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                C${formatNumber(totals.utility)}
              </p>
            </div>
            <MarginBadge margin={totals.margin} />
          </div>
        </CardContent></Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading">Órdenes — Análisis Marginal</CardTitle>
          <p className="text-xs text-muted-foreground">Haz clic en una orden para ver el detalle por línea</p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Cargando...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Sin órdenes en el período seleccionado</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase">Orden</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase">Pago</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase">Venta</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs text-amber-600 uppercase">Costo</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs text-green-600 uppercase">Utilidad</th>
                    <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => (
                    <OrderRow key={order.id} order={order} invCostMap={invCostMap} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-heading font-bold">
                    <td className="px-4 py-3 text-sm" colSpan={4}>TOTAL ({filteredOrders.length} órdenes)</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600 bg-blue-100">C${formatNumber(totals.sales)}</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-600 bg-amber-100">C${formatNumber(totals.cogs)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${totals.utility >= 0 ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>C${formatNumber(totals.utility)}</td>
                    <td className="px-4 py-3 text-right"><MarginBadge margin={totals.margin} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* TAB: CONSUMO POR CLIENTE */}
        <TabsContent value="clientes" className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-40" />
                </div>
                <div>
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-40" />
                </div>
                <div>
                  <Label className="text-xs">Sucursal</Label>
                  <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger className="h-9 w-48">
                      <SelectValue placeholder="Todas las sucursales" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las sucursales</SelectItem>
                      {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">Buscar cliente (nombre o cédula)</Label>
                  <Input
                    placeholder="Nombre o cédula/RUC..."
                    value={customerSearchText}
                    onChange={e => setCustomerSearchText(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" onClick={exportClientesCSV} disabled={displayedCustomerTotals.length === 0} className="gap-2">
              <Download className="w-4 h-4" />CSV
            </Button>

            <PrintInventoryReport
              id="clientes-report-print"
              title={`Consumo por Cliente ${dateFrom} al ${dateTo}`}
              rows={displayedCustomerTotals.map(c => ({                cliente: c.customer_name,
                cedula: c.customer_cedula || '-',
                ordenes: c.total_orders,
                total: `C$${formatNumber(c.total_amount)}`,
                ultima: c.last_purchase ? format(parseUTC(c.last_purchase), 'dd/MM/yyyy') : '-',
                saldo: (c.pending_balance || 0) > 0 ? `C$${formatNumber(c.pending_balance)}` : 'Al día',
                total_general: `C$${formatNumber(c.total_amount + (c.pending_balance || 0))}`
              }))}
              columns={[
                { key: 'cliente', label: 'Cliente', align: 'left' },
                { key: 'cedula', label: 'Cédula/RUC', align: 'left' },
                { key: 'ordenes', label: 'Órdenes', align: 'center' },
                { key: 'total', label: 'Total Comprado', align: 'right' },
                { key: 'ultima', label: 'Última Compra', align: 'left' },
                { key: 'saldo', label: 'Saldo Pendiente', align: 'right' },
                { key: 'total_general', label: 'Total General', align: 'right' },
              ]}
              summary={[
                { label: 'Total Clientes', value: displayedCustomerTotals.length },
                { label: 'Total Órdenes', value: displayedCustomerTotals.reduce((s, c) => s + c.total_orders, 0) },
                { label: 'Ventas Totales', value: `C$${formatNumber(displayedCustomerTotals.reduce((s, c) => s + c.total_amount, 0))}` },
              ]}
            />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading">Consumo por Cliente</CardTitle>
              <p className="text-xs text-muted-foreground">Historial de compras para gestión de cobro</p>
            </CardHeader>
            <CardContent className="p-0">
              {displayedCustomerTotals.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Sin compras en el período seleccionado</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gradient-to-r from-purple-50 to-indigo-50">
                        <th className="px-4 py-3 text-left font-semibold text-xs text-purple-900 uppercase tracking-wide">Cliente</th>
                        <th className="px-4 py-3 text-left font-semibold text-xs text-purple-900 uppercase tracking-wide">Cédula/RUC</th>
                        <th className="px-4 py-3 text-right font-semibold text-xs text-purple-900 uppercase tracking-wide">Órdenes</th>
                        <th className="px-4 py-3 text-right font-semibold text-xs text-purple-900 uppercase tracking-wide">Total Comprado</th>
                        <th className="px-4 py-3 text-right font-semibold text-xs text-red-700 uppercase tracking-wide">Saldo Pendiente</th>
                        <th className="px-4 py-3 text-right font-semibold text-xs text-purple-900 uppercase tracking-wide">Total General</th>
                        <th className="px-4 py-3 text-right font-semibold text-xs text-purple-900 uppercase tracking-wide">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedCustomerTotals.map(customer => (
                        <tr key={customer.customer_id || 'consumidor'} className="border-b hover:bg-gradient-to-r hover:from-purple-50/30 hover:to-indigo-50/30 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900">{customer.customer_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-mono bg-gray-50 rounded">{customer.customer_cedula}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-700">
                              {customer.total_orders}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-heading font-bold text-blue-600 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg px-4 py-2">
                            C${formatNumber(customer.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {customer.pending_balance > 0 ? (
                              <span className="font-heading font-bold text-red-600">C${formatNumber(customer.pending_balance)}</span>
                            ) : (
                              <span className="text-green-600 text-sm">Al día</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-heading font-bold text-purple-700">
                            C${formatNumber(customer.total_amount + (customer.pending_balance || 0))}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600 font-medium">
                            {customer.last_purchase ? format(parseUTC(customer.last_purchase), 'dd/MM/yyyy') : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="hover:bg-purple-100 hover:text-purple-700 hover:border-purple-300 transition-colors"
                              onClick={() => {
                                setSearch(customer.customer_name || '');
                                setActiveTab('ventas');
                              }}
                            >
                              Ver Órdenes
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-gradient-to-r from-purple-100 to-indigo-100 font-heading font-bold">
                        <td className="px-4 py-3 text-sm text-purple-900" colSpan={2}>TOTAL CLIENTES</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-purple-200 text-purple-800">
                            {displayedCustomerTotals.reduce((s, c) => s + c.total_orders, 0)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-700 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg">
                          C${formatNumber(displayedCustomerTotals.reduce((s, c) => s + c.total_amount, 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-red-700">
                          C${formatNumber(displayedCustomerTotals.reduce((s, c) => s + (c.pending_balance || 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-purple-800">
                          C${formatNumber(displayedCustomerTotals.reduce((s, c) => s + c.total_amount + (c.pending_balance || 0), 0))}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* TAB: LISTADO DE ÓRDENES */}
        <TabsContent value="listado" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-40" />
                </div>
                <div>
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-40" />
                </div>
                <div>
                  <Label className="text-xs">Sucursal</Label>
                  <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Todas las sucursales" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las sucursales</SelectItem>
                      {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={exportListadoCSV} disabled={listadoOrders.length === 0} className="gap-2">
              <Download className="w-4 h-4" />CSV
            </Button>
            <PrintInventoryReport
              title={`Listado de Órdenes ${dateFrom} al ${dateTo}`}
              rows={listadoOrders.map(o => ({
                fecha: toLocalDateString(o.created_date),
                orden: o.order_number || o.id,
                cliente: o.customer_name || 'Consumidor Final',
                monto: `C$${formatNumber(o.total || 0)}`,
                pago: paymentLabels[o.payment_method] || o.payment_method || '-',
              }))}
              columns={[
                { key: 'fecha', label: 'Fecha', align: 'left' },
                { key: 'orden', label: 'No. Orden', align: 'left' },
                { key: 'cliente', label: 'Cliente', align: 'left' },
                { key: 'monto', label: 'Monto', align: 'right' },
                { key: 'pago', label: 'Forma de Pago', align: 'left' },
              ]}
              summary={[
                { label: 'Total Órdenes', value: listadoOrders.length },
                { label: 'Monto Total', value: `C$${formatNumber(listadoOrders.reduce((s, o) => s + (o.total || 0), 0))}` },
              ]}
            />
          </div>

          {/* Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading">Listado de Órdenes</CardTitle>
              <p className="text-xs text-muted-foreground">{listadoOrders.length} órdenes en el período</p>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Cargando...</div>
              ) : listadoOrders.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Sin órdenes en el período seleccionado</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase">No. Orden</th>
                        <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase">Cliente</th>
                        <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground uppercase">Monto</th>
                        <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground uppercase">Forma de Pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listadoOrders.map(order => (
                        <tr key={order.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {order.created_date ? format(parseUTC(order.created_date), 'dd/MM/yyyy HH:mm') : '-'}
                          </td>
                          <td className="px-4 py-3 font-medium">{order.order_number || `ORD-${order.id?.slice(-4)}`}</td>
                          <td className="px-4 py-3">{order.customer_name || 'Consumidor Final'}</td>
                          <td className="px-4 py-3 text-right font-heading font-semibold">C${formatNumber(order.total || 0)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {paymentLabels[order.payment_method] || order.payment_method || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-muted/30 font-heading font-bold">
                        <td className="px-4 py-3 text-sm" colSpan={3}>TOTAL ({listadoOrders.length} órdenes)</td>
                        <td className="px-4 py-3 text-right text-primary">C${formatNumber(listadoOrders.reduce((s, o) => s + (o.total || 0), 0))}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}