import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Percent, Calendar, AlertTriangle, CheckCircle2, Calculator, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function MarginAudit() {
  const queryClient = useQueryClient();
  const [marginInput, setMarginInput] = useState("19");
  const margin = parseFloat(marginInput) || 0;
  const [filter, setFilter] = useState('below'); // all | below | above
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [priceOverrides, setPriceOverrides] = useState({}); // { [productId]: "string" }

  // Cuando cambia el margen global, reiniciar los precios editados para que se re-sincronicen con el sugerido
  useEffect(() => { setPriceOverrides({}); }, [margin]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const rows = useMemo(() => {
    return products
      .filter(p => p.is_active !== false && p.cost > 0)
      .map(p => {
        const currentMargin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
        const rawSuggested = margin > 0 && margin < 100 ? p.cost / (1 - margin / 100) : p.price;
        const suggestedPrice = Math.ceil(rawSuggested);
        const difference = suggestedPrice - p.price;
        return {
          id: p.id,
          name: p.name,
          sku: p.sku || '',
          unit: p.unit,
          cost: p.cost,
          price: p.price,
          currentMargin,
          suggestedPrice,
          difference,
          status: currentMargin < margin - 0.5 ? 'below' : currentMargin > margin + 0.5 ? 'above' : 'ok',
        };
      });
  }, [products, margin]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter === 'below' && r.status !== 'below') return false;
      if (filter === 'above' && r.status !== 'above') return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.sku.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, filter, search]);

  const belowCount = rows.filter(r => r.status === 'below').length;
  const aboveCount = rows.filter(r => r.status === 'above').length;

  // Precio a programar: override manual si existe, si no el sugerido
  const getScheduledPrice = (r) => {
    const ov = priceOverrides[r.id];
    if (ov !== undefined && ov !== '') {
      const n = parseFloat(ov);
      if (!isNaN(n)) return n;
    }
    return r.suggestedPrice;
  };
  // Margen que resultaría del precio programado
  const getScheduledMargin = (r) => {
    const sp = getScheduledPrice(r);
    return sp > 0 ? ((sp - r.cost) / sp) * 100 : 0;
  };

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllBelow = () => {
    const belowIds = rows.filter(r => r.status === 'below').map(r => r.id);
    setSelected(new Set(belowIds));
  };

  const clearSelection = () => setSelected(new Set());

  // Escapar un campo de texto para CSV (envolver en comillas solo si contiene comas, comillas o saltos)
  const escapeField = (val) => {
    const s = String(val ?? '');
    if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const exportCSV = () => {
    const headers = ['Producto', 'SKU', 'Unidad', 'Costo', 'Precio Actual', 'Margen Actual (%)', 'Precio Sugerido', 'Precio a Programar', 'Diferencia Programada', 'Nuevo Margen (%)', 'Estado'];
    const statusLabel = (s) => s === 'below' ? 'Debajo del margen' : s === 'above' ? 'Sobre el margen' : 'OK';

    const lines = [headers.join(',')];
    for (const r of filtered) {
      // Los números se escriben como números reales (sin comillas) para que Excel los reconozca como tal
      const sp = getScheduledPrice(r);
      lines.push([
        escapeField(r.name),
        escapeField(r.sku),
        escapeField(r.unit),
        r.cost.toFixed(2),
        r.price.toFixed(2),
        r.currentMargin.toFixed(2),
        r.suggestedPrice.toFixed(2),
        sp.toFixed(2),
        (sp - r.price).toFixed(2),
        getScheduledMargin(r).toFixed(2),
        statusLabel(r.status),
      ].join(','));
    }

    // BOM UTF-8 para que Excel reconozca correctamente la codificación (evita caracteres extraños)
    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_margen_${margin}pct_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`CSV exportado (${filtered.length} productos)`);
  };

  const handleSchedule = async () => {
    if (selected.size === 0) {
      toast.error('Selecciona al menos un producto');
      return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const selectedRows = rows.filter(r => selected.has(r.id));
      const applyNow = effectiveDate <= today;
      const nowIso = new Date().toISOString();

      const scheduleRecords = selectedRows.map(r => ({
        product_id: r.id,
        product_name: r.name,
        product_sku: r.sku,
        new_price: Number(getScheduledPrice(r).toFixed(2)),
        effective_date: effectiveDate,
        applied: applyNow,
        applied_at: applyNow ? nowIso : undefined,
      }));

      // Crear todos los schedules en lote
      await base44.entities.ProductPriceSchedule.bulkCreate(scheduleRecords);

      // Si aplica hoy, actualizar todos los productos en lote
      if (applyNow) {
        const productUpdates = selectedRows.map(r => ({
          id: r.id,
          price: Number(getScheduledPrice(r).toFixed(2)),
        }));
        await base44.entities.Product.bulkUpdate(productUpdates);
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['price-schedules'] });
      toast.success(applyNow
        ? `${selectedRows.length} precio(s) aplicado(s) ahora`
        : `${selectedRows.length} precio(s) programado(s) para ${effectiveDate}`);
      setSelected(new Set());
      setPriceOverrides({});
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-semibold text-lg">Auditoría de Margen</h2>
      </div>

      <div className="bg-muted/40 border rounded-lg p-4 text-sm space-y-2">
        <p className="font-medium flex items-center gap-1"><Percent className="w-4 h-4" />Margen objetivo</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Label className="text-xs">Margen (%)</Label>
            <Input type="text" inputMode="decimal" value={marginInput} onChange={e => setMarginInput(e.target.value)} placeholder="19" />
          </div>
          <div className="w-44">
            <Label className="text-xs">Fecha de vigencia</Label>
            <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
          </div>
          <div className="w-44">
            <Label className="text-xs">Filtrar</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="below">Debajo del margen</SelectItem>
                <SelectItem value="above">Sobre el margen</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Precio sugerido = Costo ÷ (1 − Margen). Los productos con margen menor al objetivo aparecerán en rojo para revisión.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-red-600 border-red-300 dark:border-red-700 text-xs">
          <AlertTriangle className="w-3 h-3 mr-1" />{belowCount} debajo del margen
        </Badge>
        <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700 text-xs">
          {aboveCount} sobre el margen
        </Badge>
        <div className="relative flex-1 min-w-[200px]">
          <Input placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} className="h-9" />
        </div>
        <Button variant="outline" size="sm" onClick={selectAllBelow} className="text-xs gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />Seleccionar todos debajo
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0} className="text-xs gap-1">
          <Download className="w-3.5 h-3.5" />Exportar CSV
        </Button>
        {selected.size > 0 && (
          <Button variant="ghost" size="sm" onClick={clearSelection} className="text-xs">
            Limpiar ({selected.size})
          </Button>
        )}
      </div>

      {selected.size > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {selected.size} producto(s) seleccionado(s) → precio sugerido al {margin}% de margen
            </p>
            <Button onClick={handleSchedule} disabled={saving} className="gap-1 text-sm">
              <Calendar className="w-4 h-4" />{saving ? 'Procesando...' : `Programar para ${effectiveDate}`}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="p-2 w-8"></th>
                <th className="p-2">Producto</th>
                <th className="p-2 text-right">Costo</th>
                <th className="p-2 text-right">Precio Actual</th>
                <th className="p-2 text-right">Margen Actual</th>
                <th className="p-2 text-right">Precio Sugerido</th>
                <th className="p-2 text-right">Precio a Programar</th>
                <th className="p-2 text-right">Nuevo Margen</th>
                <th className="p-2 text-right">Diferencia</th>
                <th className="p-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className={`border-t hover:bg-muted/30 ${selected.has(r.id) ? 'bg-primary/5' : ''}`}>
                  <td className="p-2"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                  <td className="p-2">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.sku} · {r.unit}</p>
                  </td>
                  <td className="p-2 text-right font-mono">C${r.cost.toFixed(2)}</td>
                  <td className="p-2 text-right font-mono">C${r.price.toFixed(2)}</td>
                  <td className={`p-2 text-right font-mono ${r.status === 'below' ? 'text-red-600 font-semibold' : r.status === 'above' ? 'text-amber-600' : 'text-green-600'}`}>
                    {r.currentMargin.toFixed(1)}%
                  </td>
                  <td className="p-2 text-right font-mono font-semibold">C${r.suggestedPrice.toFixed(2)}</td>
                  <td className="p-2 text-right">
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-7 w-24 text-right font-mono text-xs"
                      value={priceOverrides[r.id] !== undefined ? priceOverrides[r.id] : String(r.suggestedPrice)}
                      onChange={e => setPriceOverrides(prev => ({ ...prev, [r.id]: e.target.value }))}
                    />
                  </td>
                  <td className={`p-2 text-right font-mono ${getScheduledMargin(r) < margin - 0.5 ? 'text-red-600 font-semibold' : 'text-green-600'}`}>
                    {getScheduledMargin(r).toFixed(1)}%
                  </td>
                  <td className={`p-2 text-right font-mono ${(getScheduledPrice(r) - r.price) > 0 ? 'text-green-600' : (getScheduledPrice(r) - r.price) < 0 ? 'text-red-600' : ''}`}>
                    {((getScheduledPrice(r) - r.price) >= 0 ? '+' : '')}{(getScheduledPrice(r) - r.price).toFixed(2)}
                  </td>
                  <td className="p-2 text-center">
                    {r.status === 'below' && <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">Bajo</Badge>}
                    {r.status === 'above' && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">Alto</Badge>}
                    {r.status === 'ok' && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">OK</Badge>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !isLoading && (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No hay productos que coincidan con el filtro</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}