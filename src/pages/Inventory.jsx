import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Package, AlertTriangle, ArrowLeftRight, TrendingDown, TrendingUp, RefreshCw, Truck, Download, SlidersHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import TransformModal from '@/components/inventory/TransformModal';
import TransferModal from '@/components/inventory/TransferModal';
import ProductMovementsDrawer from '@/components/inventory/ProductMovementsDrawer';
import AdjustmentModal from '@/components/inventory/AdjustmentModal';
import BulkInitializeModal from '@/components/inventory/BulkInitializeModal';
import TransfersHistory from '@/components/inventory/TransfersHistory';
import PrintInventoryReport from '@/components/print/PrintInventoryReport';
import { useUserRole } from '@/hooks/useUserRole';

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [tab, setTab] = useState('stock');
  const [transformData, setTransformData] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedInv, setSelectedInv] = useState(null);
  const [adjustmentType, setAdjustmentType] = useState(null); // 'entrada' | 'salida'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showBulkInit, setShowBulkInit] = useState(false);

  const queryClient = useQueryClient();
  const { isAdmin, isBranchUser, userBranchId } = useUserRole();

  // Auto-lock branch filter for branch users
  useEffect(() => {
    if (isBranchUser && userBranchId) setBranchFilter(userBranchId);
  }, [isBranchUser, userBranchId]);

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => base44.entities.Inventory.list('-created_date', 2000),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['inventory-movements'],
    queryFn: () => base44.entities.InventoryMovement.list('-created_date', 2000),
    refetchOnWindowFocus: true,
  });

  // Refrescar movimientos cuando se abre el drawer
  useEffect(() => {
    if (selectedInv) {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
    }
  }, [selectedInv, queryClient]);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date', 1000),
  });

  const GRANADA_ID = '6a086afef0507f6250c95879';

  const filtered = inventory.filter(i => {
    if (branchFilter !== 'all' && i.branch_id !== branchFilter) return false;
    if (search && !i.product_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).map(i => {
    // Para Granada: si avg_cost es 0, mostrar el costo del catálogo
    if (i.branch_id === GRANADA_ID && !i.avg_cost) {
      const catalogCost = products.find(p => p.id === i.product_id)?.cost || 0;
      return { ...i, avg_cost: catalogCost, total_value: i.quantity * catalogCost };
    }
    return i;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    const aZero = (a.quantity || 0) <= 0;
    const bZero = (b.quantity || 0) <= 0;
    if (aZero !== bZero) return aZero ? 1 : -1;
    return (a.product_name || '').localeCompare(b.product_name || '', 'es');
  });

  const totalValue = filtered.reduce((s, i) => s + (i.total_value || 0), 0);
  const lowItems = filtered.filter(i => i.quantity <= 5);

  const movementTypes = {
    sale: { label: 'Venta', icon: TrendingDown, color: 'text-red-500' },
    purchase: { label: 'Compra', icon: TrendingUp, color: 'text-green-500' },
    transfer_in: { label: 'Entrada', icon: ArrowLeftRight, color: 'text-blue-500' },
    transfer_out: { label: 'Salida', icon: ArrowLeftRight, color: 'text-orange-500' },
    adjustment: { label: 'Ajuste', icon: Package, color: 'text-purple-500' },
    transformation_in: { label: 'Transformación +', icon: TrendingUp, color: 'text-teal-500' },
    transformation_out: { label: 'Transformación -', icon: TrendingDown, color: 'text-amber-500' },
  };

  const GRANADA_CUTOFF = '2026-06-08';

  const filteredMovements = movements.filter(m => {
    if (isBranchUser && userBranchId && m.branch_id !== userBranchId) return false;
    if (branchFilter !== 'all' && m.branch_id !== branchFilter) return false;
    if (search && !m.product_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && m.created_date && m.created_date.slice(0, 10) < dateFrom) return false;
    if (dateTo && m.created_date && m.created_date.slice(0, 10) > dateTo) return false;
    // Granada: solo movimientos desde 08/06/2026
    if (m.branch_id === GRANADA_ID && m.created_date && m.created_date.slice(0, 10) < GRANADA_CUTOFF) return false;
    return true;
  });

  const downloadCSV = (headers, lines, filename) => {
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportInventory = (rows) => {
    const headers = ['Producto', 'Sucursal', 'Cantidad', 'Costo Promedio (C$)', 'Valor Total (C$)', 'Alerta'];
    const lines = rows.map(i => [
      (i.product_name || '').replace(/,/g, ';'),
      (i.branch_name || '').replace(/,/g, ';'),
      i.quantity,
      (i.avg_cost || 0).toFixed(2),
      (i.total_value || 0).toFixed(2),
      i.quantity <= 5 ? 'Stock bajo' : '',
    ].join(','));
    downloadCSV(headers, lines, 'inventario.csv');
  };

  const exportKardex = (rows) => {
    const headers = ['Fecha', 'Producto', 'Sucursal', 'Tipo', 'Cantidad', 'Costo Unit. (C$)', 'Stock Anterior', 'Stock Nuevo', 'Notas'];
    const lines = rows.map(m => [
      m.created_date ? format(new Date(m.created_date), 'dd/MM/yyyy HH:mm') : '',
      (m.product_name || '').replace(/,/g, ';'),
      (m.branch_name || '').replace(/,/g, ';'),
      movementTypes[m.movement_type]?.label || m.movement_type,
      m.quantity,
      m.unit_cost || 0,
      m.previous_stock ?? '',
      m.new_stock ?? '',
      (m.notes || '').replace(/,/g, ';'),
    ].join(','));
    downloadCSV(headers, lines, 'kardex.csv');
  };

  const handleTransformClick = (inv) => {
    const product = products.find(p => p.id === inv.product_id);
    if (!product?.can_transform || !product?.transform_to_product_id) return;
    const targetProduct = products.find(p => p.id === product.transform_to_product_id);
    if (!targetProduct) return;
    const targetInventory = inventory.find(
      i => i.product_id === targetProduct.id && i.branch_id === inv.branch_id
    );
    setTransformData({ inv, product, targetProduct, targetInventory: targetInventory || null });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Inventario</h1>
          <p className="text-sm text-muted-foreground">Valorización: C${totalValue.toLocaleString('es', {minimumFractionDigits: 2})}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Sucursal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Button variant="outline" onClick={() => setShowTransfer(true)} className="text-blue-600 border-blue-300 hover:bg-blue-50 gap-1">
            <Truck className="w-4 h-4" />Traslado
          </Button>
          <Button variant="outline" onClick={() => setAdjustmentType('entrada')} className="text-green-600 border-green-300 hover:bg-green-50 gap-1">
            <TrendingUp className="w-4 h-4" />Entrada
          </Button>
          <Button variant="outline" onClick={() => setAdjustmentType('salida')} className="text-red-600 border-red-300 hover:bg-red-50 gap-1">
            <TrendingDown className="w-4 h-4" />Salida
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowBulkInit(true)} className="text-purple-600 border-purple-300 hover:bg-purple-50 gap-1">
              <SlidersHorizontal className="w-4 h-4" />Inicializar
            </Button>
          )}
          <PrintInventoryReport
            title="Reporte de Inventario"
            branchName={branchFilter !== 'all' ? branches.find(b => b.id === branchFilter)?.name : 'Todas las sucursales'}
            rows={filtered.map(inv => ({
              producto: inv.product_name,
              sucursal: inv.branch_name,
              cantidad: inv.quantity,
              costo_prom: `C$${(inv.avg_cost || 0).toFixed(2)}`,
              valor_total: `C$${(inv.total_value || 0).toFixed(2)}`,
              alerta: inv.quantity <= 5 ? '⚠ Stock bajo' : '',
            }))}
            columns={[
              { key: 'producto', label: 'Producto' },
              { key: 'sucursal', label: 'Sucursal' },
              { key: 'cantidad', label: 'Cantidad', align: 'right' },
              { key: 'costo_prom', label: 'Costo Prom.', align: 'right' },
              { key: 'valor_total', label: 'Valor Total', align: 'right' },
              { key: 'alerta', label: 'Alerta' },
            ]}
            summary={[
              { label: 'Total artículos', value: filtered.length },
              { label: 'Valorización', value: `C$${totalValue.toFixed(2)}` },
            ]}
          />
        </div>
      </div>

      {lowItems.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-50 dark:bg-amber-900/10">
          <CardContent className="p-3 flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="font-medium text-amber-700 dark:text-amber-400">{lowItems.length} productos con stock bajo</span>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="stock">Existencias</TabsTrigger>
          <TabsTrigger value="movements">Kardex</TabsTrigger>
          <TabsTrigger value="transfers">Traslados</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => exportInventory(sortedFiltered)}>
              <Download className="w-3 h-3" />Exportar CSV
            </Button>
          </div>
          <div className="grid gap-3">
            {sortedFiltered.map(inv => {
              const product = products.find(p => p.id === inv.product_id);
              const canTransform = product?.can_transform && product?.transform_to_product_id && inv.quantity > 0;
              return (
                <Card key={inv.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedInv(inv)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${inv.quantity <= 5 ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                        <Package className={`w-5 h-5 ${inv.quantity <= 5 ? 'text-destructive' : 'text-primary'}`} />
                      </div>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {inv.product_name}
                          {canTransform && (
                            <Badge variant="outline" className="text-xs text-teal-600 border-teal-300">
                              <RefreshCw className="w-3 h-3 mr-1" />Transformable
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{inv.branch_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {canTransform && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-teal-600 border-teal-300 hover:bg-teal-50"
                          onClick={e => { e.stopPropagation(); handleTransformClick(inv); }}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Transformar
                        </Button>
                      )}
                      <div className="text-right">
                        <p className="font-heading font-bold text-lg">{inv.quantity}</p>
                        <p className="text-xs text-muted-foreground">C${(inv.avg_cost || 0).toFixed(2)} c/u</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-12">Sin inventario registrado</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          {/* Date range filters */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Desde:</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm w-36" />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Hasta:</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm w-36" />
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDateFrom(''); setDateTo(''); }}>Limpiar</Button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 ml-auto" onClick={() => exportKardex(filteredMovements)}>
              <Download className="w-3 h-3" />Exportar CSV
            </Button>
          </div>
          <div className="space-y-2">
            {(filteredMovements).map(m => {
              const mt = movementTypes[m.movement_type] || { label: m.movement_type, icon: Package, color: 'text-muted-foreground' };
              return (
                <Card key={m.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <mt.icon className={`w-4 h-4 ${mt.color}`} />
                      <div>
                        <p className="font-medium text-sm">{m.product_name}</p>
                        <p className="text-xs text-muted-foreground">{mt.label} — {m.branch_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-heading font-semibold ${m.quantity > 0 ? 'text-green-500' : 'text-destructive'}`}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.created_date ? format(new Date(m.created_date), 'dd/MM HH:mm') : ''}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="transfers" className="mt-4">
          <TransfersHistory branches={branches} inventory={inventory} />
        </TabsContent>
      </Tabs>

      <TransferModal
        open={showTransfer}
        onOpenChange={setShowTransfer}
        inventory={inventory}
        branches={branches}
        products={products}
      />

      <ProductMovementsDrawer
        open={!!selectedInv}
        onOpenChange={(open) => !open && setSelectedInv(null)}
        inv={selectedInv}
        movements={movements}
      />

      <AdjustmentModal
        open={!!adjustmentType}
        onOpenChange={(open) => !open && setAdjustmentType(null)}
        defaultType={adjustmentType}
        inventory={inventory}
        branches={branches}
        products={products}
      />

      {isAdmin && (
        <BulkInitializeModal
          open={showBulkInit}
          onOpenChange={setShowBulkInit}
          inventory={inventory}
          branches={branches}
          products={products}
        />
      )}

      {transformData && (
        <TransformModal
          open={!!transformData}
          onOpenChange={(open) => !open && setTransformData(null)}
          inv={transformData.inv}
          product={transformData.product}
          targetProduct={transformData.targetProduct}
          targetInventory={transformData.targetInventory}
        />
      )}
    </div>
  );
}