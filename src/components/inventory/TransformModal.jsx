import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// inv: current inventory record of the transformable product
// product: full product record (with can_transform, transform_to_product_id, transform_quantity)
// targetProduct: full product record of the resulting product
// targetInventory: current inventory record of the resulting product (same branch)
export default function TransformModal({ open, onOpenChange, inv, product, targetProduct, targetInventory }) {
  const queryClient = useQueryClient();
  const [qty, setQty] = useState(1);

  const resultUnits = qty * (product?.transform_quantity || 0);

  const transform = useMutation({
    mutationFn: async () => {
      if (qty <= 0) throw new Error('Cantidad inválida');
      if (qty > inv.quantity) throw new Error('No hay suficiente stock');

      const newSourceQty = (inv.quantity || 0) - qty;
      const newTargetQty = ((targetInventory?.quantity) || 0) + resultUnits;

      // 1. Descontar del producto original
      await base44.entities.Inventory.update(inv.id, {
        quantity: newSourceQty,
        total_value: newSourceQty * (inv.avg_cost || 0),
      });

      // 2. Sumar al producto destino (o crear si no existe)
      if (targetInventory?.id) {
        await base44.entities.Inventory.update(targetInventory.id, {
          quantity: newTargetQty,
          total_value: newTargetQty * (targetInventory.avg_cost || 0),
        });
      } else {
        await base44.entities.Inventory.create({
          product_id: targetProduct.id,
          product_name: targetProduct.name,
          branch_id: inv.branch_id,
          branch_name: inv.branch_name,
          quantity: resultUnits,
          avg_cost: 0,
          total_value: 0,
        });
      }

      // 3. Registrar movimiento de salida (original)
      await base44.entities.InventoryMovement.create({
        product_id: inv.product_id,
        product_name: inv.product_name,
        branch_id: inv.branch_id,
        branch_name: inv.branch_name,
        movement_type: 'transformation_out',
        quantity: -qty,
        previous_stock: inv.quantity,
        new_stock: newSourceQty,
        notes: `Transformación a ${targetProduct?.name} (${resultUnits} unidades)`,
      });

      // 4. Registrar movimiento de entrada (destino)
      await base44.entities.InventoryMovement.create({
        product_id: targetProduct.id,
        product_name: targetProduct.name,
        branch_id: inv.branch_id,
        branch_name: inv.branch_name,
        movement_type: 'transformation_in',
        quantity: resultUnits,
        previous_stock: targetInventory?.quantity || 0,
        new_stock: newTargetQty,
        notes: `Transformación desde ${inv.product_name} (${qty} unidades)`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast.success(`Transformación completada: ${qty} ${inv.product_name} → ${resultUnits} ${targetProduct?.name}`);
      onOpenChange(false);
      setQty(1);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!product || !targetProduct) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Transformar Unidades
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Visual: origen → destino */}
          <div className="flex items-center justify-between gap-2 bg-muted rounded-lg p-4">
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground mb-1">Origen</p>
              <p className="font-semibold text-sm">{inv.product_name}</p>
              <p className="text-xs text-muted-foreground">Stock: {inv.quantity}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground mb-1">Resultado</p>
              <p className="font-semibold text-sm">{targetProduct.name}</p>
              <p className="text-xs text-muted-foreground">Stock: {targetInventory?.quantity || 0}</p>
            </div>
          </div>

          <div>
            <Label>Cantidad a transformar ({inv.product_name})</Label>
            <Input
              type="number"
              min={1}
              max={inv.quantity}
              value={qty}
              onChange={e => setQty(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">Resultado de la transformación</p>
            <p className="font-heading font-bold text-2xl text-primary">{resultUnits}</p>
            <p className="text-sm font-medium">{targetProduct.name}</p>
          </div>

          <Button
            className="w-full"
            onClick={() => transform.mutate()}
            disabled={transform.isPending || qty <= 0 || qty > inv.quantity}
          >
            {transform.isPending ? 'Transformando...' : 'Confirmar Transformación'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}