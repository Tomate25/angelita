import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ClipboardList, Upload, Download, AlertTriangle } from 'lucide-react';

const CUTOFF_DATE = '2026-07-01T00:00:00';

// Simple CSV line parser supporting quoted fields with commas
function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur);
  return result.map(v => v.trim());
}

function parseCSV(text) {
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
    return row;
  });
}

export default function BulkInitializeModal({ open, onOpenChange, inventory, branches, products }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null);

  const downloadTemplate = () => {
    const bom = '\uFEFF';
    const headers = ['sku', 'product_name', 'branch_code', 'quantity'];
    const rows = [];
    branches.forEach(b => {
      products.forEach(p => {
        rows.push([p.sku || '', `"${p.name || ''}"`, b.code || '', '0'].join(','));
      });
    });
    const csv = bom + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'plantilla_inicializacion_inventario.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    setProgress(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        toast.error('El archivo no contiene filas de datos.');
        setLoading(false);
        return;
      }

      let updated = 0;
      const notFound = [];
      let rowIndex = 0;

      for (const row of rows) {
        rowIndex++;
        setProgress({ current: rowIndex, total: rows.length });
        const sku = String(row.sku || '').trim();
        const name = String(row.product_name || '').trim();
        const product = (sku && products.find(p => p.sku && p.sku.toLowerCase() === sku.toLowerCase()))
          || (name && products.find(p => p.name && p.name.toLowerCase() === name.toLowerCase()));
        const branch = branches.find(b => b.code && b.code.toLowerCase() === String(row.branch_code || '').toLowerCase());
        const qty = parseFloat(row.quantity) || 0;

        if (!product || !branch) {
          notFound.push(`${sku || name || '?'} / Sucursal: ${row.branch_code || '?'}`);
          continue;
        }

        const inv = inventory.find(i => i.product_id === product.id && i.branch_id === branch.id);
        const prevQty = inv?.quantity || 0;
        const delta = qty - prevQty;

        if (inv) {
          await base44.entities.Inventory.update(inv.id, {
            quantity: qty,
            avg_cost: product.cost || inv.avg_cost || 0,
            total_value: qty * (product.cost || inv.avg_cost || 0),
          });
        } else {
          await base44.entities.Inventory.create({
            product_id: product.id,
            product_name: product.name,
            branch_id: branch.id,
            branch_name: branch.name,
            quantity: qty,
            avg_cost: product.cost || 0,
            total_value: qty * (product.cost || 0),
          });
        }

        if (delta !== 0) {
          await base44.entities.InventoryMovement.create({
            product_id: product.id,
            product_name: product.name,
            branch_id: branch.id,
            branch_name: branch.name,
            movement_type: 'adjustment',
            quantity: delta,
            unit_cost: product.cost || 0,
            previous_stock: prevQty,
            new_stock: qty,
            notes: 'Inicialización de inventario 01/07/2026',
            movement_date: CUTOFF_DATE,
          });
        }
        updated++;
      }

      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      setResult({ updated, notFound });
      if (notFound.length === 0) {
        toast.success(`Inventario inicializado: ${updated} registro(s) actualizados`);
      }
    } catch (err) {
      toast.error('Error al procesar archivo: ' + err.message);
    } finally {
      setLoading(false);
      setProgress(null);
      e.target.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setResult(null); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-purple-600" />
            Inicializar Inventario (01/07/2026)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Sube un archivo CSV con las columnas <strong>sku</strong>, <strong>product_name</strong>, <strong>branch_code</strong> y <strong>quantity</strong>.
            Si el producto no tiene SKU, déjalo vacío y usa el nombre exacto en <strong>product_name</strong>.
            El stock de cada producto/sucursal se fijará exactamente al valor indicado, registrando el ajuste con fecha 01/07/2026.
          </p>

          <Button variant="outline" size="sm" className="gap-1" onClick={downloadTemplate}>
            <Download className="w-3.5 h-3.5" />Descargar plantilla CSV
          </Button>

          <div>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-muted/50">
              <Upload className="w-6 h-6 text-muted-foreground" />
              <span className="text-sm font-medium">
                {loading ? (progress ? `Procesando ${progress.current}/${progress.total}...` : 'Procesando...') : 'Seleccionar archivo CSV'}
              </span>
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} disabled={loading} />
            </label>
          </div>

          {result && (
            <div className="space-y-2">
              <p className="text-green-700 font-medium">{result.updated} registro(s) inicializados correctamente.</p>
              {result.notFound.length > 0 && (
                <div className="border border-amber-300 bg-amber-50 rounded-lg p-3">
                  <p className="flex items-center gap-1 text-amber-700 font-medium mb-1">
                    <AlertTriangle className="w-4 h-4" />{result.notFound.length} fila(s) no encontradas
                  </p>
                  <div className="max-h-32 overflow-y-auto text-xs text-amber-700 space-y-0.5">
                    {result.notFound.map((n, i) => <p key={i}>{n}</p>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}