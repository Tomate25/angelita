import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Simple token: base64 of purchase_id + secret salt
const envSalt = (() => { try { return Deno.env.get('APPROVE_TOKEN_SALT'); } catch { return null; } })();
const SALT = envSalt || 'angelitas-erp-secret-2024';

function generateToken(purchaseId) {
  return btoa(`${purchaseId}:${SALT}`).replace(/=/g, '');
}

function validateToken(token, purchaseId) {
  return token === generateToken(purchaseId);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { token, purchase_id, action } = body;

  if (!token || !purchase_id) {
    return Response.json({ error: 'Faltan parámetros' }, { status: 400 });
  }

  if (!validateToken(token, purchase_id)) {
    return Response.json({ error: 'Token inválido o expirado' }, { status: 403 });
  }

  const purchase = await base44.asServiceRole.entities.Purchase.get(purchase_id);
  if (!purchase) {
    return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }

  if (purchase.status !== 'pending_approval') {
    return Response.json({ 
      ok: false, 
      message: `Este pedido ya fue procesado. Estado actual: ${purchase.status}` 
    });
  }

  if (action === 'approve') {
    await base44.asServiceRole.entities.Purchase.update(purchase_id, {
      status: 'approved',
      approved_by: 'aprobado-via-correo',
      approved_at: new Date().toISOString(),
    });
    return Response.json({ ok: true, action: 'approved', purchase_number: purchase.purchase_number });
  }

  if (action === 'reject') {
    await base44.asServiceRole.entities.Purchase.update(purchase_id, {
      status: 'cancelled',
    });
    return Response.json({ ok: true, action: 'rejected', purchase_number: purchase.purchase_number });
  }

  return Response.json({ error: 'Acción inválida' }, { status: 400 });
});