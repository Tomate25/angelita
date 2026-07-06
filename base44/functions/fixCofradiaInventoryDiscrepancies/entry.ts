import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const COFADRIA_BRANCH_ID = '6a0b8b9458fa22a7efce711f';

        // Obtener todo el inventario de Cofradía
        const inventory = await base44.entities.Inventory.filter({ branch_id: COFADRIA_BRANCH_ID });
        
        // Obtener todos los movimientos de venta de Cofradía
        const movements = await base44.entities.InventoryMovement.filter({ 
            branch_id: COFADRIA_BRANCH_ID, 
            movement_type: 'sale' 
        });

        // Agrupar movimientos por producto
        const salesByProduct: Record<string, number> = {};
        const movementsByProduct: Record<string, any[]> = {};
        
        movements.forEach(m => {
            const productId = m.product_id;
            if (!salesByProduct[productId]) {
                salesByProduct[productId] = 0;
                movementsByProduct[productId] = [];
            }
            movementsByProduct[productId].push(m);
            // Si el movimiento tiene previous_stock: 0 y new_stock negativo, 
            // significa que no se descontó del inventario
            if (m.previous_stock === 0 && m.new_stock !== null && m.new_stock < 0) {
                salesByProduct[productId] += Math.abs(m.quantity);
            }
        });

        const discrepancies = [];
        
        // Verificar cada producto con ventas no descontadas
        for (const productId of Object.keys(salesByProduct)) {
            const totalSalesNotDeducted = salesByProduct[productId];
            if (totalSalesNotDeducted === 0) continue;

            const inv = inventory.find(i => i.product_id === productId);
            if (!inv) continue;

            // Calcular el stock correcto
            const expectedQuantity = inv.quantity - totalSalesNotDeducted;
            
            discrepancies.push({
                product_id: productId,
                product_name: inv.product_name,
                current_quantity: inv.quantity,
                sales_not_deducted: totalSalesNotDeducted,
                expected_quantity: expectedQuantity,
                inventory_id: inv.id,
                avg_cost: inv.avg_cost || 0,
                movement_to_fix: movementsByProduct[productId].find(m => m.previous_stock === 0 && m.new_stock !== null && m.new_stock < 0),
            });
        }

        // Corregir las discrepancias por lotes de 5
        const corrected = [];
        for (let i = 0; i < discrepancies.length; i += 5) {
            const batch = discrepancies.slice(i, i + 5);
            
            for (const disc of batch) {
                await base44.entities.Inventory.update(disc.inventory_id, {
                    quantity: disc.expected_quantity,
                    total_value: disc.expected_quantity * disc.avg_cost,
                });

                if (disc.movement_to_fix) {
                    await base44.entities.InventoryMovement.update(disc.movement_to_fix.id, {
                        previous_stock: disc.current_quantity,
                        new_stock: disc.expected_quantity,
                    });
                }

                corrected.push({
                    product_name: disc.product_name,
                    before: disc.current_quantity,
                    after: disc.expected_quantity,
                });
            }
            
            // Pausa entre lotes
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return Response.json({
            success: true,
            message: `Corregidas ${corrected.length} discrepancias de inventario`,
            details: {
                total_discrepancies: discrepancies.length,
                corrected_count: corrected.length,
                corrected_products: corrected.slice(0, 20), // Mostrar solo primeros 20
            },
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});