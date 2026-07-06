import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { XCircle } from 'lucide-react';

export default function VoidOrderSection({ order, onVoided, updateOrder }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState('');

  const handleVoid = () => {
    if (!reason.trim()) return;
    updateOrder.mutate(
      { id: order.id, data: { status: 'voided', voided_reason: reason } },
      { onSuccess: () => { onVoided(); } }
    );
  };

  if (!showConfirm) {
    return (
      <Button
        variant="outline"
        className="w-full text-red-600 border-red-300 hover:bg-red-50"
        onClick={() => setShowConfirm(true)}
      >
        <XCircle className="w-4 h-4 mr-2" />Anular Orden
      </Button>
    );
  }

  return (
    <div className="border border-red-200 rounded-lg p-3 space-y-3 bg-red-50">
      <p className="text-sm font-medium text-red-700">¿Confirmar anulación de esta orden?</p>
      <div>
        <Label className="text-xs text-red-600">Motivo de anulación *</Label>
        <Input
          className="h-9 text-sm mt-1"
          placeholder="Ej: Error en la venta, devolución..."
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 text-sm" onClick={() => setShowConfirm(false)}>
          Cancelar
        </Button>
        <Button
          variant="destructive"
          className="flex-1 text-sm"
          disabled={!reason.trim() || updateOrder.isPending}
          onClick={handleVoid}
        >
          Confirmar Anulación
        </Button>
      </div>
    </div>
  );
}