import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ApprovePurchase() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const purchaseId = params.get('id');
  const actionFromUrl = params.get('action'); // 'approve' or 'reject' from email link
  const [status, setStatus] = useState('idle'); // idle | loading | approved | rejected | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token || !purchaseId) {
      setStatus('error');
      return;
    }
    // Auto-execute if action is in URL (clicked from email)
    if (actionFromUrl === 'approve' || actionFromUrl === 'reject') {
      handleAction(actionFromUrl);
    }
  }, []);

  const handleAction = async (action) => {
    setStatus('loading');
    const res = await base44.functions.invoke('approvePurchaseByToken', {
      token,
      purchase_id: purchaseId,
      action,
    });
    const data = res.data;
    if (data?.ok) {
      setStatus(action === 'approve' ? 'approved' : 'rejected');
      setMessage(data.purchase_number ? `Pedido ${data.purchase_number}` : '');
    } else {
      setStatus('error');
      setMessage(data?.message || data?.error || 'Error al procesar');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-lg p-8 text-center space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-heading font-bold text-2xl">A</span>
          </div>
        </div>
        <div>
          <h1 className="font-heading font-bold text-xl">Angelita's ERP</h1>
          <p className="text-muted-foreground text-sm">Aprobación de Pedido de Compra</p>
        </div>

        {(!token || !purchaseId) && (
          <div className="flex flex-col items-center gap-3 text-destructive">
            <AlertCircle className="w-12 h-12" />
            <p className="font-medium">Enlace inválido o incompleto.</p>
          </div>
        )}

        {token && purchaseId && status === 'idle' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">¿Deseas aprobar o rechazar este pedido de compra?</p>
            <div className="flex gap-3">
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleAction('approve')}>
                <CheckCircle2 className="w-4 h-4 mr-2" />Aprobar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => handleAction('reject')}>
                <XCircle className="w-4 h-4 mr-2" />Rechazar
              </Button>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p>Procesando...</p>
          </div>
        )}

        {status === 'approved' && (
          <div className="flex flex-col items-center gap-3 text-green-600">
            <CheckCircle2 className="w-14 h-14" />
            <p className="font-heading font-bold text-lg">¡Pedido Aprobado!</p>
            {message && <p className="text-sm text-muted-foreground">{message} ha sido aprobado exitosamente.</p>}
            <p className="text-xs text-muted-foreground">El equipo fue notificado. Puedes cerrar esta ventana.</p>
          </div>
        )}

        {status === 'rejected' && (
          <div className="flex flex-col items-center gap-3 text-destructive">
            <XCircle className="w-14 h-14" />
            <p className="font-heading font-bold text-lg">Pedido Rechazado</p>
            {message && <p className="text-sm text-muted-foreground">{message} ha sido rechazado.</p>}
            <p className="text-xs text-muted-foreground">El equipo fue notificado. Puedes cerrar esta ventana.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 text-destructive">
            <AlertCircle className="w-12 h-12" />
            <p className="font-medium">{message || 'Ocurrió un error. El enlace puede ser inválido o el pedido ya fue procesado.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}