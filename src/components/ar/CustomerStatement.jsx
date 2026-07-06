import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { format } from 'date-fns';

const today = () => format(new Date(), 'yyyy-MM-dd');
const firstOfMonth = () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

export default function CustomerStatement({ open, onClose }) {
  const [customerId, setCustomerId] = useState('all');
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-ar-stmt'],
    queryFn: () => base44.entities.Customer.list('name', 500),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-receivable-stmt'],
    queryFn: () => base44.entities.AccountReceivable.list('-created_date', 1000),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['ar-payments-stmt'],
    queryFn: () => base44.entities.ARPayment.list('-created_date', 1000),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders-ar-stmt'],
    queryFn: () => base44.entities.Order.list('-created_date', 1000),
  });

  // Filter orders (consumptions) by date + customer
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status !== 'paid' && o.status !== 'confirmed') return false;
      const d = (o.created_date || '').substring(0, 10);
      if (d < dateFrom || d > dateTo) return false;
      if (customerId !== 'all' && o.customer_id !== customerId) return false;
      return true;
    });
  }, [orders, customerId, dateFrom, dateTo]);

  // Filter AR accounts by customer
  const filteredAR = useMemo(() => {
    return accounts.filter(a => {
      if (customerId !== 'all' && a.customer_id !== customerId) return false;
      return true;
    });
  }, [accounts, customerId]);

  // Filter payments by customer + date
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const d = (p.created_date || '').substring(0, 10);
      if (d < dateFrom || d > dateTo) return false;
      if (customerId !== 'all' && p.customer_id !== customerId) return false;
      return true;
    });
  }, [payments, customerId, dateFrom, dateTo]);

  // Summary per customer
  const customerSummaries = useMemo(() => {
    const targets = customerId === 'all' ? customers : customers.filter(c => c.id === customerId);
    return targets.map(c => {
      const cOrders = filteredOrders.filter(o => o.customer_id === c.id);
      const cPayments = filteredPayments.filter(p => p.customer_id === c.id);
      const cAR = filteredAR.filter(a => a.customer_id === c.id);
      const totalConsumed = cOrders.reduce((s, o) => s + (o.total || 0), 0);
      const totalPaid = cPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const balance = cAR.filter(a => a.status !== 'paid').reduce((s, a) => s + (a.balance || 0), 0);
      return { customer: c, orders: cOrders, payments: cPayments, totalConsumed, totalPaid, balance };
    }).filter(s => s.orders.length > 0 || s.balance > 0);
  }, [customers, customerId, filteredOrders, filteredPayments, filteredAR]);

  const exportCSV = () => {
    const rows = [['Cliente', 'Fecha', 'Tipo', 'Orden/Ref', 'Monto', 'Método', 'Saldo AR']];
    customerSummaries.forEach(s => {
      s.orders.forEach(o => {
        rows.push([s.customer.name, (o.created_date || '').substring(0, 10), 'Consumo', o.order_number || o.id, (o.total || 0).toFixed(2), o.payment_method || '', '']);
      });
      s.payments.forEach(p => {
        rows.push([s.customer.name, (p.created_date || '').substring(0, 10), 'Pago', '', (p.amount || 0).toFixed(2), p.payment_method || '', '']);
      });
      rows.push([s.customer.name, '', 'SALDO PENDIENTE', '', '', '', s.balance.toFixed(2)]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `estado_cuenta_${dateFrom}_${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />Estado de Cuenta por Cliente
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end border-b pb-4">
          <div>
            <Label className="text-xs">Cliente</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-36" />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-36" />
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 ml-auto">
            <Download className="w-4 h-4" />CSV
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {customerSummaries.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-10">Sin movimientos en el período</p>
          ) : customerSummaries.map(s => (
            <div key={s.customer.id} className="border rounded-lg overflow-hidden">
              {/* Customer Header */}
              <div className="bg-muted/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-heading font-semibold">{s.customer.name}</p>
                  <p className="text-xs text-muted-foreground">{s.customer.phone || s.customer.email || ''}</p>
                </div>
                <div className="flex gap-4 text-right">
                  <div><p className="text-xs text-muted-foreground">Consumos</p><p className="font-bold text-primary">C${s.totalConsumed.toFixed(2)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Pagos</p><p className="font-bold text-green-600">C${s.totalPaid.toFixed(2)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Saldo</p><p className={`font-bold ${s.balance > 0 ? 'text-destructive' : 'text-green-600'}`}>C${s.balance.toFixed(2)}</p></div>
                </div>
              </div>

              {/* Orders (consumptions) */}
              {s.orders.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted/20 border-b">Consumos / Ventas</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/10">
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fecha</th>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Orden</th>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Método</th>
                        <th className="px-4 py-2 text-right font-medium text-muted-foreground">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.orders.map(o => (
                        <tr key={o.id} className="border-b hover:bg-muted/20">
                          <td className="px-4 py-2">{o.created_date ? format(new Date(o.created_date), 'dd/MM/yyyy') : '-'}</td>
                          <td className="px-4 py-2 font-medium">{o.order_number || o.id?.slice(-6)}</td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="text-[10px]">{o.payment_method}</Badge>
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">C${(o.total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Items detail per order */}
              {customerId !== 'all' && s.orders.map(o => (
                o.items?.length > 0 && (
                  <div key={`items-${o.id}`} className="border-t">
                    <p className="px-4 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/10">
                      Detalle — {o.order_number || o.id?.slice(-6)} ({o.created_date ? format(new Date(o.created_date), 'dd/MM/yyyy') : ''})
                    </p>
                    <table className="w-full text-xs">
                      <tbody>
                        {o.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-dashed">
                            <td className="px-6 py-1.5 text-muted-foreground">{item.product_name}</td>
                            <td className="px-4 py-1.5 text-muted-foreground">× {item.quantity}</td>
                            <td className="px-4 py-1.5 text-right">C${(item.subtotal || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ))}

              {/* Payments */}
              {s.payments.length > 0 && (
                <div className="border-t">
                  <p className="px-4 py-2 text-xs font-semibold text-green-700 uppercase bg-green-50/50 border-b">Pagos Recibidos</p>
                  <table className="w-full text-xs">
                    <tbody>
                      {s.payments.map(p => (
                        <tr key={p.id} className="border-b hover:bg-muted/20">
                          <td className="px-4 py-2">{p.created_date ? format(new Date(p.created_date), 'dd/MM/yyyy') : '-'}</td>
                          <td className="px-4 py-2 text-muted-foreground">{p.reference || 'Pago'}</td>
                          <td className="px-4 py-2"><Badge variant="outline" className="text-[10px]">{p.payment_method}</Badge></td>
                          <td className="px-4 py-2 text-right font-semibold text-green-600">C${(p.amount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Balance row */}
              <div className={`px-4 py-2 flex justify-end text-sm font-heading font-bold border-t ${s.balance > 0 ? 'bg-red-50 text-destructive' : 'bg-green-50 text-green-700'}`}>
                Saldo Pendiente: C${s.balance.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}