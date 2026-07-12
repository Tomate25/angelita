import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const branch_id = body.branch_id;
    const code = (body.branch_code || 'ORD').toUpperCase();
    if (!branch_id) return Response.json({ error: 'branch_id requerido' }, { status: 400 });

    // asServiceRole respeta el modo Test/Producción (la secuencia y las órdenes
    // quedan en la misma base que el frontend). base44.entities en el backend
    // siempre apunta a Producción, lo que desalineaba la verificación en Test.
    const seqs = await base44.asServiceRole.entities.OrderSequence.filter({ branch_id });
    let seq = seqs[0];

    for (let attempt = 0; attempt < 12; attempt++) {
      const nextNumber = seq ? (seq.last_number || 0) + 1 : 1;
      const orderNum = `${code}-${String(nextNumber).padStart(5, '0')}`;

      const existing = await base44.asServiceRole.entities.Order.filter({ order_number: orderNum });
      if (existing.length > 0) {
        if (seq) {
          seq = await base44.asServiceRole.entities.OrderSequence.update(seq.id, {
            last_number: nextNumber,
            last_order_number: orderNum,
          });
        } else {
          seq = await base44.asServiceRole.entities.OrderSequence.create({
            branch_id,
            branch_code: code,
            last_number: nextNumber,
            last_order_number: orderNum,
          });
        }
        continue;
      }

      if (seq) {
        await base44.asServiceRole.entities.OrderSequence.update(seq.id, {
          last_number: nextNumber,
          last_order_number: orderNum,
        });
      } else {
        await base44.asServiceRole.entities.OrderSequence.create({
          branch_id,
          branch_code: code,
          last_number: nextNumber,
          last_order_number: orderNum,
        });
      }

      return Response.json({ order_number: orderNum, number: nextNumber });
    }

    return Response.json({ error: 'No se pudo generar consecutivo tras varios intentos' }, { status: 500 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});