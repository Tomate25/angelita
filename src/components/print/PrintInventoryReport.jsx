import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, FileDown } from 'lucide-react';
import { format } from 'date-fns';

/**
 * Botones para imprimir/exportar PDF de reportes de inventario en tamaño Carta.
 * Props:
 *  - title: string
 *  - rows: array de objetos con columnas
 *  - columns: [{ key, label, align? }]
 *  - summary?: [{ label, value }]  — totales al pie
 */
export default function PrintInventoryReport({ title, rows, columns, summary = [], branchName = '' }) {
  const now = format(new Date(), 'dd/MM/yyyy HH:mm');

  const buildHtml = () => {
    const thead = columns.map(c => 
      `<th style="text-align:${c.align||'left'};padding:10px 12px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:#fff;font-size:12px;font-weight:600;border-bottom:3px solid #5a67d8;text-transform:uppercase;letter-spacing:0.5px;">${c.label}</th>`
    ).join('');
    
    const tbody = rows.map((row, idx) => {
      const isEven = idx % 2 === 0;
      const bgColors = ['#ffffff', '#f8f9ff'];
      const hoverBg = '#edf2f7';
      return `<tr style="background:${isEven ? bgColors[0] : bgColors[1]};transition:background 0.2s;">` +
      columns.map((c, colIdx) => {
        const isNumeric = c.align === 'right' || c.align === 'center';
        const fontWeight = colIdx === 0 ? '600' : '400';
        return `<td style="text-align:${c.align||'left'};padding:8px 12px;font-size:11px;border-bottom:1px solid #e2e8f0;color:#2d3748;font-weight:${fontWeight};">${row[c.key] ?? ''}</td>`;
      }).join('') +
      `</tr>`;
    }).join('');
    
    const tfoot = summary.length ? `
      <tfoot>
        <tr style="background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
          <td colspan="${columns.length}" style="padding:10px 12px;font-size:12px;border-top:3px solid #d53f8c;">
            ${summary.map((s, idx) => 
              `<span style="display:inline-block;margin-right:24px;color:#fff;font-weight:600;">
                <span style="opacity:0.9;">${s.label}:</span> 
                <span style="font-size:13px;margin-left:4px;">${s.value}</span>
              </span>`
            ).join('')}
          </td>
        </tr>
      </tfoot>` : '';
      
    return `
      <!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>${title}</title>
      <style>
        @page { size: letter portrait; margin: 15mm 15mm 15mm 15mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a202c; line-height: 1.5; }
        h1 { font-size: 20px; margin: 0 0 8px 0; color: #2d3748; font-weight: 700; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 12px 16px; margin: -15mm -15mm 15mm -15mm; color: #fff; }
        .header h1 { color: #fff; margin: 0; font-size: 22px; }
        .meta { font-size: 10px; color: #718096; margin-bottom: 12px; padding: 8px 0; border-bottom: 2px solid #e2e8f0; }
        .meta strong { color: #4a5568; }
        table { width: 100%; border-collapse: collapse; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        th { font-weight: 600; }
        tr:last-child td { border-bottom: none; }
        @media print { 
          body { -webkit-print-color-adjust: exact; color-adjust: exact; } 
          .header { -webkit-print-color-adjust: exact; }
          tfoot tr { -webkit-print-color-adjust: exact; }
        }
      </style></head><body>
        <div class="header">
          <h1>${title}</h1>
        </div>
        <div class="meta">
          ${branchName ? `<strong>Sucursal:</strong> ${branchName} &nbsp;&nbsp;|&nbsp;&nbsp; ` : ''}
          <strong>Generado:</strong> ${now} &nbsp;&nbsp;|&nbsp;&nbsp; 
          <strong>Registros:</strong> ${rows.length}
        </div>
        <table>
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
          ${tfoot}
        </table>
      </body></html>`;
  };

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=850,height=1100');
    win.document.write(buildHtml());
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const handlePDF = () => {
    // Use print-to-PDF via browser window (letter size)
    const win = window.open('', '_blank', 'width=870,height=1100');
    win.document.write(buildHtml());
    win.document.close();
    win.focus();
    // Add a download hint via print dialog
    setTimeout(() => {
      win.print();
      // Don't auto-close so user can save as PDF
    }, 500);
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handlePrint} className="gap-2">
        <Printer className="w-4 h-4" />
        Imprimir
      </Button>
      <Button variant="outline" onClick={handlePDF} className="gap-2">
        <FileDown className="w-4 h-4" />
        Exportar PDF
      </Button>
    </div>
  );
}