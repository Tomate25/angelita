import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { SlidersHorizontal, Plus, Trash2, Search, X, TrendingUp, TrendingDown } from 'lucide-react';

export default function AdjustmentModal({ open, onOpenChange, inventory, branches, products, defaultType = 'entrada' }) {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState('');
  const [type, setType] = useState(defaultType);
  const [movementDate, setMovementDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openProductSelect, setOpenProductSelect] = useState(null);

  useEffect(() => { if (open) { setType(defaultType); setMovementDate(new Date().toISOString().split('T')[0]); } }, [open, defaultType]);

  const branch = branches.find(b => b.id === branchId);
  const branchInventory = inventory.filter(i => i.branch_id === branchId);
  const searchableProducts = products.filter(p => p.is_active !== false);

  const addItem = () => setItems(prev => [...prev, { product_id: '', quantity: '' }]);

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const getInv = (productId) => branchInventory.find(i => i.product_id === productId);

  const isValid = branchId && items.length > 0 && items.every(i => i.product_id && parseFloat(i.quantity) > 0);

  const handleSubmit = async () => {
    setLoading(true);
    for (const item of items) {
      const inv = getInv(item.product_id);
      const product = products.find(p => p.id === item.product_id);
      const productName = inv?.product_name || product?.name || '';
      const qty = parseFloat(item.quantity) || 0;
      const delta = type === 'entrada' ? qty : -qty;
      const prevQty = inv?.quantity || 0;
      const newQty = prevQty + delta;

      if (inv) {
        await base44.entities.Inventory.update(inv.id, {
          quantity: newQty,
          total_value: newQty * (inv.avg_cost || 0),
        });
      } else {
        await base44.entities.Inventory.create({
          product_id: item.product_id,
          product_name: productName,
          branch_id: branchId,
          branch_name: branch?.name || '',
          quantity: newQty,
          avg_cost: product?.cost || 0,
          total_value: newQty * (product?.cost || 0),
        });
      }

      await base44.entities.InventoryMovement.create({
        product_id: item.product_id,
        product_name: productName,
        branch_id: branchId,
        branch_name: branch?.name || '',
        movement_type: 'adjustment',
        quantity: delta,
        unit_cost: inv?.avg_cost || product?.cost || 0,
        previous_stock: prevQty,
        new_stock: newQty,
        notes: notes || (type === 'entrada' ? 'Ajuste de entrada' : 'Ajuste de salida'),
        movement_date: new Date(movementDate + 'T' + new Date().toTimeString().split(' ')[0]).toISOString(),
      });
    }

    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
    toast.success(`Ajuste de ${type} registrado: ${items.length} producto(s) en ${branch?.name}`);
    setLoading(false);
    setBranchId('');
    setType('entrada');
    setNotes('');
    setItems([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-purple-600" />
            Ajuste de Inventario
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Sucursal *</Label>
              <Select value={branchId} onValueChange={v => { setBranchId(v); setItems([]); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar sucursal" /></SelectTrigger>
                <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha del movimiento</Label>
              <Input type="date" value={movementDate} onChange={e => setMovementDate(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de ajuste</Label>
              <div className={`flex items-center gap-2 mt-1 py-2 px-3 rounded-md border-2 text-sm font-medium ${type === 'entrada' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'}`}>
                {type === 'entrada' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {type === 'entrada' ? 'Entrada (+)' : 'Salida (-)'}
              </div>
            </div>
          </div>

          {/* Items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Productos</Label>
              <Button variant="outline" size="sm" onClick={addItem} disabled={!branchId}>
                <Plus className="w-3 h-3 mr-1" />Agregar línea
              </Button>
            </div>

            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg border-dashed">
                {branchId ? 'Agrega al menos un producto para ajustar' : 'Selecciona una sucursal primero'}
              </p>
            )}

            {items.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 font-medium">Producto</th>
                      <th className="text-center p-2 font-medium w-20">Stock actual</th>
                      <th className="text-center p-2 font-medium w-24">Cantidad</th>
                      <th className="text-center p-2 font-medium w-24">Stock nuevo</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const inv = getInv(item.product_id);
                      const qty = parseFloat(item.quantity) || 0;
                      const delta = type === 'entrada' ? qty : -qty;
                      const newStock = (inv?.quantity || 0) + delta;
                      return (
                        <tr key={idx} className="border-t">
                          <td className="p-2">
                            <Popover open={openProductSelect === idx} onOpenChange={o => setOpenProductSelect(o ? idx : null)}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-between h-8 font-normal"
                                  onClick={() => setOpenProductSelect(idx)}
                                >
                                  <span className="truncate">
                                    {item.product_id ? (products.find(p => p.id === item.product_id)?.name || inv?.product_name || '—') : 'Seleccionar producto...'}
                                  </span>
                                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0 max-h-[400px] overflow-y-auto" align="start" side="bottom">
                                <Command>
                                  <CommandInput placeholder="Buscar producto..." />
                                  <CommandList className="max-h-[350px]">
                                    <CommandEmpty>Sin resultados</CommandEmpty>
                                    <CommandGroup>
                                      {searchableProducts.map(p => {
                                        const inv = branchInventory.find(i => i.product_id === p.id);
                                        return (
                                        <CommandItem
                                          key={p.id}
                                          value={p.name}
                                          onSelect={() => { updateItem(idx, 'product_id', p.id); setOpenProductSelect(null); }}
                                        >
                                          <div className="flex flex-col">
                                            <span className="font-medium">{p.name}</span>
                                            <span className="text-xs text-muted-foreground">Stock: {inv?.quantity ?? 0}{p.sku ? ` · SKU: ${p.sku}` : ''}</span>
                                          </div>
                                        </CommandItem>
                                        );
                                      })}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </td>
                          <td className="p-2 text-center text-muted-foreground">
                            {item.product_id ? (inv?.quantity ?? 0) : '—'}
                          </td>
                          <td className="p-2">
                            <Input
                              type="number" min={0.01} step={0.01}
                              className="h-8 text-center"
                              value={item.quantity}
                              onChange={e => updateItem(idx, 'quantity', e.target.value)}
                            />
                          </td>
                          <td className="p-2 text-center font-medium">
                            {item.product_id && qty > 0 ? (
                              <span className={newStock < 0 ? 'text-destructive' : 'text-foreground'}>{newStock.toFixed(2)}</span>
                            ) : '—'}
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1 justify-end">
                              {item.product_id && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => updateItem(idx, 'product_id', '')}>
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label>Motivo / Notas</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: Conteo físico, merma, reposición..." />
          </div>

          <Button
            className={`w-full font-heading font-bold ${type === 'entrada' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
            disabled={!isValid || loading}
            onClick={handleSubmit}
          >
            {loading ? 'Procesando...' : `Confirmar ${type === 'entrada' ? 'Entrada' : 'Salida'} en ${branch?.name || '...'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}