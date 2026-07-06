import React, { useState } from 'react';
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
import { Search, FileText, DollarSign, ChevronRight, AlertCircle } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { toast } from 'sonner';

const fmt = (n) => Number(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusCfg = {
  pending:   { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  partial:   { label: 'Parcial',   color: 'bg-blue-100 text-blue-700' },
  paid:      { label: 'Pagado',    color: 'bg-green-100 text-green-700' },
  overdue:   { label: 'Vencido',   color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-700' },
};

export default function AccountsPayable() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'transferencia', reference: '', notes: '' });

  const { data: invoices = [] } = useQuery({
    queryKey: ['supplier-invoices'],
    queryFn: () => base44.entities.SupplierInvoice.list('-created_date', 200),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['supplier-payments'],
    queryFn: () => base44.entities.SupplierPayment.list('-created_date', 500),
  });

  const payMutation = useMutation({
    mutationFn: async ({ invoice, amount, method, reference, notes }) => {
      await base44.entities.SupplierPayment.create({
        supplier_invoice_id: invoice.id,
        supplier_id: invoice.supplier_id,
        supplier_name: invoice.supplier_name,
        amount,
        payment_method: method,
        reference,
        branch_id: invoice.branch_id,
        notes,
      });
      const newBalance = (invoice.balance ?? invoice.total) - amount;
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';
      await base44.entities.SupplierInvoice.update(invoice.id, {
        balance: Math.max(0, newBalance),
        status: newStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      setPayModal(false);
      setSelected(null);
      toast.success('Pago registrado correctamente');
    },
    onError: () => toast.error('Error al registrar el pago'),
  });

  // Auto-mark overdue
  const enriched = invoices.map(inv => {
    if (inv.status === 'pending' && inv.due_date && isPast(parseISO(inv.due_date))) {
      return { ...inv, status: 'overdue' };
    }
    return inv;
  });

  const filtered = enriched.filter(inv => {
    if (filter !== 'all' && inv.status !== filter) return false;
    if (search && !inv.supplier_name?.toLowerCase().includes(search.toLowerCase()) && !inv.invoice_number?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPending = enriched.filter(i => ['pending', 'partial', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.balance ?? i.total), 0);

  const invoicePayments = selected ? payments.filter(p => p.supplier_invoice_id === selected.id) : [];

  const handlePay = () => {
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) return toast.error('Monto inválido');
    payMutation.mutate({
      invoice: selected,
      amount,
      method: payForm.payment_method,
      reference: payForm.reference,
      notes: payForm.notes,
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Cuentas por Pagar</h1>
          <p className="text-sm text-muted-foreground">Facturas de proveedores pendientes de pago</p>
        </div>
        <div className="relative sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar proveedor o factura..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {/* Summary card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="w-5 h-5 text-primary" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Total pendiente de pago</p>
            <p className="text-2xl font-heading font-bold text-primary">C${fmt(totalPending)}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="pending">Pendientes</TabsTrigger>
          <TabsTrigger value="overdue" className="text-red-600">Vencidas</TabsTrigger>
          <TabsTrigger value="partial">Parciales</TabsTrigger>
          <TabsTrigger value="paid">Pagadas</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {filtered.map(inv => {
          const balance = inv.balance ?? inv.total;
          const isOverdue = inv.status === 'overdue';
          return (
            <Card key={inv.id} className={`cursor-pointer hover:shadow-md transition-shadow ${isOverdue ? 'border-red-200' : ''}`} onClick={() => setSelected(inv)}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isOverdue ? 'bg-red-100' : 'bg-secondary/10'}`}>
                    {isOverdue ? <AlertCircle className="w-5 h-5 text-red-500" /> : <FileText className="w-5 h-5 text-secondary" />}
                  </div>
                  <div>
                    <p className="font-heading font-semibold">{inv.invoice_number || inv.purchase_number}</p>
                    <p className="text-sm text-muted-foreground">{inv.supplier_name} · {inv.branch_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence: {inv.due_date ? format(parseISO(inv.due_date), 'dd/MM/yyyy') : '—'}
                      {inv.purchase_number && ` · Pedido: ${inv.purchase_number}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-heading font-bold">C${fmt(balance)}</p>
                    <p className="text-xs text-muted-foreground">de C${fmt(inv.total)}</p>
                    <Badge className={statusCfg[inv.status]?.color}>{statusCfg[inv.status]?.label}</Badge>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-16">No hay facturas en este estado</p>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="font-heading">{selected.invoice_number || selected.purchase_number}</DialogTitle>
                <Badge className={statusCfg[selected.status]?.color}>{statusCfg[selected.status]?.label}</Badge>
              </div>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Proveedor:</span> <span className="font-medium">{selected.supplier_name}</span></div>
                <div><span className="text-muted-foreground">Sucursal:</span> <span className="font-medium">{selected.branch_name}</span></div>
                <div><span className="text-muted-foreground">Vencimiento:</span> <span className="font-medium">{selected.due_date ? format(parseISO(selected.due_date), 'dd/MM/yyyy') : '—'}</span></div>
                <div><span className="text-muted-foreground">Recibido:</span> <span className="font-medium">{selected.received_date ? format(parseISO(selected.received_date), 'dd/MM/yyyy') : '—'}</span></div>
                {selected.notes && <div className="col-span-2"><span className="text-muted-foreground">Notas:</span> {selected.notes}</div>}
              </div>

              {/* Items */}
              {(selected.items || []).length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2 font-medium">Producto</th>
                        <th className="text-center p-2 font-medium">Cant.</th>
                        <th className="text-right p-2 font-medium">Costo</th>
                        <th className="text-right p-2 font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.product_name}</td>
                          <td className="p-2 text-center">{item.quantity_received}</td>
                          <td className="p-2 text-right">C${fmt(item.unit_cost)}</td>
                          <td className="p-2 text-right font-medium">C${fmt(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/50">
                        <td colSpan={3} className="p-2 text-right font-medium">Subtotal:</td>
                        <td className="p-2 text-right">C${fmt(selected.subtotal)}</td>
                      </tr>
                      {(selected.tax_amount || 0) > 0 && (
                        <tr className="bg-muted/50">
                          <td colSpan={3} className="p-2 text-right font-medium">IVA/Impuestos:</td>
                          <td className="p-2 text-right">C${fmt(selected.tax_amount)}</td>
                        </tr>
                      )}
                      <tr className="bg-muted/50 font-bold">
                        <td colSpan={3} className="p-2 text-right font-heading">TOTAL:</td>
                        <td className="p-2 text-right text-primary font-heading">C${fmt(selected.total)}</td>
                      </tr>
                      <tr className="bg-muted/50">
                        <td colSpan={3} className="p-2 text-right text-muted-foreground">Saldo pendiente:</td>
                        <td className="p-2 text-right font-bold text-destructive">C${fmt(selected.balance ?? selected.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Payment history */}
              {invoicePayments.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Pagos Realizados</p>
                  <div className="space-y-1">
                    {invoicePayments.map(p => (
                      <div key={p.id} className="flex justify-between text-sm bg-green-50 dark:bg-green-950/20 rounded px-3 py-2">
                        <span className="text-muted-foreground">{p.created_date ? format(new Date(p.created_date), 'dd/MM/yyyy') : ''} — {p.payment_method} {p.reference ? `(${p.reference})` : ''}</span>
                        <span className="font-medium text-green-700">C${fmt(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {['pending', 'partial', 'overdue'].includes(selected.status) && (
                <Button className="w-full" onClick={() => { setPayForm({ amount: String(selected.balance ?? selected.total), payment_method: 'transferencia', reference: '', notes: '' }); setPayModal(true); }}>
                  <DollarSign className="w-4 h-4 mr-2" />Registrar Pago
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Pay Modal */}
      <Dialog open={payModal} onOpenChange={setPayModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Registrar Pago a Proveedor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Monto a pagar</Label>
              <Input type="number" min={0} step="0.01" value={payForm.amount} onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} />
              <p className="text-xs text-muted-foreground mt-1">Saldo pendiente: C${fmt(selected?.balance ?? selected?.total)}</p>
            </div>
            <div>
              <Label>Método de pago</Label>
              <Select value={payForm.payment_method} onValueChange={v => setPayForm(f => ({...f, payment_method: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Referencia (No. transferencia, cheque, etc.)</Label>
              <Input placeholder="Opcional" value={payForm.reference} onChange={e => setPayForm(f => ({...f, reference: e.target.value}))} />
            </div>
            <div>
              <Label>Notas</Label>
              <Input placeholder="Opcional" value={payForm.notes} onChange={e => setPayForm(f => ({...f, notes: e.target.value}))} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPayModal(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handlePay} disabled={payMutation.isPending}>
                {payMutation.isPending ? 'Guardando...' : 'Confirmar Pago'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}