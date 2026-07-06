import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const envSalt = (() => { try { return Deno.env.get('APPROVE_TOKEN_SALT'); } catch { return null; } })();
const SALT = envSalt || 'angelitas-erp-secret-2024';
const envAppUrl = (() => { try { return Deno.env.get('APP_URL'); } catch { return null; } })();
const APP_URL = envAppUrl || 'https://683714e41b46eddf804f9e46.base44.app';

function generateToken(purchaseId) {
  return btoa(`${purchaseId}:${SALT}`).replace(/=/g, '');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const purchase = body.purchase;

  if (!purchase) return Response.json({ error: 'Missing purchase data' }, { status: 400 });

  const approverEmails = purchase.approver_emails || [];
  if (approverEmails.length === 0) {
    return Response.json({ ok: true, sent_to: 0, message: 'No approver emails configured' });
  }

  const token = generateToken(purchase.id);
  const approveUrl = `${APP_URL}/approve-purchase?id=${purchase.id}&token=${token}&action=approve`;
  const rejectUrl  = `${APP_URL}/approve-purchase?id=${purchase.id}&token=${token}&action=reject`;

  const itemsHtml = (purchase.items || []).map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.product_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity_ordered}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">C$${(item.unit_cost || 0).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">C$${(item.subtotal || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  const emailBody = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#ea580c;margin-bottom:4px;">🛒 Pedido Pendiente de tu Aprobación</h2>
      <p style="color:#666;margin-top:0;">Se ha generado un nuevo pedido de compra que requiere tu aprobación.</p>

      <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:4px 0;"><strong>Número:</strong> ${purchase.purchase_number}</p>
        <p style="margin:4px 0;"><strong>Proveedor:</strong> ${purchase.supplier_name}</p>
        <p style="margin:4px 0;"><strong>Sucursal destino:</strong> ${purchase.branch_name || ''}</p>
        <p style="margin:4px 0;"><strong>Solicitado por:</strong> ${purchase.requested_by || ''}</p>
        <p style="margin:4px 0;"><strong>Total:</strong> <strong style="color:#ea580c;">C$${(purchase.total || 0).toFixed(2)}</strong></p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="background:#ea580c;color:#fff;">
            <th style="padding:10px 12px;text-align:left;">Producto</th>
            <th style="padding:10px 12px;text-align:center;">Cantidad</th>
            <th style="padding:10px 12px;text-align:right;">Costo Unit.</th>
            <th style="padding:10px 12px;text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr style="font-weight:bold;">
            <td colspan="3" style="padding:10px 12px;text-align:right;">TOTAL:</td>
            <td style="padding:10px 12px;text-align:right;">C$${(purchase.total || 0).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      ${purchase.notes ? `<p style="color:#555;font-style:italic;">Notas: ${purchase.notes}</p>` : ''}

      <!-- Action Buttons -->
      <div style="margin:24px 0;text-align:center;">
        <p style="color:#444;font-size:15px;margin-bottom:16px;font-weight:600;">¿Qué deseas hacer con este pedido?</p>
        <a href="${approveUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:15px;margin:0 8px;">
          ✅ Aprobar Pedido
        </a>
        <a href="${rejectUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:15px;margin:0 8px;">
          ❌ Rechazar Pedido
        </a>
      </div>

      <p style="color:#999;font-size:12px;margin-top:24px;text-align:center;">Este correo fue generado automáticamente por Angelita's ERP.<br/>Al hacer clic en los botones, tu decisión quedará registrada inmediatamente.</p>
    </div>
  `;

  const results = await Promise.allSettled(
    approverEmails.map(email =>
      base44.integrations.Core.SendEmail({
        to: email.trim(),
        subject: `🛒 Aprobación requerida: ${purchase.purchase_number} — ${purchase.supplier_name} (C$${(purchase.total || 0).toFixed(2)})`,
        body: emailBody,
      })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  console.log(`Emails sent: ${sent}, failed: ${failed}`);

  return Response.json({ ok: true, sent_to: sent, failed });
});