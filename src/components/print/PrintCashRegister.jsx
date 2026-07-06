import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function PrintCashRegister({ register, variant = 'default' }) {
  const handlePrint = () => {
    const reg = register;
    const expected = (reg.opening_amount || 0) + (reg.cash_sales || 0) + (reg.cash_in || 0) - (reg.cash_out || 0);
    const diff = (reg.actual_cash || 0) - expected;
    sessionStorage.setItem('print_cash_register', JSON.stringify({ ...reg, expected, diff }));
    window.location.href = '/print-cash-register';
  };

  return (
    <Button variant={variant} onClick={handlePrint} className="gap-2">
      <Printer className="w-4 h-4" />
      Imprimir Cierre
    </Button>
  );
}