import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ArrowRight, Plus, Trash2, Truck, ChevronsUpDown, Check, Hash } from 'lucide-react';
import LibraInput from '@/components/pos/LibraInput';

export default function TransferModal({ open, onOpenChange, inventory, branches, products }) {
  const queryClient = useQueryClient();
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);
  const [loading, setLoading] = useState(false);
  const [previewNumber, setPreviewNumber] = useState('');

  const fromBranch = branches.find(b => b.id === fromBranchId);
  const toBranch = branches.find(b => b.id === toBranchId);

  useEffect(() => {
    if (open) {
      generateTransferNumber().then(setPreviewNumber);
    }
  }, [open]);

  const availableFrom = inventory.filter(i => i.branch_id === fromBranchId && i.quantity > 0);

  const addItem = () => setItems(prev => [...prev, { product_id: '', quantity: 1 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const getStock = (productId) => {
    const inv = inventory.find(i => i.product_id === productId && i.branch_id === fromBranchId);
    return inv?.quantity || 0;
  };

  const isValid = fromBranchId && toBranchId && fromBranchId !== toBranchId &&
    items.length > 0 && items.every(item => item.product_id && item.quantity > 0 &&
      item.quantity <= getStock(item.product_id));

  const generateTransferNumber = async () => {
    const existing = await base44.entities.Transfer.list('-created_date', 1);
    const last = existing[0]?.transfer_number;
    const lastNum = last ? parseInt(last.replace('TRF-', '')) || 0 : 0;
    return `TRF-${String(lastNum + 1).padStart(5, '0')}`;
  };

  const handleTransfer = async () => {
    setLoading(true);

    const transferNumber = previewNumber || await generateTransferNumber();
    const totalValue = items.reduce((s, item) => {
      const sourceInv = inventory.find(i => i.product_id === item.product_id && i.branch_id === fromBranchId);
      return s + item.quantity * (sourceInv?.avg_cost || 0);
    }, 0);

    const transferItems = [];

    for (const item of items) {
      const sourceInv = inventory.find(i => i.product_id === item.product_id && i.branch_id === fromBranchId);
      const product = products.find(p => p.id === item.product_id);
      if (!sourceInv) continue;

      transferItems.push({
        product_id: item.product_id,
        product_name: product?.name || sourceInv.product_name,
        quantity: item.quantity,
        unit_cost: sourceInv.avg_cost || 0,
      });

      const newSourceQty = sourceInv.quantity - item.quantity;
      await base44.entities.Inventory.update(sourceInv.id, {
        quantity: newSourceQty,
        total_value: newSourceQty * (sourceInv.avg_cost || 0),
      });

      let destInv = inventory.find(i => i.product_id === item.product_id && i.branch_id === toBranchId);
      if (destInv) {
        const newDestQty = destInv.quantity + item.quantity;
        await base44.entities.Inventory.update(destInv.id, {
          quantity: newDestQty,
          avg_cost: destInv.avg_cost || sourceInv.avg_cost || 0,
          total_value: newDestQty * (destInv.avg_cost || sourceInv.avg_cost || 0),
        });
      } else {
        await base44.entities.Inventory.create({
          product_id: item.product_id,
          product_name: product?.name || sourceInv.product_name,
          branch_id: toBranchId,
          branch_name: toBranch?.name || '',
          quantity: item.quantity,
          avg_cost: sourceInv.avg_cost || 0,
          total_value: item.quantity * (sourceInv.avg_cost || 0),
        });
      }

      await base44.entities.InventoryMovement.create({
        product_id: item.product_id,
        product_name: product?.name || sourceInv.product_name,
        branch_id: fromBranchId,
        branch_name: fromBranch?.name || '',
        movement_type: 'transfer_out',
        quantity: -item.quantity,
        unit_cost: sourceInv.avg_cost || 0,
        reference_id: transferNumber,
        reference_type: 'transfer',
        notes: `${transferNumber} — Traslado a ${toBranch?.name}`,
      });

      await base44.entities.InventoryMovement.create({
        product_id: item.product_id,
        product_name: product?.name || sourceInv.product_name,
        branch_id: toBranchId,
        branch_name: toBranch?.name || '',
        movement_type: 'transfer_in',
        quantity: item.quantity,
        unit_cost: sourceInv.avg_cost || 0,
        reference_id: transferNumber,
        reference_type: 'transfer',
        notes: `${transferNumber} — Traslado desde ${fromBranch?.name}`,
      });
    }

    // Guardar registro del traslado
    await base44.entities.Transfer.create({
      transfer_number: transferNumber,
      from_branch_id: fromBranchId,
      from_branch_name: fromBranch?.name || '',
      to_branch_id: toBranchId,
      to_branch_name: toBranch?.name || '',
      items: transferItems,
      total_value: totalValue,
    });

    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
    toast.success(`Traslado ${transferNumber} completado — ${items.length} producto(s) enviados a ${toBranch?.name}`);
    setLoading(false);
    setFromBranchId('');
    setToBranchId('');
    setItems([{ product_id: '', quantity: 1 }]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2 flex-wrap">
            <Truck className="w-5 h-5 text-primary" />
            Traslado de Inventario
            {previewNumber && (
              <Badge variant="secondary" className="ml-auto gap-1 font-mono">
                <Hash className="w-3 h-3" />{previewNumber}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* From / To */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="text-xs">Origen</Label>
              <Select value={fromBranchId} onValueChange={v => { setFromBranchId(v); setItems([{ product_id: '', quantity: 1 }]); }}>
                <SelectTrigger><SelectValue placeholder="Bodega origen" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground mt-5 shrink-0" />
            <div className="flex-1">
              <Label className="text-xs">Destino</Label>
              <Select value={toBranchId} onValueChange={setToBranchId}>
                <SelectTrigger><SelectValue placeholder="Bodega destino" /></SelectTrigger>
                <SelectContent>
                  {branches.filter(b => b.id !== fromBranchId).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <Label className="text-xs">Productos a trasladar</Label>
            <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
            {items.map((item, idx) => {
              const stock = getStock(item.product_id);
              const exceedsStock = item.product_id && item.quantity > stock;
              const selectedInv = availableFrom.find(i => i.product_id === item.product_id);
              const product = products.find(p => p.id === item.product_id);
              const isLibra = product?.unit === 'libra';
              return (
                <div key={idx} className="border rounded-lg p-2.5 space-y-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        disabled={!fromBranchId}
                        className="flex-1 justify-between text-xs font-normal h-9 truncate"
                      >
                        <span className="truncate">
                          {selectedInv ? `${selectedInv.product_name} (stock: ${selectedInv.quantity})` : 'Seleccionar producto'}
                        </span>
                        <ChevronsUpDown className="w-3 h-3 shrink-0 opacity-50 ml-1" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar producto..." className="text-xs" />
                        <CommandList>
                          <CommandEmpty>Sin resultados</CommandEmpty>
                          {availableFrom.map(inv => (
                            <CommandItem
                              key={inv.product_id}
                              value={inv.product_name}
                              onSelect={() => updateItem(idx, 'product_id', inv.product_id)}
                              className="text-xs"
                            >
                              <Check className={`w-3 h-3 mr-2 ${item.product_id === inv.product_id ? 'opacity-100' : 'opacity-0'}`} />
                              {inv.product_name} (stock: {inv.quantity})
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-destructive p-1 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="text-[11px] text-muted-foreground">Cantidad{isLibra ? ' (libra)' : ''}</Label>
                    {isLibra ? (
                      <LibraInput quantity={item.quantity} onChange={(q) => updateItem(idx, 'quantity', q)} />
                    ) : (
                      <div className="w-24">
                        <Input
                          type="number"
                          min={1}
                          max={stock}
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                          className={`text-center text-sm ${exceedsStock ? 'border-destructive' : ''}`}
                        />
                      </div>
                    )}
                  </div>
                  {exceedsStock && (
                    <p className="text-[11px] text-destructive">La cantidad excede el stock disponible ({stock}).</p>
                  )}
                </div>
              );
            })}
            </div>
            <Button variant="outline" size="sm" onClick={addItem} disabled={!fromBranchId} className="w-full">
              <Plus className="w-3.5 h-3.5 mr-1" />Agregar producto
            </Button>
          </div>

          <Button
            className="w-full font-heading font-bold"
            disabled={!isValid || loading}
            onClick={handleTransfer}
          >
            {loading ? 'Procesando...' : `Confirmar Traslado a ${toBranch?.name || '...'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}