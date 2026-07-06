import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PackageCheck, FileText } from 'lucide-react';
import { addDays, format } from 'date-fns';

export default function ReceiveModal({ open, onOpenChange, purchase, onConfirm, loading }) {
  const [receivedQtys, setReceivedQtys] = useState({});
  const [supplierInvoiceRef, setSupplierInvoiceRef] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  if (!purchase) return null;

  const getQty = (idx, item) => {
    const v = receivedQtys[idx];
    return v !== undefined ? v : String(item.quantity_ordered ?? '');
  };

  const items = (purchase.items || []).map((item, idx) => ({
    ...item,
    quantity_received: parseFloat(getQty(idx, item)) || 0,
    subtotal: (parseFloat(getQty(idx, item)) || 0) * (item.unit_cost || 0),
  }));

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const tax = parseFloat(taxAmount) || 0;
  const total = subtotal + tax;

  const handleConfirm = () => {
    if (!supplierInvoiceRef.trim()) {
      alert('Por favor ingresa el número de factura del proveedor');
      return;
    }
    onConfirm({
      items,
      supplierInvoiceRef,
      taxAmount: tax,
      subtotal,
      total,
      dueDate,
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-secondary" />
            Recibir Mercadería — {purchase.purchase_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Supplier invoice reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>N° Factura del Proveedor</Label>
              <Input
                placeholder="Ej: F-00123"
                value={supplierInvoiceRef}
                onChange={e => setSupplierInvoiceRef(e.target.value)}
              />
            </div>
            <div>
              <Label>Fecha de Vencimiento (pago)</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Items */}
          <div>
            <Label className="text-base font-semibold mb-2 block">Cantidades Recibidas</Label>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 font-medium">Producto</th>
                    <th className="text-center p-2 font-medium">Pedido</th>
                    <th className="text-center p-2 font-medium">Recibido</th>
                    <th className="text-right p-2 font-medium">Costo Unit.</th>
                    <th className="text-right p-2 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(purchase.items || []).map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 font-medium">{item.product_name}</td>
                      <td className="p-2 text-center text-muted-foreground">{item.quantity_ordered}</td>
                      <td className="p-2">
                        <Input
                          type="number" min={0}
                          className="h-7 text-center w-20 mx-auto"
                          value={getQty(idx, item)}
                          onChange={e => setReceivedQtys(q => ({ ...q, [idx]: e.target.value }))}
                        />
                      </td>
                      <td className="p-2 text-right">C${(item.unit_cost || 0).toFixed(2)}</td>
                      <td className="p-2 text-right font-medium">
                        C${((parseFloat(getQty(idx, item)) || 0) * (item.unit_cost || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 bg-muted/40 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal mercadería:</span>
              <span className="font-medium">C${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm gap-4">
              <Label className="whitespace-nowrap">IVA / Impuestos:</Label>
              <Input
                type="number" min={0} step="0.01"
                className="h-7 w-32 text-right"
                placeholder="0.00"
                value={taxAmount}
                onChange={e => setTaxAmount(e.target.value)}
              />
            </div>
            <div className="flex justify-between font-heading font-bold text-primary border-t pt-2">
              <span>TOTAL FACTURA:</span>
              <span>C${total.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <Label>Notas</Label>
            <Input placeholder="Observaciones de la recepción..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Info box */}
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
            <FileText className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Al confirmar se actualizará el inventario y se registrará la factura <strong>#{supplierInvoiceRef || '(número requerido)'}</strong> en Cuentas por Pagar por <strong>C${total.toFixed(2)}</strong> con vencimiento <strong>{dueDate}</strong>.</span>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={loading}>
              <PackageCheck className="w-4 h-4 mr-2" />
              {loading ? 'Procesando...' : 'Confirmar Recepción y Generar Factura'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}