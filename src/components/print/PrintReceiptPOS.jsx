import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

/**
 * Ticket POS térmico (80mm) con espacio de firma del cliente.
 * Se llama desde PaymentModal después de confirmar la venta.
 */
function getFechaDeduccion(orderDate) {
  const d = orderDate ? new Date(orderDate) : new Date();
  const day = d.getDate();
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();

  if (day >= 22) {
    // Del 22 en adelante → deduce el 15 del mes siguiente
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    return `15/${String(nextMonth + 1).padStart(2, '0')}/${nextYear}`;
  } else if (day <= 7) {
    // Del 1 al 7 → deduce el 15 del mes actual
    return `15/${String(month + 1).padStart(2, '0')}/${year}`;
  } else {
    // Del 8 al 21 → deduce el último día del mes actual
    const lastDay = new Date(year, month + 1, 0).getDate();
    return `${lastDay}/${String(month + 1).padStart(2, '0')}/${year}`;
  }
}

export function printReceipt(order, onClose) {
    localStorage.setItem('print_order', JSON.stringify(order));
    sessionStorage.removeItem('print_order');
    setTimeout(() => {
      if (typeof onClose === 'function') onClose();
      window.location.href = '/print-receipt';
    }, 50);
}

export default function PrintReceiptPOS({ order, onClose }) {
  return (
    <Button onClick={() => printReceipt(order, onClose)} className="gap-2">
      <Printer className="w-4 h-4" />
      Imprimir Ticket
    </Button>
  );
}