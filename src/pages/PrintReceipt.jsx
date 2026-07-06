import { useEffect } from 'react';
import { format } from 'date-fns';

function getFechaDeduccion(orderDate) {
  const d = orderDate ? new Date(orderDate) : new Date();
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();
  if (day >= 22) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    return `15/${String(nextMonth + 1).padStart(2, '0')}/${nextYear}`;
  } else if (day <= 7) {
    return `15/${String(month + 1).padStart(2, '0')}/${year}`;
  } else {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return `${lastDay}/${String(month + 1).padStart(2, '0')}/${year}`;
  }
}

export default function PrintReceipt() {
  useEffect(() => {
    // Auto-print after a short delay to let the page render
    const timer = setTimeout(() => {
      window.print();
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const raw = localStorage.getItem('print_order');
  if (!raw) {
    return (
      <div style={{ fontFamily: 'sans-serif', padding: 20 }}>
        <p>No hay datos de orden para imprimir.</p>
        <button onClick={() => window.history.back()}>Volver</button>
      </div>
    );
  }

  const order = JSON.parse(raw);
  const fechaDeduccion = getFechaDeduccion(order.closed_at || order.created_date);
  const fecha = order.closed_at
    ? format(new Date(order.closed_at), 'dd/MM/yyyy HH:mm')
    : format(new Date(), 'dd/MM/yyyy HH:mm');

  const TicketCopy = ({ label }) => (
    <div className="ticket-copy">
      <div className="center bold" style={{ fontSize: 11 }}>Angelita's Food</div>
      <div className="center" style={{ fontSize: 9 }}>Comprobante de Venta {label}</div>
      <div className="divider-solid" />
      <div>No: <span className="bold">{order.order_number}</span></div>
      <div>Fecha: {fecha}</div>
      {order.branch_name && <div>Sucursal: <span className="bold">{order.branch_name}</span></div>}
      <div className="wrap">Cajero: {order.cashier_email || order.created_by || ''}</div>
      {order.payment_method === 'credito' && (
        <div>F.Deducción: <span className="bold">{fechaDeduccion}</span></div>
      )}
      {order.customer_name && order.customer_name !== 'Consumidor Final' && (
        <div>Cliente: <span className="bold">{order.customer_name}</span></div>
      )}
      <div className="divider" />
      {(order.items || []).map((item, i) => (
        <div key={i} className="item-row">
          <div className="item-name">{item.quantity} x {item.product_name}{item.discount ? ` (-${item.discount}%)` : ''}</div>
          <div className="item-totals">
            <span>C${(item.unit_price || 0).toFixed(2)} c/u</span>
            <span className="bold">C${(item.subtotal || item.unit_price * item.quantity).toFixed(2)}</span>
          </div>
        </div>
      ))}
      <div className="divider" />
      {order.discount_total > 0 && (
        <div className="row-line"><span>Subtotal:</span><span>C${(order.subtotal || 0).toFixed(2)}</span></div>
      )}
      {order.discount_total > 0 && (
        <div className="row-line"><span>Descuento:</span><span>-C${(order.discount_total || 0).toFixed(2)}</span></div>
      )}
      <div className="divider-solid" />
      <div className="row-line bold" style={{ fontSize: 11 }}><span>TOTAL:</span><span>C${(order.total || 0).toFixed(2)}</span></div>
      <div className="divider-solid" />
      <div className="row-line"><span>Forma de Pago:</span><span className="bold">{(order.payment_method || '').toUpperCase()}</span></div>
      {order.payment_method === 'efectivo' && <>
        <div className="row-line"><span>Recibido:</span><span>C${(order.amount_paid || 0).toFixed(2)}</span></div>
        <div className="row-line"><span>Cambio:</span><span>C${(order.change_amount || 0).toFixed(2)}</span></div>
      </>}
      {order.payment_method === 'credito' ? (
        <>
          <div className="divider-solid" />
          <div className="center bold" style={{ fontSize: 9 }}>*** VENTA A CRÉDITO ***</div>
          <div className="sig-box"><div style={{ fontSize: 8, marginBottom: 2 }}>Firma del cliente:</div></div>
        </>
      ) : (
        <>
          <div className="divider" />
          <div className="sig-box"><div style={{ fontSize: 8, marginBottom: 2 }}>Firma / Conforme:</div></div>
        </>
      )}
      <div className="divider-solid" />
      <div className="center" style={{ fontSize: 9, marginTop: 4 }}>¡Gracias por su compra!</div>
      {order.notes && <div className="center" style={{ fontSize: 8, marginTop: 2 }}>{order.notes}</div>}
    </div>
  );

  return (
    <>
      <style>{`
        @page { margin: 0; size: 72mm auto; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #fff; -webkit-print-color-adjust: exact; }
        .ticket-copy {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          font-weight: 500;
          color: #000;
          width: 68mm;
          margin: 0 auto;
          padding: 2mm 1mm;
          page-break-inside: avoid;
        }
        .ticket-copy:first-of-type { page-break-after: always; }
        .ticket-copy:last-of-type { page-break-after: avoid; }
        #print-root { margin: 0; padding: 0; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: 900; }
        .wrap { word-break: break-all; }
        .divider { border-top: 1px dashed #000; margin: 3px 0; }
        .divider-solid { border-top: 2px solid #000; margin: 3px 0; }
        .row-line { display: flex; justify-content: space-between; align-items: baseline; gap: 4px; margin: 2px 0; }
        .item-row { margin: 2px 0; }
        .item-name { font-size: 12px; font-weight: 700; word-break: break-word; line-height: 1.3; }
        .item-totals { display: flex; justify-content: space-between; font-size: 11px; color: #222; padding-left: 8px; margin-top: 1px; }
        .sig-box { border-top: 1px solid #000; margin-top: 8mm; padding-top: 1mm; height: 24mm; }
        .no-print { display: flex; justify-content: center; padding: 16px; gap: 12px; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      <div className="no-print">
        <button
          onClick={() => { localStorage.removeItem('print_order'); window.location.href = '/pos'; }}
          style={{ fontFamily: 'sans-serif', fontSize: 16, padding: '10px 28px', background: '#e65c00', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          ← Volver al POS
        </button>
        <button
          onClick={() => window.print()}
          style={{ fontFamily: 'sans-serif', fontSize: 16, padding: '10px 28px', background: '#333', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          🖨 Reimprimir
        </button>
      </div>

      <div id="print-root">
        <TicketCopy label="(Original)" />
        <TicketCopy label="(Copia)" />
      </div>
    </>
  );
}