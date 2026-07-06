import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Truck, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import PurchaseForm from '@/components/purchases/PurchaseForm';
import PurchaseDetail from '@/components/purchases/PurchaseDetail';

const statusCfg = {
  draft:            { label: 'Borrador',             color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  pending_approval: { label: 'Pend. Aprobación',     color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  approved:         { label: 'Aprobado',              color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  ordered:          { label: 'Ordenado',              color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  received:         { label: 'Recibido',              color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled:        { label: 'Cancelado',             color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export default function Purchases() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  const { data: purchases = [] } = useQuery({ queryKey: ['purchases'], queryFn: () => base44.entities.Purchase.list('-created_date', 200) });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => base44.entities.Branch.list() });
  const { data: inventory = [] } = useQuery({ queryKey: ['inventory'], queryFn: () => base44.entities.Inventory.list() });

  const GRANADA_ID = '6a086afef0507f6250c95879';

  // Create purchase
  const createPurchase = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      const purchase = await base44.entities.Purchase.create({ ...data, requested_by: user?.email || '' });
      // Send email notification if sent for approval
      if (data.status === 'pending_approval' && data.approver_emails?.length > 0) {
        await base44.functions.invoke('notifyPurchaseApproval', { purchase: { ...purchase, ...data } });
      }
      return purchase;
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setShowForm(false);
      toast.success(data.status === 'pending_approval' ? 'Pedido enviado para aprobación — se notificó a los aprobadores' : 'Pedido guardado como borrador');
    },
  });

  // Approve
  const approvePurchase = useMutation({
    mutationFn: async (purchase) => {
      const user = await base44.auth.me();
      return base44.entities.Purchase.update(purchase.id, {
        status: 'approved',
        approved_by: user?.email || '',
        approved_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setSelected(prev => prev ? { ...prev, status: 'approved' } : null);
      toast.success('Pedido aprobado');
    },
    onError: () => toast.error('Error al aprobar'),
  });

  // Reject
  const rejectPurchase = useMutation({
    mutationFn: (purchase) => base44.entities.Purchase.update(purchase.id, { status: 'cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setSelected(null);
      toast.success('Pedido rechazado');
    },
  });

  // Void purchase (Anular compra y recepción)
  const voidPurchase = useMutation({
    mutationFn: async (purchase) => {
      if (purchase.status === 'received') {
        // 1. Get associated movements
        const movements = await base44.entities.InventoryMovement.filter({ reference_id: purchase.id, reference_type: 'purchase' });
        
        // 2. Rollback inventory
        for (const mov of movements) {
          const existing = inventory.find(i => i.product_id === mov.product_id && i.branch_id === mov.branch_id);
          if (existing) {
            const baseQty = existing.quantity || 0;
            const baseCost = existing.avg_cost || 0;
            const qtyToReverse = mov.quantity;
            const newQty = Math.max(0, baseQty - qtyToReverse);
            
            let newAvgCost = 0;
            if (newQty > 0) {
              const newValue = (baseQty * baseCost) - (qtyToReverse * mov.unit_cost);
              newAvgCost = newValue > 0 ? newValue / newQty : 0;
            }

            await base44.entities.Inventory.update(existing.id, {
              quantity: newQty,
              avg_cost: newAvgCost,
              total_value: newQty * newAvgCost
            });

            await base44.entities.InventoryMovement.create({
              product_id: mov.product_id,
              product_name: mov.product_name,
              branch_id: mov.branch_id,
              branch_name: mov.branch_name,
              movement_type: 'adjustment',
              quantity: -qtyToReverse,
              unit_cost: mov.unit_cost,
              reference_id: purchase.id,
              reference_type: 'purchase_void',
              previous_stock: baseQty,
              new_stock: newQty,
              notes: `Anulación de compra ${purchase.purchase_number}`
            });
          }
        }

        // 3. Cancel supplier invoices
        const invoices = await base44.entities.SupplierInvoice.filter({ purchase_id: purchase.id });
        for (const inv of invoices) {
          await base44.entities.SupplierInvoice.update(inv.id, { status: 'cancelled' });
        }
      }

      // Finally, update purchase status
      return base44.entities.Purchase.update(purchase.id, { status: 'cancelled' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      setSelected(prev => prev ? { ...prev, status: 'cancelled' } : null);
      toast.success('Compra anulada exitosamente');
    },
    onError: () => toast.error('Error al anular la compra'),
  });

  // Mark as ordered (sent to supplier)
  const markOrdered = useMutation({
    mutationFn: (purchase) => base44.entities.Purchase.update(purchase.id, { status: 'ordered' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setSelected(prev => prev ? { ...prev, status: 'ordered' } : null);
      toast.success('Pedido marcado como ordenado al proveedor');
    },
  });

  // Receive merchandise, update inventory, and create supplier invoice
  const receivePurchase = useMutation({
    mutationFn: async ({ purchase, data }) => {
      const { items, supplierInvoiceRef, taxAmount, subtotal, total, dueDate, notes } = data;
      const today = new Date().toISOString().split('T')[0];
      const user = await base44.auth.me();

      // 1. Update purchase status
      await base44.entities.Purchase.update(purchase.id, {
        status: 'received',
        received_date: today,
        items,
      });

      // 2. Update inventory for each item received
      for (const item of items) {
        if (!item.quantity_received || item.quantity_received <= 0) continue;
        const existing = inventory.find(
          inv => inv.product_id === item.product_id && inv.branch_id === purchase.branch_id
        );

        const isGranada = purchase.branch_id === GRANADA_ID;

        // Para Granada: si el registro existe pero tiene qty 0 (inventario inicial),
        // usar el costo del catálogo como base de costo promedio inicial.
        const baseQty = existing?.quantity || 0;
        const baseCost = isGranada && baseQty === 0
          ? (products.find(p => p.id === item.product_id)?.cost || item.unit_cost || 0)
          : (existing?.avg_cost || 0);

        const newQty = baseQty + item.quantity_received;
        const newAvgCost = baseQty === 0
          ? (item.unit_cost || 0)
          : (baseCost * baseQty + (item.unit_cost || 0) * item.quantity_received) / newQty;

        if (existing?.id) {
          await base44.entities.Inventory.update(existing.id, {
            quantity: newQty,
            avg_cost: newAvgCost,
            total_value: newQty * newAvgCost,
          });
        } else {
          await base44.entities.Inventory.create({
            product_id: item.product_id,
            product_name: item.product_name,
            branch_id: purchase.branch_id,
            branch_name: purchase.branch_name,
            quantity: item.quantity_received,
            avg_cost: item.unit_cost || 0,
            total_value: item.quantity_received * (item.unit_cost || 0),
          });
        }

        // Solo actualizar el costo del catálogo si NO es Granada
        // (Granada calcula su propio promedio sin contaminar el catálogo global)
        if (item.product_id && !isGranada) {
          await base44.entities.Product.update(item.product_id, { cost: newAvgCost });
        }

        await base44.entities.InventoryMovement.create({
          product_id: item.product_id,
          product_name: item.product_name,
          branch_id: purchase.branch_id,
          branch_name: purchase.branch_name,
          movement_type: 'purchase',
          quantity: item.quantity_received,
          unit_cost: item.unit_cost || 0,
          reference_id: purchase.id,
          reference_type: 'purchase',
          previous_stock: existing?.quantity || 0,
          new_stock: (existing?.quantity || 0) + item.quantity_received,
          notes: `Recepción de compra ${purchase.purchase_number}`,
        });
      }

      // 3. Create supplier invoice (Cuenta por Pagar) — only if not already created
      const existingInvoice = await base44.entities.SupplierInvoice.filter({ purchase_id: purchase.id });
      if (existingInvoice.length === 0) {
        await base44.entities.SupplierInvoice.create({
          invoice_number: supplierInvoiceRef || `FAC-${purchase.purchase_number}`,
          purchase_id: purchase.id,
          purchase_number: purchase.purchase_number,
          supplier_id: purchase.supplier_id,
          supplier_name: purchase.supplier_name,
          branch_id: purchase.branch_id,
          branch_name: purchase.branch_name,
          items,
          subtotal,
          tax_amount: taxAmount,
          total,
          balance: total,
          due_date: dueDate,
          status: 'pending',
          notes,
          received_by: user?.email || '',
          received_date: today,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      setSelected(null);
      toast.success('Mercadería recibida, inventario actualizado y factura enviada a Cuentas por Pagar');
    },
    onError: () => toast.error('Error al recibir la mercadería'),
  });

  const filtered = purchases.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search && !p.supplier_name?.toLowerCase().includes(search.toLowerCase()) && !p.purchase_number?.includes(search)) return false;
    return true;
  });

  const tabCounts = {
    pending_approval: purchases.filter(p => p.status === 'pending_approval').length,
    approved: purchases.filter(p => p.status === 'approved').length,
    ordered: purchases.filter(p => p.status === 'ordered').length,
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Compras</h1>
          <p className="text-sm text-muted-foreground">Gestión de pedidos y recepción de mercadería</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />Nuevo Pedido
          </Button>
        </div>
      </div>

      {/* Flow indicator */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto pb-1">
        {['Borrador', 'Pend. Aprobación', 'Aprobado', 'Ordenado', 'Recibido'].map((s, i, arr) => (
          <React.Fragment key={s}>
            <span className="whitespace-nowrap px-2 py-1 bg-muted rounded">{s}</span>
            {i < arr.length - 1 && <ChevronRight className="w-3 h-3 shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="draft">Borradores</TabsTrigger>
          <TabsTrigger value="pending_approval" className="relative">
            Aprobación {tabCounts.pending_approval > 0 && <span className="ml-1 bg-yellow-500 text-white rounded-full text-xs w-4 h-4 flex items-center justify-center">{tabCounts.pending_approval}</span>}
          </TabsTrigger>
          <TabsTrigger value="approved">Aprobados {tabCounts.approved > 0 && <span className="ml-1 bg-blue-500 text-white rounded-full text-xs w-4 h-4 flex items-center justify-center">{tabCounts.approved}</span>}</TabsTrigger>
          <TabsTrigger value="ordered">Ordenados</TabsTrigger>
          <TabsTrigger value="received">Recibidos</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {filtered.map(p => (
          <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(p)}>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/10"><Truck className="w-5 h-5 text-secondary" /></div>
                <div>
                  <p className="font-heading font-semibold">{p.purchase_number}</p>
                  <p className="text-sm text-muted-foreground">{p.supplier_name} · {p.branch_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(p.items || []).length} producto(s) · {p.created_date ? format(new Date(p.created_date), 'dd/MM/yyyy') : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-heading font-bold">C${(p.total || 0).toFixed(2)}</p>
                  <Badge className={statusCfg[p.status]?.color}>{statusCfg[p.status]?.label}</Badge>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-16">No hay pedidos en este estado</p>
        )}
      </div>

      <PurchaseForm
        open={showForm}
        onOpenChange={setShowForm}
        suppliers={suppliers}
        branches={branches}
        products={products}
        onSubmit={(data) => createPurchase.mutate(data)}
        loading={createPurchase.isPending}
      />

      <PurchaseDetail
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        purchase={selected}
        onApprove={(p) => approvePurchase.mutate(p)}
        onReject={(p) => rejectPurchase.mutate(p)}
        onMarkOrdered={(p) => markOrdered.mutate(p)}
        onReceive={(p, data) => receivePurchase.mutate({ purchase: p, data })}
        onVoid={(p) => voidPurchase.mutate(p)}
        approving={approvePurchase.isPending}
        receiving={receivePurchase.isPending}
        voiding={voidPurchase.isPending}
      />
    </div>
  );
}