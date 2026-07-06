import { useEffect } from 'react';
import { format } from 'date-fns';

export default function PrintCashRegister() {
  useEffect(() => {
    const timer = setTimeout(() => { window.print(); }, 800);
    return () => clearTimeout(timer);
  }, []);

  const raw = sessionStorage.getItem('print_cash_register');
  if (!raw) {
    return (
      <div style={{ fontFamily: 'sans-serif', padding: 20 }}>
        <p>No hay datos de cierre para imprimir.</p>
        <button onClick={() => window.history.back()}>Volver</button>
      </div>
    );
  }

  const reg = JSON.parse(raw);
  const expected = reg.expected ?? ((reg.opening_amount || 0) + (reg.cash_sales || 0) + (reg.cash_in || 0) - (reg.cash_out || 0));
  const diff = reg.diff ?? ((reg.actual_cash || 0) - expected);

  const apertura = reg.opened_at ? format(new Date(reg.opened_at), 'dd/MM/yyyy HH:mm') : '';
  const cierre = reg.closed_at ? format(new Date(reg.closed_at), 'dd/MM/yyyy HH:mm') : format(new Date(), 'dd/MM/yyyy HH:mm');

  return (
    <>
      <style>{`
        @page { margin: 0; size: 72mm auto; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #fff; }
        .ticket {
          font-family: 'Courier New', Courier, monospace;
          font-size: 9px;
          color: #000;
          width: 68mm;
          margin: 0 auto;
          padding: 2mm 1mm;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: 900; }
        .lg { font-size: 12px; }
        .xl { font-size: 15px; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
        .divider-solid { border-top: 2px solid #000; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 1px 0; vertical-align: top; }
        td.right { text-align: right; }
        .no-print { display: flex; justify-content: center; padding: 16px; gap: 12px; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      <div className="no-print">
        <button
          onClick={() => { sessionStorage.removeItem('print_cash_register'); window.history.back(); }}
          style={{ fontFamily: 'sans-serif', fontSize: 16, padding: '10px 28px', background: '#e65c00', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          ← Volver
        </button>
        <button
          onClick={() => window.print()}
          style={{ fontFamily: 'sans-serif', fontSize: 16, padding: '10px 28px', background: '#333', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          🖨 Reimprimir
        </button>
      </div>

      <div className="ticket">
        <div className="center bold lg">Angelita's Food</div>
        <div className="center" style={{ fontSize: 9 }}>CIERRE DE CAJA</div>
        <div className="divider-solid" />
        <table>
          <tbody>
            <tr><td>Sucursal:</td><td className="right bold">{reg.branch_name || ''}</td></tr>
            <tr><td>Cajero:</td><td className="right">{reg.cashier_email || ''}</td></tr>
            <tr><td>Apertura:</td><td className="right">{apertura}</td></tr>
            <tr><td>Cierre:</td><td className="right">{cierre}</td></tr>
          </tbody>
        </table>
        <div className="divider" />
        <div className="bold" style={{ fontSize: 10 }}>RESUMEN DE VENTAS</div>
        <table>
          <tbody>
            <tr><td>Total Órdenes:</td><td className="right">{reg.total_orders || 0}</td></tr>
            <tr><td>Ventas Totales:</td><td className="right bold">C${(reg.total_sales || 0).toFixed(2)}</td></tr>
          </tbody>
        </table>
        <div className="divider" />
        <div className="bold" style={{ fontSize: 9 }}>Por forma de pago:</div>
        <table>
          <tbody>
            <tr><td>  Efectivo:</td><td className="right">C${(reg.cash_sales || 0).toFixed(2)}</td></tr>
            <tr><td>  Tarjeta:</td><td className="right">C${(reg.card_sales || 0).toFixed(2)}</td></tr>
            <tr><td>  Transferencia:</td><td className="right">C${(reg.transfer_sales || 0).toFixed(2)}</td></tr>
            <tr><td>  Crédito:</td><td className="right">C${(reg.credit_sales || 0).toFixed(2)}</td></tr>
          </tbody>
        </table>
        <div className="divider" />
        <div className="bold" style={{ fontSize: 9 }}>ARQUEO DE CAJA:</div>
        <table>
          <tbody>
            <tr><td>Apertura:</td><td className="right">C${(reg.opening_amount || 0).toFixed(2)}</td></tr>
            {reg.cash_in > 0 && <tr><td>Entradas:</td><td className="right">+C${(reg.cash_in || 0).toFixed(2)}</td></tr>}
            {reg.cash_out > 0 && <tr><td>Salidas:</td><td className="right">-C${(reg.cash_out || 0).toFixed(2)}</td></tr>}
            <tr><td>Esperado:</td><td className="right bold">C${expected.toFixed(2)}</td></tr>
            <tr><td>Contado:</td><td className="right bold">C${(reg.actual_cash || 0).toFixed(2)}</td></tr>
          </tbody>
        </table>
        <div className="divider-solid" />
        <table>
          <tbody>
            <tr>
              <td className="bold xl">Diferencia:</td>
              <td className="right bold xl">{diff >= 0 ? '+' : ''}C${diff.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <div className="divider-solid" />
        <br />
        <div style={{ fontSize: 8 }}>Firma cajero: __________________________</div>
        <br />
        <div style={{ fontSize: 8 }}>Firma supervisor: _____________________</div>
        <br /><br />
        <div className="center" style={{ fontSize: 8 }}>Angelita's Food — Copia interna</div>
      </div>
    </>
  );
}