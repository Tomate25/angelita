import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const COFADRIA_BRANCH_ID = '6a0b8b9458fa22a7efce711f';
        const MOVEMENT_DATE = '2026-05-31T23:59:59';

        // Obtener todos los movimientos de Cofradía con reference_id 'cofadia-initial-load'
        const movements = await base44.entities.InventoryMovement.filter({
            branch_id: COFADRIA_BRANCH_ID,
            reference_id: 'cofadia-initial-load'
        });

        let updatedCount = 0;

        // Actualizar por lotes de 20
        for (let i = 0; i < movements.length; i += 20) {
            const batch = movements.slice(i, i + 20);
            await Promise.all(
                batch.map(m => 
                    base44.entities.InventoryMovement.update(m.id, {
                        movement_date: MOVEMENT_DATE
                    })
                )
            );
            updatedCount += batch.length;
            // Pequeña pausa entre lotes
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        return Response.json({
            success: true,
            message: 'Fechas de movimientos actualizadas exitosamente',
            details: {
                updated_count: updatedCount,
                movement_date: MOVEMENT_DATE,
            },
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});