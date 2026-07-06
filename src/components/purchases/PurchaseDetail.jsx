import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, PackageCheck, Mail, Truck, Ban } from 'lucide-react';
import ReceiveModal from './ReceiveModal';

const statusCfg = {
  draft:            { label: 'Borrador',           color: 'bg-gray-100 text-gray-700' },
  pending_approval: { label: 'Pendiente Aprobación', color: 'bg-yellow-100 text-yellow-700' },
  approved:         { label: 'Aprobado',            color: 'bg-blue-100 text-blue-700' },
  ordered:          { label: 'Ordenado',            color: 'bg-indigo-100 text-indigo-700' },
  received:         { label: 'Recibido',            color: 'bg-green-100 text-green-700' },
  cancelled:        { label: 'Cancelado',           color: 'bg-red-100 text-red-700' },
};

export default function PurchaseDetail({ open, onOpenChange, purchase, onApprove, onReject, onMarkOrdered, onReceive, onVoid, approving, receiving, voiding }) {
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  if (!purchase) return null;
  const st = statusCfg[purchase.status] || { label: purchase.status, color: 'bg-gray-100 text-gray-700' };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-heading">{purchase.purchase_number}</DialogTitle>
            <Badge className={st.color}>{st.label}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Proveedor:</span> <span className="font-medium">{purchase.supplier_name}</span></div>
            <div><span className="text-muted-foreground">Sucursal:</span> <span className="font-medium">{purchase.branch_name}</span></div>
            {purchase.requested_by && <div><span className="text-muted-foreground">Solicitado por:</span> <span className="font-medium">{purchase.requested_by}</span></div>}
            {purchase.approved_by && <div><span className="text-muted-foreground">Aprobado por:</span> <span className="font-medium">{purchase.approved_by}</span></div>}
            {purchase.notes && <div className="col-span-2"><span className="text-muted-foreground">Notas:</span> <span>{purchase.notes}</span></div>}
            {purchase.approver_emails?.length > 0 && (
              <div className="col-span-2 flex items-center gap-1 text-muted-foreground">
                <Mail className="w-3 h-3" />
                <span className="text-xs">{purchase.approver_emails.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 font-medium">Producto</th>
                  <th className="text-center p-2 font-medium">Pedido</th>
                  {purchase.status === 'received' && <th className="text-center p-2 font-medium">Recibido</th>}
                  <th className="text-right p-2 font-medium">Costo</th>
                  <th className="text-right p-2 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(purchase.items || []).map((item, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2 font-medium">{item.product_name}</td>
                    <td className="p-2 text-center">{item.quantity_ordered}</td>
                    {purchase.status === 'received' && <td className="p-2 text-center text-green-600 font-medium">{item.quantity_received ?? item.quantity_ordered}</td>}
                    <td className="p-2 text-right">C${(item.unit_cost || 0).toFixed(2)}</td>
                    <td className="p-2 text-right font-medium">C${(item.subtotal || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/50 font-bold">
                  <td colSpan={purchase.status === 'received' ? 4 : 3} className="p-2 text-right font-heading">TOTAL:</td>
                  <td className="p-2 text-right text-primary font-heading">C${(purchase.total || 0).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {purchase.status === 'pending_approval' && (
              <>
                <Button className="flex-1" onClick={() => onApprove(purchase)} disabled={approving}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {approving ? 'Aprobando...' : 'Aprobar'}
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => onReject(purchase)} disabled={approving}>
                  <XCircle className="w-4 h-4 mr-2" />Rechazar
                </Button>
              </>
            )}
            {purchase.status === 'approved' && (
              <Button className="flex-1" onClick={() => onMarkOrdered(purchase)}>
                <Truck className="w-4 h-4 mr-2" />Marcar como Ordenado
              </Button>
            )}
            {purchase.status === 'ordered' && (
              <Button className="flex-1" onClick={() => setShowReceiveModal(true)}>
                <PackageCheck className="w-4 h-4 mr-2" />Recibir Mercadería y Generar Factura
              </Button>
            )}
          </div>
          
          {purchase.status !== 'cancelled' && (
            <div className="pt-4 mt-4 border-t">
              <Button variant="destructive" className="w-full" onClick={() => {
                if (window.confirm('¿Estás seguro de que deseas anular esta compra? Si ya fue recibida, se revertirá el inventario y se cancelará la factura.')) {
                  onVoid(purchase);
                }
              }} disabled={voiding}>
                <Ban className="w-4 h-4 mr-2" />
                {voiding ? 'Anulando...' : 'Anular Compra'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <ReceiveModal
      open={showReceiveModal}
      onOpenChange={setShowReceiveModal}
      purchase={purchase}
      onConfirm={(data) => { onReceive(purchase, data); setShowReceiveModal(false); }}
      loading={receiving}
    />
    </>
  );
}