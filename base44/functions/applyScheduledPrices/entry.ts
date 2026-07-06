import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Get all pending schedules with effective_date <= today
    const schedules = await base44.asServiceRole.entities.ProductPriceSchedule.filter({ applied: false });
    const pending = schedules.filter(s => s.effective_date <= today);

    let applied = 0;
    let errors = 0;

    for (const schedule of pending) {
      try {
        const updates = {};
        if (schedule.new_price != null) updates.price = schedule.new_price;
        if (schedule.new_wholesale_price != null) updates.wholesale_price = schedule.new_wholesale_price;
        if (schedule.new_special_price != null) updates.special_price = schedule.new_special_price;
        if (schedule.new_cost != null) updates.cost = schedule.new_cost;

        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.Product.update(schedule.product_id, updates);
        }

        await base44.asServiceRole.entities.ProductPriceSchedule.update(schedule.id, {
          applied: true,
          applied_at: new Date().toISOString(),
        });

        applied++;
      } catch {
        errors++;
      }
    }

    return Response.json({
      success: true,
      applied,
      errors,
      message: `${applied} cambio(s) de precio aplicados, ${errors} error(es)`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});