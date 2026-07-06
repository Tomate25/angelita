import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Eye, XCircle, Clock, CheckCircle2, Ban, Edit, ShieldAlert, Printer, Filter, X } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import VoidOrderSection from '@/components/orders/VoidOrderSection';

const statusConfig = {
  open: { label: 'Abierta', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  confirmed: { label: 'Confirmada', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: CheckCircle2 },
  paid: { label: 'Pagada', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: Ban },
  voided: { label: 'Anulada', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400', icon: XCircle },
};

export default function Orders() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateMode, setDateMode] = useState('month'); // 'all' | 'day' | 'month' | 'year' | 'range'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateDay, setDateDay] = useState('');
  const [dateMonth, setDateMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dateYear, setDateYear] = useState('');

  const { isAdmin, isBranchUser, userBranchId } = useUserRole();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 3000),
    staleTime: 30000,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Orden actualizada');
      setEditMode(false);
    },
  });

  const filtered = orders.filter(o => {
    if (isBranchUser && userBranchId && o.branch_id !== userBranchId) return false;
    if (filter !== 'voided' && o.status === 'voided') return false;
    if (filter !== 'all' && o.status !== filter) return false;
    if (search && !o.order_number?.toLowerCase().includes(search.toLowerCase()) && !o.customer_name?.toLowerCase().includes(search.toLowerCase())) return false;
    // Branch filter (admins only)
    if (isAdmin && branchFilter !== 'all' && o.branch_id !== branchFilter) return false;
    // Date filters
    if (dateMode !== 'all') {
      const d = new Date(o.created_date);
      const parseLocalDate = (str) => {
        const [y, m, day] = str.split('-').map(Number);
        return new Date(y, m - 1, day);
      };
      if (dateMode === 'day' && dateDay) {
        const ref = parseLocalDate(dateDay);
        if (d < startOfDay(ref) || d > endOfDay(ref)) return false;
      } else if (dateMode === 'month' && dateMonth) {
        const ref = parseLocalDate(dateMonth + '-01');
        if (d < startOfMonth(ref) || d > endOfMonth(ref)) return false;
      } else if (dateMode === 'year' && dateYear) {
        const ref = parseLocalDate(dateYear + '-01-01');
        if (d < startOfYear(ref) || d > endOfYear(ref)) return false;
      } else if (dateMode === 'range') {
        if (dateFrom && d < startOfDay(parseLocalDate(dateFrom))) return false;
        if (dateTo && d > endOfDay(parseLocalDate(dateTo))) return false;
      }
    }
    return true;
  });

  const openDetail = (order) => {
    setSelected(order);
    setEditMode(false);
    setEditForm(null);
  };

  const handleReprint = (order) => {
    localStorage.setItem('print_order', JSON.stringify({ ...order, items: order.items || [] }));
    window.open('/print-receipt', '_blank');
  };

  const startEdit = () => {
    setEditForm({
      customer_id: selected.customer_id || '',
      customer_name: selected.customer_name || '',
      payment_method: selected.payment_method || 'efectivo',
      status: selected.status,
      notes: selected.notes || '',
      items: (selected.items || []).map(i => ({ ...i })),
      total: selected.total || 0,
      subtotal: selected.subtotal || 0,
      discount_total: selected.discount_total || 0,
    });
    setEditMode(true);
  };

  const recalcTotal = (items) => {
    const sub = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
    const disc = items.reduce((s, i) => s + (i.quantity * i.unit_price * (i.discount || 0) / 100), 0);
    return { subtotal: sub, discount_total: disc, total: sub - disc };
  };

  const updateItemQty = (idx, qty) => {
    const items = editForm.items.map((item, i) => {
      if (i !== idx) return item;
      const newQty = Math.max(1, parseInt(qty) || 1);
      return { ...item, quantity: newQty, subtotal: newQty * item.unit_price * (1 - (item.discount || 0) / 100) };
    });
    setEditForm({ ...editForm, items, ...recalcTotal(items) });
  };

  const removeEditItem = (idx) => {
    const items = editForm.items.filter((_, i) => i !== idx);
    setEditForm({ ...editForm, items, ...recalcTotal(items) });
  };

  const handleSaveEdit = () => {
    const customer = customers.find(c => c.id === editForm.customer_id);
    updateOrder.mutate({
      id: selected.id,
      data: {
        ...editForm,
        customer_name: customer?.name || editForm.customer_name || 'Consumidor Final',
      },
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Órdenes</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} órdenes</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2 items-end bg-muted/40 rounded-lg p-3 border">
        <Filter className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />

        {/* Branch filter (admin only) */}
        {isAdmin && (
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs text-muted-foreground font-medium">Sucursal</label>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date mode */}
        <div className="flex flex-col gap-1 min-w-[120px]">
          <label className="text-xs text-muted-foreground font-medium">Periodo</label>
          <Select value={dateMode} onValueChange={v => { setDateMode(v); setDateDay(''); setDateMonth(''); setDateYear(''); setDateFrom(''); setDateTo(''); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="day">Día</SelectItem>
              <SelectItem value="month">Mes</SelectItem>
              <SelectItem value="year">Año</SelectItem>
              <SelectItem value="range">Rango</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date inputs */}
        {dateMode === 'day' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Fecha</label>
            <Input type="date" className="h-8 text-xs w-36" value={dateDay} onChange={e => setDateDay(e.target.value)} />
          </div>
        )}
        {dateMode === 'month' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Mes</label>
            <Input type="month" className="h-8 text-xs w-36" value={dateMonth} onChange={e => setDateMonth(e.target.value)} />
          </div>
        )}
        {dateMode === 'year' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Año</label>
            <Input type="number" placeholder="2026" min="2020" max="2099" className="h-8 text-xs w-24" value={dateYear} onChange={e => setDateYear(e.target.value)} />
          </div>
        )}
        {dateMode === 'range' && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Desde</label>
              <Input type="date" className="h-8 text-xs w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Hasta</label>
              <Input type="date" className="h-8 text-xs w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </>
        )}

        {/* Clear filters */}
        {(branchFilter !== 'all' || dateMode !== 'all') && (
          <button
            onClick={() => { setBranchFilter('all'); setDateMode('all'); setDateDay(''); setDateMonth(''); setDateYear(''); setDateFrom(''); setDateTo(''); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive mt-4"
          >
            <X className="w-3 h-3" />Limpiar
          </button>
        )}
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="open">Abiertas</TabsTrigger>
          <TabsTrigger value="paid">Pagadas</TabsTrigger>
          <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
          <TabsTrigger value="voided">Anuladas</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-3">
        {filtered.map(order => {
          const cfg = statusConfig[order.status] || statusConfig.open;
          return (
            <Card key={order.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(order)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${cfg.color}`}>
                    <cfg.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-heading font-semibold">{order.order_number || `ORD-${order.id?.slice(-4)}`}</p>
                    <p className="text-sm text-muted-foreground">{order.customer_name || 'Consumidor Final'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-heading font-bold">C${(order.total || 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.created_date ? format(new Date(order.created_date), 'dd/MM/yy HH:mm') : ''}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && !isLoading && (
          <p className="text-center text-muted-foreground py-12">No hay órdenes</p>
        )}
      </div>

      {/* Order Detail / Edit Dialog */}
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setEditMode(false); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="font-heading">{selected?.order_number}</DialogTitle>
              {isAdmin && selected && !editMode && (
                <Button size="sm" variant="outline" onClick={startEdit} className="text-amber-600 border-amber-300 hover:bg-amber-50">
                  <Edit className="w-3.5 h-3.5 mr-1" />Editar
                </Button>
              )}
            </div>
            {isAdmin && <p className="text-xs text-amber-600 flex items-center gap-1"><ShieldAlert className="w-3 h-3" />Modo administrador</p>}
          </DialogHeader>

          {selected && !editMode && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Cliente</p><p className="font-medium">{selected.customer_name || 'Consumidor Final'}</p></div>
                <div><p className="text-muted-foreground">Estado</p><Badge className={statusConfig[selected.status]?.color}>{statusConfig[selected.status]?.label}</Badge></div>
                <div><p className="text-muted-foreground">Método de Pago</p><p className="font-medium capitalize">{selected.payment_method}</p></div>
                <div><p className="text-muted-foreground">Total</p><p className="font-heading font-bold text-primary">C${(selected.total || 0).toFixed(2)}</p></div>
              </div>
              <div>
                <p className="font-medium text-sm mb-2">Productos</p>
                <div className="space-y-1">
                  {(selected.items || []).map((item, i) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                      <span>{item.product_name} × {item.quantity}</span>
                      <span className="font-medium">C${(item.subtotal || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {selected.notes && <p className="text-sm text-muted-foreground italic">{selected.notes}</p>}
              <Button variant="outline" className="w-full" onClick={() => handleReprint(selected)}>
                <Printer className="w-4 h-4 mr-2" />Reimprimir Ticket
              </Button>
              {selected.status === 'open' && (
                <Button variant="destructive" className="w-full" onClick={() => {
                  updateOrder.mutate({ id: selected.id, data: { status: 'cancelled', voided_reason: 'Cancelada' } });
                  setSelected(null);
                }}>
                  Cancelar Orden
                </Button>
              )}
              {isAdmin && selected.status !== 'voided' && selected.status !== 'cancelled' && (
                <VoidOrderSection order={selected} onVoided={() => setSelected(null)} updateOrder={updateOrder} />
              )}
            </div>
          )}

          {/* ADMIN EDIT MODE */}
          {selected && editMode && editForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cliente</Label>
                  <Select value={editForm.customer_id || 'none'} onValueChange={v => setEditForm({ ...editForm, customer_id: v === 'none' ? '' : v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Consumidor Final" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Consumidor Final</SelectItem>
                      {customers.filter(c => c.is_active !== false).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Método de Pago</Label>
                  <Select value={editForm.payment_method} onValueChange={v => setEditForm({ ...editForm, payment_method: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="credito">Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Estado</Label>
                  <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusConfig).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Notas</Label>
                  <Input className="h-9 text-sm" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
              </div>

              <div>
                <p className="font-medium text-sm mb-2">Productos</p>
                <div className="space-y-1">
                  {editForm.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                      <p className="flex-1 text-sm truncate">{item.product_name}</p>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => updateItemQty(i, e.target.value)}
                        className="w-16 text-center h-8 text-sm"
                      />
                      <p className="text-sm font-medium w-24 text-right">C${(item.subtotal || 0).toFixed(2)}</p>
                      <button onClick={() => removeEditItem(i)} className="text-destructive p-0.5">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-heading font-bold text-base pt-2 border-t mt-2">
                  <span>Total</span>
                  <span className="text-primary">C${(editForm.total || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditMode(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleSaveEdit} disabled={updateOrder.isPending}>
                  Guardar Cambios
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}