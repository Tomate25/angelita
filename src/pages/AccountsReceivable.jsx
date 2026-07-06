import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, AlertTriangle, Clock, CheckCircle2, Search, CreditCard, FileText } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import CustomerStatement from '@/components/ar/CustomerStatement';
import { useUserRole } from '@/hooks/useUserRole';

const fmt = (n) => Number(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusMap = {
  pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  partial: { label: 'Parcial', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  paid: { label: 'Pagada', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  overdue: { label: 'Vencida', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export default function AccountsReceivable() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [showStatement, setShowStatement] = useState(false);

  const { isAdmin, isBranchUser, userBranchId } = useUserRole();
  const [branchFilter, setBranchFilter] = useState('all');

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-receivable'],
    queryFn: () => base44.entities.AccountReceivable.list('-created_date', 200),
  });

  const payMutation = useMutation({
    mutationFn: async ({ ar, amount }) => {
      await base44.entities.ARPayment.create({
        account_receivable_id: ar.id,
        customer_id: ar.customer_id,
        customer_name: ar.customer_name,
        amount,
        payment_method: paymentMethod,
        branch_id: ar.branch_id,
      });
      const newBalance = Math.max(0, (ar.balance || 0) - amount);
      await base44.entities.AccountReceivable.update(ar.id, {
        balance: newBalance,
        status: newBalance <= 0 ? 'paid' : 'partial',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      setShowPayment(null);
      toast.success('Pago registrado exitosamente');
    },
  });

  const scopedAccounts = isBranchUser && userBranchId
    ? accounts.filter(a => a.branch_id === userBranchId)
    : accounts;

  const totalPending = scopedAccounts.filter(a => a.status !== 'paid').reduce((s, a) => s + (a.balance || 0), 0);
  const overdue = scopedAccounts.filter(a => a.due_date && new Date(a.due_date) < new Date() && a.status !== 'paid');

  const filtered = scopedAccounts.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (branchFilter !== 'all' && a.branch_id !== branchFilter) return false;
    if (search && !a.customer_name?.toLowerCase().includes(search.toLowerCase()) && !a.order_number?.includes(search)) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Cuentas por Cobrar</h1>
          <p className="text-sm text-muted-foreground">Control de créditos</p>
        </div>
        <Button variant="outline" onClick={() => setShowStatement(true)} className="gap-2">
          <FileText className="w-4 h-4" />Estado de Cuenta
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><CreditCard className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Total Pendiente</p><p className="font-heading font-bold">C${fmt(totalPending)}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">Vencidas</p><p className="font-heading font-bold">{overdue.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10"><Clock className="w-5 h-5 text-amber-500" /></div>
            <div><p className="text-xs text-muted-foreground">Pendientes</p><p className="font-heading font-bold">{accounts.filter(a => a.status === 'pending').length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle2 className="w-5 h-5 text-green-500" /></div>
            <div><p className="text-xs text-muted-foreground">Pagadas</p><p className="font-heading font-bold">{accounts.filter(a => a.status === 'paid').length}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="pending">Pendientes</TabsTrigger>
            <TabsTrigger value="partial">Parciales</TabsTrigger>
            <TabsTrigger value="paid">Pagadas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        {!isBranchUser && branches.length > 1 && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sucursal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {branches.filter(b => !b.is_warehouse).map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-3">
        {filtered.map(ar => {
          const cfg = statusMap[ar.status] || statusMap.pending;
          const daysOverdue = ar.due_date ? differenceInDays(new Date(), new Date(ar.due_date)) : 0;
          return (
            <Card key={ar.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-heading font-semibold">{ar.customer_name}</p>
                    <p className="text-sm text-muted-foreground">Orden: {ar.order_number}</p>
                    {ar.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Vence: {format(new Date(ar.due_date), 'dd/MM/yyyy')}
                        {daysOverdue > 0 && ar.status !== 'paid' && (
                          <span className="text-destructive ml-1">({daysOverdue} días vencida)</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Saldo</p>
                      <p className="font-heading font-bold text-lg">C${fmt(ar.balance)}</p>
                      <Badge className={cfg.color}>{cfg.label}</Badge>
                    </div>
                    {ar.status !== 'paid' && (
                      <Button size="sm" onClick={() => { setShowPayment(ar); setPaymentAmount(String(ar.balance || 0)); }}>
                        <DollarSign className="w-4 h-4 mr-1" />Pagar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CustomerStatement open={showStatement} onClose={() => setShowStatement(false)} />

      {/* Payment Dialog */}
      <Dialog open={!!showPayment} onOpenChange={() => setShowPayment(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Registrar Pago</DialogTitle></DialogHeader>
          {showPayment && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="font-medium">{showPayment.customer_name}</p>
                <p className="text-sm text-muted-foreground">Saldo: C${fmt(showPayment.balance)}</p>
              </div>
              <div><Label>Monto del Pago</Label><Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></div>
              <div>
                <Label>Método</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => payMutation.mutate({ ar: showPayment, amount: parseFloat(paymentAmount) || 0 })}>
                Confirmar Pago
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}