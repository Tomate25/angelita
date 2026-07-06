import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight, Truck, ArrowRight, Download, Search, XCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Agrupa movimientos transfer_out sin reference_id:
// mismo branch_id + mismo notes + mismo minuto (YYYY-MM-DD HH:MM)
function groupLegacyMovements(movements, branches) {
  const groupMap = new Map();
  const groupOrder = [];

  for (const m of movements) {
    const d = m.created_date ? new Date(m.created_date) : new Date();
    // Clave: branch + notes + año-mes-dia-hora-minuto
    const minuteKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
    const key = `${m.branch_id}||${m.notes || ''}||${minuteKey}`;

    if (groupMap.has(key)) {
      const g = groupMap.get(key);
      g.items.push(m);
      g.total_value += Math.abs(m.quantity) * (m.unit_cost || 0);
    } else {
      const toName = m.notes?.replace('Traslado a ', '') || '?';
      const toBranch = branches.find(b => b.name === toName || b.name.toLowerCase() === toName.toLowerCase());
      const g = {
        id: `legacy-${m.id}`,
        isLegacy: true,
        transfer_number: null,
        from_branch_id: m.branch_id,
        from_branch_name: m.branch_name,
        to_branch_id: toBranch?.id || '',
        to_branch_name: toName,
        created_date: m.created_date,
        notes: m.notes,
        status: 'active',
        items: [m],
        total_value: Math.abs(m.quantity) * (m.unit_cost || 0),
      };
      groupMap.set(key, g);
      groupOrder.push(g);
    }
  }

  const groups = groupOrder;

  // Ordenar por fecha ascendente para asignar consecutivos cronológicamente
  groups.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  groups.forEach((g, idx) => {
    g.transfer_number = `HIS-${String(idx + 1).padStart(4, '0')}`;
  });

  // Reordenar descendente para mostrar
  groups.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  groups.forEach(g => {
    g.transferItems = g.items.map(i => ({
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: Math.abs(i.quantity),
      unit_cost: i.unit_cost || 0,
    }));
  });

  return groups;
}

export default function TransfersHistory({ branches, inventory = [] }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedIds, setExpandedIds] = useState({});
  const [voidTarget, setVoidTarget] = useState(null);
  const [voiding, setVoiding] = useState(false);

  const { data: transfers = [] } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => base44.entities.Transfer.list('-created_date', 500),
  });

  const { data: legacyMovements = [] } = useQuery({
    queryKey: ['inventory-movements', 'transfers-legacy'],
    queryFn: () => base44.entities.InventoryMovement.filter({ movement_type: 'transfer_out' }, '-created_date', 500),
  });

  // Transfers con transfer_number asignado (incluyendo voided de legacy)
  const linkedRefs = new Set(transfers.map(t => t.transfer_number).filter(Boolean));
  // Mapa de transfer_number -> status para detectar legacy anulados
  const transferStatusMap = new Map(transfers.map(t => [t.transfer_number, t.status]));

  const unlinkedMovements = legacyMovements.filter(m => !m.reference_id || !linkedRefs.has(m.reference_id));

  const legacyGroups = groupLegacyMovements(unlinkedMovements, branches);
  // Aplicar status persistido si existe (ej: legacy anulado)
  legacyGroups.forEach(g => {
    if (g.transfer_number && transferStatusMap.has(g.transfer_number)) {
      g.status = transferStatusMap.get(g.transfer_number);
    }
  });

  // Normalizar transfers nuevos al mismo shape (excluir los que son solo registros de anulación de legacy)
  const legacyTransferNumbers = new Set(legacyGroups.map(g => g.transfer_number).filter(Boolean));
  const newTransfers = transfers
    .filter(t => !legacyTransferNumbers.has(t.transfer_number))
    .map(t => ({
      ...t,
      isLegacy: false,
      transferItems: (t.items || []),
      movementIds: [],
    }));

  // Combinar y ordenar
  const allTransfers = [...newTransfers, ...legacyGroups].sort(
    (a, b) => new Date(b.created_date) - new Date(a.created_date)
  );

  const filtered = allTransfers.filter(t => {
    if (branchFilter !== 'all' && t.from_branch_id !== branchFilter && t.to_branch_id !== branchFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const matchesBranch = t.from_branch_name?.toLowerCase().includes(s) || t.to_branch_name?.toLowerCase().includes(s);
      const matchesProduct = (t.transferItems || []).some(i => i.product_name?.toLowerCase().includes(s));
      const matchesNumber = t.transfer_number?.toLowerCase().includes(s);
      if (!matchesBranch && !matchesProduct && !matchesNumber) return false;
    }
    const dateStr = t.created_date ? t.created_date.slice(0, 10) : '';
    if (dateFrom && dateStr < dateFrom) return false;
    if (dateTo && dateStr > dateTo) return false;
    return true;
  });

  const toggleRow = (id) => setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));

  const handleVoid = async () => {
    if (!voidTarget) return;

    // Verificar si ya fue anulado (doble click)
    const existing = await base44.entities.Transfer.filter({ transfer_number: voidTarget.transfer_number });
    if (existing.some(t => t.status === 'voided')) {
      toast.error('Este traslado ya fue anulado anteriormente.');
      setVoidTarget(null);
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      return;
    }

    setVoiding(true);
    try {
      const items = voidTarget.transferItems || [];

      for (const item of items) {
        // Buscar inventario en origen y destino
        const srcInv = inventory?.find(i => i.product_id === item.product_id && i.branch_id === voidTarget.from_branch_id);
        const dstInv = inventory?.find(i => i.product_id === item.product_id && i.branch_id === voidTarget.to_branch_id);

        // Devolver stock al origen
        if (srcInv) {
          const newQty = srcInv.quantity + item.quantity;
          await base44.entities.Inventory.update(srcInv.id, {
            quantity: newQty,
            total_value: newQty * (srcInv.avg_cost || 0),
          });
        }

        // Quitar stock del destino
        if (dstInv) {
          const newQty = Math.max(0, dstInv.quantity - item.quantity);
          await base44.entities.Inventory.update(dstInv.id, {
            quantity: newQty,
            total_value: newQty * (dstInv.avg_cost || 0),
          });
        }

        // Registrar movimientos de reversión
        await base44.entities.InventoryMovement.create({
          product_id: item.product_id,
          product_name: item.product_name,
          branch_id: voidTarget.from_branch_id,
          branch_name: voidTarget.from_branch_name,
          movement_type: 'adjustment',
          quantity: item.quantity,
          unit_cost: item.unit_cost || 0,
          reference_type: 'void_transfer',
          reference_id: voidTarget.transfer_number || voidTarget.id,
          notes: `Anulación de traslado${voidTarget.transfer_number ? ' ' + voidTarget.transfer_number : ''} — devuelto a ${voidTarget.from_branch_name}`,
        });

        if (dstInv || voidTarget.to_branch_id) {
          await base44.entities.InventoryMovement.create({
            product_id: item.product_id,
            product_name: item.product_name,
            branch_id: voidTarget.to_branch_id || '',
            branch_name: voidTarget.to_branch_name || '',
            movement_type: 'adjustment',
            quantity: -item.quantity,
            unit_cost: item.unit_cost || 0,
            reference_type: 'void_transfer',
            reference_id: voidTarget.transfer_number || voidTarget.id,
            notes: `Anulación de traslado${voidTarget.transfer_number ? ' ' + voidTarget.transfer_number : ''} — retirado de ${voidTarget.to_branch_name}`,
          });
        }
      }

      // Marcar Transfer como anulado
      if (!voidTarget.isLegacy) {
        await base44.entities.Transfer.update(voidTarget.id, { status: 'voided' });
      } else {
        // Para traslados históricos: crear un registro Transfer voided para persistir la anulación
        await base44.entities.Transfer.create({
          transfer_number: voidTarget.transfer_number,
          from_branch_id: voidTarget.from_branch_id,
          from_branch_name: voidTarget.from_branch_name,
          to_branch_id: voidTarget.to_branch_id,
          to_branch_name: voidTarget.to_branch_name,
          items: voidTarget.transferItems,
          total_value: voidTarget.total_value || 0,
          status: 'voided',
          notes: voidTarget.notes || '',
          transferred_by: 'legacy',
        });
      }

      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      toast.success(`Traslado anulado correctamente`);
    } catch (e) {
      console.error('Error al anular traslado:', e);
      toast.error('Error al anular: ' + (e.message || JSON.stringify(e)));
    } finally {
      setVoiding(false);
      setVoidTarget(null);
    }
  };

  const downloadCSV = () => {
    const bom = '\uFEFF';
    const rows = [['No. Traslado', 'Fecha', 'Origen', 'Destino', 'Estado', 'Producto', 'Cantidad', 'Costo Unit.', 'Subtotal']];
    filtered.forEach(t => {
      (t.transferItems || []).forEach(item => {
        rows.push([
          t.transfer_number || 'Histórico',
          t.created_date ? format(new Date(t.created_date), 'dd/MM/yyyy HH:mm') : '',
          t.from_branch_name || '',
          t.to_branch_name || '',
          t.status === 'voided' ? 'Anulado' : 'Activo',
          (item.product_name || '').replace(/,/g, ';'),
          item.quantity,
          (item.unit_cost || 0).toFixed(2),
          (item.quantity * (item.unit_cost || 0)).toFixed(2),
        ].join(','));
      });
    });
    const csv = bom + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'traslados.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="No., sucursal o producto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="Sucursal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
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
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1 ml-auto" onClick={downloadCSV}>
          <Download className="w-3 h-3" />Exportar CSV
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} traslado(s) encontrado(s)</p>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Truck className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Sin traslados registrados</p>
          </div>
        )}

        {filtered.map(t => {
          const isOpen = expandedIds[t.id];
          const totalValue = t.total_value || (t.transferItems || []).reduce((s, i) => s + i.quantity * (i.unit_cost || 0), 0);
          const date = t.created_date ? new Date(t.created_date) : null;
          const isVoided = t.status === 'voided';

          return (
            <Card key={t.id} className={`overflow-hidden ${isVoided ? 'opacity-60' : ''}`}>
              <button className="w-full text-left" onClick={() => toggleRow(t.id)}>
                <CardContent className="p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                  <div className={`p-2 rounded-lg shrink-0 ${isVoided ? 'bg-red-50' : 'bg-blue-50'}`}>
                    <Truck className={`w-4 h-4 ${isVoided ? 'text-red-400' : 'text-blue-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.transfer_number ? (
                        <span className="font-heading font-bold text-sm text-blue-700">{t.transfer_number}</span>
                      ) : (
                        <span className="font-heading font-semibold text-sm text-muted-foreground italic">Histórico</span>
                      )}
                      {isVoided && <Badge variant="destructive" className="text-xs">Anulado</Badge>}
                      <span className="text-muted-foreground text-xs">·</span>
                      <span className="font-medium text-sm">{t.from_branch_name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm">{t.to_branch_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {date ? format(date, "dd 'de' MMMM yyyy, HH:mm", { locale: es }) : '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs mb-1">
                      {(t.transferItems || []).length} prod.
                    </Badge>
                    {totalValue > 0 && (
                      <p className="text-xs text-muted-foreground">C${totalValue.toLocaleString('es', { minimumFractionDigits: 2 })}</p>
                    )}
                  </div>
                  <div className="shrink-0 ml-1">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </CardContent>
              </button>

              {isOpen && (
                <div className="border-t bg-muted/20 px-4 py-3 space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1 border-b">
                    <span className="col-span-2">Producto</span>
                    <span className="text-right">Cantidad</span>
                    <span className="text-right">Costo unit.</span>
                  </div>
                  {(t.transferItems || []).map((item, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2 text-sm py-1.5 border-b last:border-0">
                      <span className="col-span-2 font-medium truncate">{item.product_name}</span>
                      <span className="text-right font-heading font-bold text-blue-600">{item.quantity}</span>
                      <span className="text-right text-muted-foreground">
                        {item.unit_cost > 0 ? `C$${item.unit_cost.toFixed(2)}` : '—'}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {totalValue > 0
                        ? <>Total: <span className="text-foreground">C${totalValue.toLocaleString('es', { minimumFractionDigits: 2 })}</span></>
                        : <span className="italic">Sin costo registrado</span>
                      }
                    </span>
                    {!isVoided && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 gap-1"
                        onClick={(e) => { e.stopPropagation(); setVoidTarget(t); }}
                      >
                        <XCircle className="w-3 h-3" /> Anular traslado
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Dialogo de anulación */}
      <AlertDialog open={!!voidTarget} onOpenChange={open => !open && setVoidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              ¿Anular traslado?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {voidTarget && (
                <>
                  Se revertirá el inventario: <strong>{voidTarget.from_branch_name}</strong> recibirá el stock de vuelta y{' '}
                  <strong>{voidTarget.to_branch_name}</strong> lo perderá.
                  {voidTarget.isLegacy && (
                    <span className="block mt-2 text-amber-600 text-xs font-medium">
                      ⚠ Este traslado es histórico. Si la sucursal destino ya consumió parte del stock, habrá diferencias.
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voiding}>Cancelar</AlertDialogCancel>
            <Button
              disabled={voiding}
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={handleVoid}
            >
              {voiding ? 'Anulando...' : 'Sí, anular'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}