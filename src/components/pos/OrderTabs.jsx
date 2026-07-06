import React from 'react';
import { Plus, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OrderTabs({ orders, activeOrderId, onSelectOrder, onAddOrder, onCloseOrder, customers }) {
  return (
    <div className="flex flex-col items-center gap-1 py-2 px-1 border-r bg-muted/30 shrink-0 overflow-y-auto w-14">
      {orders.map(order => {
        const isActive = order.id === activeOrderId;
        const customer = customers.find(c => c.id === order.customer_id);
        const label = customer?.name || order.customer_name || order.label;
        const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
        const shortLabel = label?.substring(0, 2).toUpperCase() || '?';

        return (
          <div key={order.id} className="relative group w-10">
            <button
              onClick={() => onSelectOrder(order.id)}
              title={label}
              className={cn(
                "w-10 h-10 rounded-lg text-xs font-bold flex items-center justify-center transition-all border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              )}
            >
              {shortLabel}
            </button>
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 rounded-full w-4 h-4 text-[9px] font-bold flex items-center justify-center bg-primary text-white pointer-events-none">
                {itemCount}
              </span>
            )}
            {orders.length > 1 && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onCloseOrder(order.id); }}
                className="absolute -top-1 -left-1 rounded-full w-3.5 h-3.5 bg-destructive text-white hidden group-hover:flex items-center justify-center cursor-pointer"
              >
                <X className="w-2 h-2" />
              </span>
            )}
          </div>
        );
      })}

      <button
        onClick={onAddOrder}
        title="Nueva orden"
        className="w-10 h-10 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all border border-dashed border-border hover:border-primary/40 flex items-center justify-center mt-1"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}