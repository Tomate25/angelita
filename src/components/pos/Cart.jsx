import React from 'react';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, ShoppingCart, Percent } from 'lucide-react';
import CustomerSearch from '@/components/pos/CustomerSearch';
import LibraInput from '@/components/pos/LibraInput';

export default function Cart({ order, items, onUpdateQuantity, onRemoveItem, onUpdateDiscount, subtotal, discountTotal, total, onCheckout, customers, onSetCustomer }) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Customer search */}
      <CustomerSearch
        customers={customers}
        selectedId={order?.customer_id || ''}
        onSelect={onSetCustomer}
      />

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Agrega productos</p>
          </div>
        )}
        {items.map((item, idx) => {
          const isLibra = item.unit === 'libra';
          const step = isLibra ? 0.5 : 1;
          const minQty = isLibra ? 0.5 : 1;
          return (
          <div key={idx} className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.product_name}</p>
                <p className="text-xs text-muted-foreground">C${item.unit_price.toFixed(2)} c/u{isLibra ? ' · libra' : ''}</p>
              </div>
              <button onClick={() => onRemoveItem(idx)} className="text-destructive hover:text-destructive/80 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
             {isLibra ? (
                <LibraInput quantity={item.quantity} onChange={(q) => onUpdateQuantity(idx, q)} />
              ) : (
              <div className="flex items-center border rounded-lg bg-card">
               <button
                 onClick={() => onUpdateQuantity(idx, Math.max(minQty, parseFloat((item.quantity - step).toFixed(1))))}
                 className="p-1.5 hover:bg-muted rounded-l-lg"
               >
                 <Minus className="w-3.5 h-3.5" />
               </button>
               <input
                 type="number"
                 value={item.quantity}
                 step={step}
                 min={minQty}
                 onChange={(e) => onUpdateQuantity(idx, Math.max(minQty, parseFloat(e.target.value) || minQty))}
                 className="w-12 text-center text-sm bg-transparent border-x py-1"
               />
               <button
                 onClick={() => onUpdateQuantity(idx, parseFloat((item.quantity + step).toFixed(1)))}
                 className="p-1.5 hover:bg-muted rounded-r-lg"
               >
                 <Plus className="w-3.5 h-3.5" />
               </button>
              </div>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Percent className="w-3 h-3" />
                <input
                  type="number"
                  value={item.discount || 0}
                  onChange={(e) => onUpdateDiscount(idx, Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-10 text-center bg-transparent border rounded px-1 py-0.5"
                  placeholder="0"
                />
              </div>
              <p className="ml-auto font-heading font-semibold text-sm">
                C${item.subtotal.toFixed(2)}
              </p>
            </div>
          </div>
          );
        })}
      </div>

      {/* Totals & Checkout */}
      <div className="border-t p-4 space-y-3">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>C${subtotal.toFixed(2)}</span>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Descuento</span>
              <span>-C${discountTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-heading font-bold text-lg pt-2 border-t">
            <span>Total</span>
            <span className="text-primary">C${total.toFixed(2)}</span>
          </div>
        </div>
        <Button
          className="w-full h-12 text-base font-heading font-bold"
          disabled={items.length === 0}
          onClick={onCheckout}
        >
          Cobrar C${total.toFixed(2)}
        </Button>
      </div>
    </div>
  );
}