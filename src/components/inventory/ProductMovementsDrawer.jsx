import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Package, TrendingDown, TrendingUp, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';

const movementTypes = {
  sale: { label: 'Venta', icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
  purchase: { label: 'Compra', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
  transfer_in: { label: 'Traslado entrada', icon: ArrowLeftRight, color: 'text-blue-500', bg: 'bg-blue-50' },
  transfer_out: { label: 'Traslado salida', icon: ArrowLeftRight, color: 'text-orange-500', bg: 'bg-orange-50' },
  adjustment: { label: 'Ajuste', icon: Package, color: 'text-purple-500', bg: 'bg-purple-50' },
  transformation_in: { label: 'Transformación +', icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50' },
  transformation_out: { label: 'Transformación -', icon: TrendingDown, color: 'text-amber-500', bg: 'bg-amber-50' },
  return: { label: 'Devolución', icon: TrendingUp, color: 'text-indigo-500', bg: 'bg-indigo-50' },
};

export default function ProductMovementsDrawer({ open, onOpenChange, inv, movements }) {
  if (!inv) return null;

  const CUTOFF = new Date('2026-06-08T00:00:00');
  const productMovements = movements
    .filter(m => {
      if (m.product_id !== inv.product_id || m.branch_id !== inv.branch_id) return false;
      // Si tiene movement_date, usarla; si no, usar created_date
      const movementDate = m.movement_date ? new Date(m.movement_date) : new Date(m.created_date);
      // Para Cofradía, mostrar todos los movimientos con movement_date (inicialización)
      if (m.movement_date) return true;
      // Para otros, aplicar cutoff
      return movementDate >= CUTOFF;
    })
    .sort((a, b) => {
      const dateA = a.movement_date ? new Date(a.movement_date) : new Date(a.created_date);
      const dateB = b.movement_date ? new Date(b.movement_date) : new Date(b.created_date);
      return dateB - dateA;
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-heading text-lg">{inv.product_name}</SheetTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{inv.branch_name}</span>
            <span>•</span>
            <span className="font-semibold text-foreground text-base">{inv.quantity} en stock</span>
            <span>•</span>
            <span>C${(inv.avg_cost || 0).toFixed(2)} c/u</span>
          </div>
        </SheetHeader>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            {productMovements.length} movimientos registrados
          </p>

          {productMovements.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Sin movimientos registrados</p>
            </div>
          )}

          {productMovements.map(m => {
            const mt = movementTypes[m.movement_type] || { label: m.movement_type, icon: Package, color: 'text-muted-foreground', bg: 'bg-muted' };
            const Icon = mt.icon;
            const isPositive = m.quantity > 0;
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                <div className={`p-2 rounded-lg ${mt.bg} flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${mt.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{mt.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.notes || '—'}
                  </p>
                  {(m.previous_stock != null && m.new_stock != null) && (
                    <p className="text-xs text-muted-foreground">
                      {m.previous_stock} → {m.new_stock}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-heading font-bold text-sm ${isPositive ? 'text-green-600' : 'text-destructive'}`}>
                    {isPositive ? '+' : ''}{m.quantity}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.movement_date ? format(new Date(m.movement_date), 'dd/MM/yy HH:mm') : (m.created_date ? format(new Date(m.created_date), 'dd/MM/yy HH:mm') : '')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}