import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, Calendar, CheckCircle2, Clock, Trash2, Play } from 'lucide-react';
import { toast } from 'sonner';

export default function PriceScheduleManager() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [applyingNow, setApplyingNow] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['price-schedules'],
    queryFn: () => base44.entities.ProductPriceSchedule.list('-effective_date', 100),
  });

  const pendingSchedules = schedules.filter(s => !s.applied);
  const appliedSchedules = schedules.filter(s => s.applied).slice(0, 20);

  const deleteSchedule = useMutation({
    mutationFn: (id) => base44.entities.ProductPriceSchedule.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-schedules'] });
      toast.success('Cambio eliminado');
    },
  });

  // Download price update template with current prices
  const downloadTemplate = () => {
    const rows = [
      ['sku', 'nombre_producto', 'precio_actual', 'costo_actual', 'precio_mayorista_actual', 'precio_especial_actual',
       'nuevo_precio', 'nuevo_costo', 'nuevo_precio_mayorista', 'nuevo_precio_especial', 'fecha_vigencia'],
    ];

    for (const p of products) {
      rows.push([
        p.sku || '',
        p.name || '',
        p.price || 0,
        p.cost || 0,
        p.wholesale_price || 0,
        p.special_price || 0,
        '',  // nuevo_precio
        '',  // nuevo_costo
        '',  // nuevo_precio_mayorista
        '',  // nuevo_precio_especial
        '',  // fecha_vigencia (YYYY-MM-DD)
      ]);
    }

    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_precios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Plantilla descargada con precios actuales');
  };

  const parseCSV = (text) => {
    // Remove BOM characters (UTF-8 and UTF-16)
    const clean = text.replace(/^[\uFEFF\uFFFE]/, '');
    const lines = clean.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    // Auto-detect delimiter: tab or comma
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    const headers = firstLine.split(delimiter).map(h => h.replace(/["\r]/g, '').trim().toLowerCase());
    return lines.slice(1).map(line => {
      const values = line.split(delimiter).map(v => v.replace(/["\r]/g, '').trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
      return obj;
    });
  };

  const readFileAsText = async (file) => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // Detect UTF-16 BOM (Excel typically exports with UTF-16 LE)
    if ((bytes[0] === 0xFF && bytes[1] === 0xFE)) {
      return new TextDecoder('UTF-16LE').decode(buffer);
    }
    if ((bytes[0] === 0xFE && bytes[1] === 0xFF)) {
      return new TextDecoder('UTF-16BE').decode(buffer);
    }
    return new TextDecoder('UTF-8').decode(buffer);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    try {
      const text = await readFileAsText(file);
      const rows = parseCSV(text);

      if (!rows.length) {
        toast.error('No se encontraron datos en el archivo');
        setImporting(false);
        e.target.value = '';
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      let updatedNow = 0;
      let scheduled = 0;
      let skipped = 0;

      for (const row of rows) {
        const hasNewPrices = (row.nuevo_precio !== '' && row.nuevo_precio != null) ||
          (row.nuevo_costo !== '' && row.nuevo_costo != null) ||
          (row.nuevo_precio_mayorista !== '' && row.nuevo_precio_mayorista != null) ||
          (row.nuevo_precio_especial !== '' && row.nuevo_precio_especial != null);
        if (!hasNewPrices) { skipped++; continue; }

        const product = products.find(p =>
          (row.sku && p.sku && p.sku.toLowerCase() === row.sku.toLowerCase()) ||
          (row.nombre_producto && p.name && p.name.toLowerCase() === row.nombre_producto.toLowerCase())
        );

        if (!product) { skipped++; continue; }

        // Normalize date to YYYY-MM-DD regardless of input format
        let effectiveDate = today;
        if (row.fecha_vigencia) {
          const d = row.fecha_vigencia.trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
            effectiveDate = d; // already correct
          } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
            // dd/mm/yyyy
            const [dd, mm, yyyy] = d.split('/');
            effectiveDate = `${yyyy}-${mm}-${dd}`;
          } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(d)) {
            const parts = d.split('/');
            effectiveDate = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
          } else {
            const parsed = new Date(d);
            if (!isNaN(parsed)) effectiveDate = parsed.toISOString().slice(0, 10);
          }
        }

        const newPrice = row.nuevo_precio !== '' ? parseFloat(row.nuevo_precio) : null;
        const newCost = row.nuevo_costo !== '' ? parseFloat(row.nuevo_costo) : null;
        const newWholesale = row.nuevo_precio_mayorista !== '' ? parseFloat(row.nuevo_precio_mayorista) : null;
        const newSpecial = row.nuevo_precio_especial !== '' ? parseFloat(row.nuevo_precio_especial) : null;

        const scheduleData = {
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku || '',
          new_price: newPrice,
          new_cost: newCost,
          new_wholesale_price: newWholesale,
          new_special_price: newSpecial,
          effective_date: effectiveDate,
        };

        if (effectiveDate <= today) {
          const updates = {};
          if (newPrice != null) updates.price = newPrice;
          if (newCost != null) updates.cost = newCost;
          if (newWholesale != null) updates.wholesale_price = newWholesale;
          if (newSpecial != null) updates.special_price = newSpecial;
          await base44.entities.Product.update(product.id, updates);
          await base44.entities.ProductPriceSchedule.create({ ...scheduleData, applied: true, applied_at: new Date().toISOString() });
          updatedNow++;
        } else {
          await base44.entities.ProductPriceSchedule.create({ ...scheduleData, applied: false });
          scheduled++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['price-schedules'] });
      toast.success(`Precios procesados: ${updatedNow} aplicados ahora, ${scheduled} programados, ${skipped} omitidos`);
    } catch (err) {
      toast.error('Error al importar: ' + err.message);
    }

    setImporting(false);
    e.target.value = '';
  };

  const applyNow = async () => {
    setApplyingNow(true);
    try {
      const res = await base44.functions.invoke('applyScheduledPrices', {});
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['price-schedules'] });
      toast.success(res.data?.message || 'Precios aplicados');
    } catch (err) {
      toast.error('Error al aplicar precios: ' + err.message);
    }
    setApplyingNow(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="font-heading font-semibold text-lg">Gestión de Precios</h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1 text-xs">
            <Download className="w-3.5 h-3.5" />Descargar Plantilla
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing} className="gap-1 text-xs">
            <Upload className="w-3.5 h-3.5" />{importing ? 'Procesando...' : 'Subir Plantilla'}
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
          {pendingSchedules.length > 0 && (
            <Button size="sm" onClick={applyNow} disabled={applyingNow} className="gap-1 text-xs">
              <Play className="w-3.5 h-3.5" />{applyingNow ? 'Aplicando...' : 'Aplicar Pendientes'}
            </Button>
          )}
        </div>
      </div>

      <div className="bg-muted/40 border rounded-lg p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">¿Cómo funciona?</p>
        <p>1. Descarga la plantilla con los precios actuales de todos los productos.</p>
        <p>2. Llena los nuevos precios y la <strong>fecha de vigencia</strong> en las columnas correspondientes.</p>
        <p>3. Sube el archivo. Si la fecha es hoy o pasada, los precios se actualizan inmediatamente. Si es futura, quedan programados.</p>
        <p>4. Los cambios programados se aplican automáticamente cada noche a la 1 AM.</p>
      </div>

      {/* Pending Schedules */}
      {pendingSchedules.length > 0 && (
        <div>
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />Cambios Programados ({pendingSchedules.length})
          </h3>
          <div className="space-y-2">
            {pendingSchedules.map(s => (
              <Card key={s.id} className="border-amber-200 dark:border-amber-900/40">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.product_name} <span className="text-muted-foreground text-xs">({s.product_sku})</span></p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {s.new_price != null && <span>Precio: <strong className="text-foreground">C${s.new_price.toFixed(2)}</strong></span>}
                      {s.new_cost != null && <span>Costo: <strong className="text-foreground">C${s.new_cost.toFixed(2)}</strong></span>}
                      {s.new_wholesale_price != null && <span>Mayorista: <strong className="text-foreground">C${s.new_wholesale_price.toFixed(2)}</strong></span>}
                      {s.new_special_price != null && <span>Especial: <strong className="text-foreground">C${s.new_special_price.toFixed(2)}</strong></span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700 flex items-center gap-1 text-xs">
                      <Calendar className="w-3 h-3" />{s.effective_date}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteSchedule.mutate(s.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pendingSchedules.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg bg-muted/20">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No hay cambios de precios programados
        </div>
      )}

      {/* Applied History */}
      {appliedSchedules.length > 0 && (
        <div>
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />Historial de Cambios Aplicados
          </h3>
          <div className="space-y-2">
            {appliedSchedules.map(s => (
              <Card key={s.id} className="opacity-70">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.product_name} <span className="text-muted-foreground text-xs">({s.product_sku})</span></p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {s.new_price != null && <span>Precio: C${s.new_price.toFixed(2)}</span>}
                      {s.new_cost != null && <span>Costo: C${s.new_cost.toFixed(2)}</span>}
                      {s.new_wholesale_price != null && <span>Mayorista: C${s.new_wholesale_price.toFixed(2)}</span>}
                      {s.new_special_price != null && <span>Especial: C${s.new_special_price.toFixed(2)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />Aplicado
                    </Badge>
                    <span className="text-xs text-muted-foreground">{s.effective_date}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}