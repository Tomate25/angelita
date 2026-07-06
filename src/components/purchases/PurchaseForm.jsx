import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export default function PurchaseForm({ open, onOpenChange, suppliers, branches, products, onSubmit, loading }) {
  const [form, setForm] = useState({ supplier_id: '', branch_id: '', notes: '', approver_emails: '', items: [] });
  const [openProductSelect, setOpenProductSelect] = useState(null);

  const addItem = () => {
    setForm(f => ({ ...f, items: [...f.items, { product_id: '', product_name: '', quantity_ordered: '', unit_cost: '', subtotal: 0 }] }));
  };

  const removeItem = (idx) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'product_id') {
      const p = products.find(pr => pr.id === value);
      items[idx].product_name = p?.name || '';
      items[idx].unit_cost = p?.cost != null ? String(p.cost) : '';
    }
    const qty = parseFloat(items[idx].quantity_ordered) || 0;
    const cost = parseFloat(items[idx].unit_cost) || 0;
    items[idx].subtotal = qty * cost;
    setForm(f => ({ ...f, items }));
  };

  const total = form.items.reduce((s, i) => s + (i.subtotal || 0), 0);

  const handleSubmit = (asDraft) => {
    const supplier = suppliers.find(s => s.id === form.supplier_id);
    const branch = branches.find(b => b.id === form.branch_id);
    const emails = form.approver_emails
      .split(',').map(e => e.trim()).filter(Boolean);
    onSubmit({
      ...form,
      supplier_name: supplier?.name || '',
      branch_name: branch?.name || '',
      total,
      approver_emails: emails,
      status: asDraft ? 'draft' : 'pending_approval',
      purchase_number: `PO-${Date.now().toString(36).toUpperCase()}`,
      items: form.items.map(i => ({
        ...i,
        quantity_ordered: parseFloat(i.quantity_ordered) || 0,
        unit_cost: parseFloat(i.unit_cost) || 0,
      })),
    });
  };

  const valid = form.supplier_id && form.branch_id && form.items.length > 0 && form.items.every(i => i.product_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Nuevo Pedido de Compra</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Header */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Proveedor *</Label>
              <Select value={form.supplier_id} onValueChange={v => setForm(f => ({...f, supplier_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sucursal destino *</Label>
              <Select value={form.branch_id} onValueChange={v => setForm(f => ({...f, branch_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar sucursal" /></SelectTrigger>
                <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Líneas del Pedido</Label>
              <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Agregar línea</Button>
            </div>

            {form.items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg border-dashed">
                Agrega al menos un producto al pedido
              </p>
            )}

            {form.items.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 font-medium">Producto</th>
                      <th className="text-center p-2 font-medium w-20">Cant.</th>
                      <th className="text-right p-2 font-medium w-24">Costo Unit.</th>
                      <th className="text-right p-2 font-medium w-24">Subtotal</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, idx) => (
                      <tr key={idx} className="border-t">
                         <td className="p-2">
                           <Popover open={openProductSelect === idx} onOpenChange={(o) => setOpenProductSelect(o ? idx : null)}>
                             <PopoverTrigger asChild>
                               <Button
                                 variant="outline"
                                 className="w-full justify-between h-8 font-normal"
                                 onClick={() => setOpenProductSelect(idx)}
                               >
                                 <span className="truncate">
                                   {item.product_id ? products.find(p => p.id === item.product_id)?.name : 'Seleccionar producto...'}
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
                                     {products.map(p => (
                                       <CommandItem
                                         key={p.id}
                                         value={p.name}
                                         onSelect={() => {
                                           updateItem(idx, 'product_id', p.id);
                                           setOpenProductSelect(null);
                                         }}
                                       >
                                         <div className="flex flex-col">
                                           <span className="font-medium">{p.name}</span>
                                           {p.sku && <span className="text-xs text-muted-foreground">SKU: {p.sku}</span>}
                                         </div>
                                       </CommandItem>
                                     ))}
                                   </CommandGroup>
                                 </CommandList>
                               </Command>
                             </PopoverContent>
                           </Popover>
                         </td>
                        <td className="p-2">
                         <Input
                           type="number" min={1} className="h-8 text-center"
                           value={item.quantity_ordered}
                           onChange={e => updateItem(idx, 'quantity_ordered', e.target.value)}
                         />
                        </td>
                        <td className="p-2">
                         <Input
                           type="number" min={0} step="0.01" className="h-8 text-right"
                           value={item.unit_cost}
                           onChange={e => updateItem(idx, 'unit_cost', e.target.value)}
                         />
                        </td>
                        <td className="p-2 text-right font-medium">C${(item.subtotal || 0).toFixed(2)}</td>
                        <td className="p-2">
                          <div className="flex gap-1 justify-end">
                            {item.product_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                onClick={() => updateItem(idx, 'product_id', '')}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/50">
                      <td colSpan={3} className="p-2 text-right font-heading font-bold">TOTAL:</td>
                      <td className="p-2 text-right font-heading font-bold text-primary">C${total.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Approvers & Notes */}
          <div>
            <Label>Emails de aprobadores <span className="text-muted-foreground text-xs">(separados por coma)</span></Label>
            <Input
              value={form.approver_emails}
              onChange={e => setForm(f => ({...f, approver_emails: e.target.value}))}
              placeholder="gerente@empresa.com, director@empresa.com"
            />
          </div>
          <div>
            <Label>Notas</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Observaciones..." />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleSubmit(true)} disabled={!valid || loading}>
              Guardar Borrador
            </Button>
            <Button className="flex-1" onClick={() => handleSubmit(false)} disabled={!valid || loading}>
              Enviar a Aprobación
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}