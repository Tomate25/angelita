import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Banknote, CreditCard, Smartphone, HandCoins, Check, Search, X, Printer, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { printReceipt } from '@/components/print/PrintReceiptPOS';

const paymentMethods = [
  { value: 'efectivo', label: 'Efectivo', icon: Banknote, color: 'bg-green-500' },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard, color: 'bg-blue-500' },
  { value: 'transferencia', label: 'Transferencia', icon: Smartphone, color: 'bg-purple-500' },
  { value: 'credito', label: 'Crédito', icon: HandCoins, color: 'bg-amber-500' },
];

export default function PaymentModal({ open, onClose, total, customers, onConfirm, preselectedCustomerId, preselectedCustomerName }) {
  const [method, setMethod] = useState('efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropOpen, setCustomerDropOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const prevOpen = useRef(false);
  const customerRef = useRef(null);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setConfirmedOrder(null);
      setCustomerId(preselectedCustomerId || '');
      setCustomerName(preselectedCustomerName || '');
      setMethod(preselectedCustomerId ? 'credito' : 'efectivo');
      setAmountPaid('');
      setNotes('');
      setCustomerSearch('');
      setCustomerDropOpen(false);
    }
    prevOpen.current = open;
  }, [open]);

  const filteredCustomers = customerSearch.trim()
    ? customers.filter(c => c.is_active !== false && (
        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.cedula?.includes(customerSearch) ||
        c.phone?.includes(customerSearch)
      )).slice(0, 8)
    : customers.filter(c => c.is_active !== false).slice(0, 8);

  const selectedCustomerObj = customers.find(c => c.id === customerId);
  const change = method === 'efectivo' ? Math.max(0, (parseFloat(amountPaid) || 0) - total) : 0;
  const quickAmounts = [50, 100, 200, 500, 1000].filter(a => a >= total);

  const handleConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const selectedCustomer = customers.find(c => c.id === customerId);
      const orderData = {
        payment_method: method,
        amount_paid: method === 'efectivo' ? parseFloat(amountPaid) || total : total,
        change_amount: change,
        customer_id: customerId || undefined,
        customer_name: selectedCustomer?.name || customerName || 'Consumidor Final',
        notes,
      };
      const result = await onConfirm(orderData);
      if (result && result.order_number) {
        setConfirmedOrder(result);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Print decision screen
  if (confirmedOrder) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm p-6">
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold">¡Pago Confirmado!</h2>
              <p className="text-muted-foreground text-sm mt-1">Orden {confirmedOrder.order_number}</p>
              <p className="text-2xl font-heading font-bold text-primary mt-2">C${(confirmedOrder.total || 0).toFixed(2)}</p>
            </div>
            <div className="w-full space-y-2">
              <Button className="w-full h-12 text-base gap-2" onClick={() => printReceipt(confirmedOrder, onClose)}>
                <Printer className="w-5 h-5" />
                Imprimir Ticket
              </Button>
              <Button variant="outline" className="w-full h-11" onClick={onClose}>
                Cerrar sin imprimir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[95vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg sm:text-xl">Cobrar Orden</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-5">
          <div className="text-center py-3 bg-primary/5 rounded-xl">
            <p className="text-xs sm:text-sm text-muted-foreground">Total a Cobrar</p>
            <p className="text-3xl sm:text-4xl font-heading font-bold text-primary">C${total.toFixed(2)}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map(pm => (
              <button
                key={pm.value}
                onClick={() => setMethod(pm.value)}
                className={cn(
                  "flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border-2 transition-all",
                  method === pm.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <div className={cn("p-1.5 sm:p-2 rounded-lg shrink-0", pm.color)}>
                  <pm.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="font-medium text-xs sm:text-sm">{pm.label}</span>
              </button>
            ))}
          </div>

          {method === 'efectivo' && (
            <div className="space-y-2">
              <Label>Monto Recibido</Label>
              <Input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder={`C$${total.toFixed(2)}`}
                className="text-lg h-12 font-heading"
              />
              <div className="flex gap-2 flex-wrap">
                {quickAmounts.map(amt => (
                  <Button key={amt} variant="outline" size="sm" onClick={() => setAmountPaid(String(amt))}>
                    C${amt}
                  </Button>
                ))}
                <Button variant="outline" size="sm" onClick={() => setAmountPaid(String(total))}>
                  Exacto
                </Button>
              </div>
              {parseFloat(amountPaid) > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Cambio</p>
                  <p className="text-2xl font-heading font-bold text-green-600">C${change.toFixed(2)}</p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>{method === 'credito' ? 'Cliente (requerido para crédito)' : 'Cliente (opcional)'}</Label>
            <div ref={customerRef} className="relative">
              {selectedCustomerObj && !customerDropOpen ? (
                <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-muted/30">
                  <div>
                    <span className="text-sm font-medium">{selectedCustomerObj.name}</span>
                    {selectedCustomerObj.cedula && <span className="text-xs text-muted-foreground ml-2">{selectedCustomerObj.cedula}</span>}
                  </div>
                  <button onClick={() => { setCustomerId(''); setCustomerName(''); }} className="text-muted-foreground hover:text-destructive">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    className="w-full border rounded-md pl-9 pr-3 py-2 text-sm bg-transparent outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                    placeholder="Buscar por nombre, cédula o teléfono..."
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setCustomerDropOpen(true); }}
                    onFocus={() => setCustomerDropOpen(true)}
                  />
                </div>
              )}
              {customerDropOpen && (
                <div className="absolute left-0 right-0 top-full z-50 bg-card border rounded-b-lg shadow-lg max-h-44 overflow-y-auto">
                  {method !== 'credito' && (
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-muted-foreground"
                      onMouseDown={() => { setCustomerId(''); setCustomerName(''); setCustomerSearch(''); setCustomerDropOpen(false); }}
                    >
                      Consumidor Final
                    </button>
                  )}
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between gap-2"
                      onMouseDown={() => { setCustomerId(c.id); setCustomerName(c.name); setCustomerSearch(''); setCustomerDropOpen(false); }}
                    >
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{c.cedula || ''}</span>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && customerSearch && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <Button
            className="w-full h-12 text-base font-heading font-bold"
            onClick={handleConfirm}
            disabled={(method === 'credito' && !customerId) || isProcessing}
          >
            <Check className="w-5 h-5 mr-2" />
            {isProcessing ? 'Procesando...' : 'Confirmar Pago'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}