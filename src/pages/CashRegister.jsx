import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, LockOpen, Lock, Banknote, CreditCard, Smartphone, HandCoins, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import PrintCashRegister from '@/components/print/PrintCashRegister';
import { useUserRole } from '@/hooks/useUserRole';

export default function CashRegisterPage() {
  const queryClient = useQueryClient();
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(null);
  const [openAmount, setOpenAmount] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [branchId, setBranchId] = useState('');

  const { isAdmin, isBranchUser, userBranchId: userBranchIdFromProfile, userRole, loading: roleLoading } = useUserRole();

  const { data: registers = [] } = useQuery({
    queryKey: ['cash-registers'],
    queryFn: () => base44.entities.CashRegister.list('-created_date', 50),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  // Resolver branch del usuario: por branch_id guardado o por nombre de rol
  const userBranchId = React.useMemo(() => {
    if (userBranchIdFromProfile) return userBranchIdFromProfile;
    if (isBranchUser && userRole && branches.length > 0) {
      const match = branches.find(b => b.name.toLowerCase() === userRole.toLowerCase());
      return match?.id || null;
    }
    return null;
  }, [userBranchIdFromProfile, isBranchUser, userRole, branches]);

  // Auto-seleccionar sucursal del usuario al abrir el diálogo
  React.useEffect(() => {
    if (isBranchUser && userBranchId && showOpen) {
      setBranchId(userBranchId);
    }
  }, [isBranchUser, userBranchId, showOpen]);

  const openRegister = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      const today = new Date().toISOString().slice(0, 10);
      const alreadyOpen = registers.find(r =>
        r.status === 'open' &&
        r.branch_id === data.branch_id &&
        r.opened_at?.slice(0, 10) === today
      );
      if (alreadyOpen) {
        throw new Error(`Ya existe una caja abierta hoy para esta sucursal (${alreadyOpen.branch_name})`);
      }
      const branch = branches.find(b => b.id === data.branch_id);
      return base44.entities.CashRegister.create({
        ...data,
        branch_name: branch?.name || '',
        status: 'open',
        opened_at: new Date().toISOString(),
        cashier_email: user?.email || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
      setShowOpen(false);
      toast.success('Caja abierta');
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const closeRegister = useMutation({
    mutationFn: async ({ id, actual }) => {
      const reg = registers.find(r => r.id === id);
      const expected = (reg?.opening_amount || 0) + (reg?.cash_sales || 0) + (reg?.cash_in || 0) - (reg?.cash_out || 0);
      return base44.entities.CashRegister.update(id, {
        status: 'closed',
        closed_at: new Date().toISOString(),
        actual_cash: actual,
        expected_cash: expected,
        difference: actual - expected,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-registers'] });
      setShowClose(null);
      toast.success('Caja cerrada');
    },
  });

  const scopedRegisters = isBranchUser && userBranchId
    ? registers.filter(r => r.branch_id === userBranchId)
    : registers;

  const openRegisters = scopedRegisters.filter(r => r.status === 'open');
  const closedRegisters = scopedRegisters.filter(r => r.status === 'closed');

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Caja</h1>
          <p className="text-sm text-muted-foreground">Control de apertura y cierre</p>
        </div>
        <Button onClick={() => setShowOpen(true)}>
          <LockOpen className="w-4 h-4 mr-2" />Abrir Caja
        </Button>
      </div>

      {/* Open Registers */}
      {openRegisters.length > 0 && (
        <div>
          <h2 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <LockOpen className="w-5 h-5 text-green-500" /> Cajas Abiertas
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {openRegisters.map(reg => (
              <Card key={reg.id} className="border-green-500/30">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-heading font-bold text-lg">{reg.branch_name}</p>
                      <p className="text-xs text-muted-foreground">{reg.cashier_email}</p>
                      <p className="text-xs text-muted-foreground">
                        Abierta: {reg.opened_at ? format(new Date(reg.opened_at), 'dd/MM HH:mm') : ''}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Abierta</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div className="flex items-center gap-2"><Banknote className="w-4 h-4 text-green-500" /><div><p className="text-muted-foreground">Apertura</p><p className="font-semibold">C${(reg.opening_amount || 0).toFixed(2)}</p></div></div>
                    <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /><div><p className="text-muted-foreground">Ventas</p><p className="font-semibold">C${(reg.total_sales || 0).toFixed(2)}</p></div></div>
                    <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-500" /><div><p className="text-muted-foreground">Tarjeta</p><p className="font-semibold">C${(reg.card_sales || 0).toFixed(2)}</p></div></div>
                    <div className="flex items-center gap-2"><HandCoins className="w-4 h-4 text-amber-500" /><div><p className="text-muted-foreground">Crédito</p><p className="font-semibold">C${(reg.credit_sales || 0).toFixed(2)}</p></div></div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" variant="outline" onClick={() => { setShowClose(reg); setActualCash(''); }}>
                      <Lock className="w-4 h-4 mr-2" />Cerrar Caja
                    </Button>
                    <PrintCashRegister register={reg} variant="outline" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" /> Historial de Cierres
        </h2>
        <div className="space-y-3">
          {closedRegisters.map(reg => (
            <Card key={reg.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{reg.branch_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {reg.opened_at ? format(new Date(reg.opened_at), 'dd/MM HH:mm') : ''} → {reg.closed_at ? format(new Date(reg.closed_at), 'dd/MM HH:mm') : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-heading font-bold">C${(reg.total_sales || 0).toFixed(2)}</p>
                  <p className={`text-xs font-medium ${(reg.difference || 0) === 0 ? 'text-green-500' : 'text-destructive'}`}>
                    Dif: C${(reg.difference || 0).toFixed(2)}
                  </p>
                </div>
                <PrintCashRegister register={reg} variant="outline" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Open Dialog */}
      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Abrir Caja</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sucursal</Label>
              <Select value={branchId} onValueChange={setBranchId} disabled={isBranchUser && !!userBranchId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {(isBranchUser && userBranchId
                    ? branches.filter(b => b.id === userBranchId)
                    : branches
                  ).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Monto de Apertura</Label><Input type="number" value={openAmount} onChange={e => setOpenAmount(e.target.value)} placeholder="0.00" /></div>
            <Button className="w-full" onClick={() => openRegister.mutate({ branch_id: branchId, opening_amount: parseFloat(openAmount) || 0 })} disabled={!branchId}>Abrir Caja</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Dialog */}
      <Dialog open={!!showClose} onOpenChange={() => setShowClose(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Cerrar Caja</DialogTitle></DialogHeader>
          {showClose && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p><span className="text-muted-foreground">Sucursal:</span> {showClose.branch_name}</p>
                <p><span className="text-muted-foreground">Efectivo esperado:</span> C${((showClose.opening_amount || 0) + (showClose.cash_sales || 0)).toFixed(2)}</p>
              </div>
              <div><Label>Efectivo en Caja</Label><Input type="number" value={actualCash} onChange={e => setActualCash(e.target.value)} placeholder="Contar efectivo..." /></div>
              <Button className="w-full" onClick={() => closeRegister.mutate({ id: showClose.id, actual: parseFloat(actualCash) || 0 })}>
                Confirmar Cierre
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}