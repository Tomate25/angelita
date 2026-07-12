const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { generateId } = require('./entities');

const router = express.Router();

// Helper to generate the approval token
function generateApprovalToken(purchaseId) {
  const salt = process.env.APPROVE_TOKEN_SALT || 'angelitas-erp-secret-2024';
  return Buffer.from(`${purchaseId}:${salt}`).toString('base64').replace(/=/g, '');
}

function validateApprovalToken(token, purchaseId) {
  return token === generateApprovalToken(purchaseId);
}

// 1. POST /api/functions/applyScheduledPrices
router.post('/applyScheduledPrices', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const todayStr = `${today} 23:59:59`;

    // Get all pending schedules with effective_date <= today
    const [schedules] = await pool.query(
      'SELECT * FROM `product_price_schedule` WHERE `applied` = 0 AND `effective_date` <= ?',
      [todayStr]
    );

    let applied = 0;
    let errors = 0;

    for (const schedule of schedules) {
      try {
        const updates = [];
        const params = [];

        if (schedule.new_price != null) {
          updates.push('`price` = ?');
          params.push(schedule.new_price);
        }
        if (schedule.new_wholesale_price != null) {
          updates.push('`wholesale_price` = ?');
          params.push(schedule.new_wholesale_price);
        }
        if (schedule.new_special_price != null) {
          updates.push('`special_price` = ?');
          params.push(schedule.new_special_price);
        }
        if (schedule.new_cost != null) {
          updates.push('`cost` = ?');
          params.push(schedule.new_cost);
        }

        if (updates.length > 0) {
          params.push(schedule.product_id);
          await pool.query(
            `UPDATE \`product\` SET ${updates.join(', ')} WHERE \`id\` = ?`,
            params
          );
        }

        await pool.query(
          'UPDATE `product_price_schedule` SET `applied` = 1, `applied_at` = ? WHERE `id` = ?',
          [new Date(), schedule.id]
        );

        applied++;
      } catch (err) {
        console.error('Error applying price schedule:', schedule.id, err);
        errors++;
      }
    }

    return res.json({
      success: true,
      applied,
      errors,
      message: `${applied} cambio(s) de precio aplicados, ${errors} error(es)`
    });
  } catch (err) {
    console.error('applyScheduledPrices error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 2. POST /api/functions/approvePurchaseByToken (Public Route)
router.post('/approvePurchaseByToken', async (req, res) => {
  const { token, purchase_id, action } = req.body || {};

  if (!token || !purchase_id) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  if (!validateApprovalToken(token, purchase_id)) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }

  try {
    const [purchases] = await pool.query('SELECT * FROM `purchase` WHERE `id` = ?', [purchase_id]);
    if (purchases.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const purchase = purchases[0];

    if (purchase.status !== 'pending_approval') {
      return res.json({
        ok: false,
        message: `Este pedido ya fue procesado. Estado actual: ${purchase.status}`
      });
    }

    if (action === 'approve') {
      await pool.query(
        'UPDATE `purchase` SET `status` = ?, `approved_by` = ?, `approved_at` = ? WHERE `id` = ?',
        ['approved', 'aprobado-via-correo', new Date(), purchase_id]
      );
      return res.json({ ok: true, action: 'approved', purchase_number: purchase.purchase_number });
    }

    if (action === 'reject') {
      await pool.query(
        'UPDATE `purchase` SET `status` = ? WHERE `id` = ?',
        ['cancelled', purchase_id]
      );
      return res.json({ ok: true, action: 'rejected', purchase_number: purchase.purchase_number });
    }

    return res.status(400).json({ error: 'Acción inválida' });
  } catch (err) {
    console.error('approvePurchaseByToken error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 3. POST /api/functions/fixCofradiaInventoryDiscrepancies
router.post('/fixCofradiaInventoryDiscrepancies', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  const COFADRIA_BRANCH_ID = '6a0b8b9458fa22a7efce711f';

  try {
    // 1. Get all inventory of Cofradia
    const [inventory] = await pool.query('SELECT * FROM `inventory` WHERE `branch_id` = ?', [COFADRIA_BRANCH_ID]);
    
    // 2. Get all sales movements of Cofradia
    const [movements] = await pool.query(
      'SELECT * FROM `inventory_movement` WHERE `branch_id` = ? AND `movement_type` = ?',
      [COFADRIA_BRANCH_ID, 'sale']
    );

    // Group movements by product
    const salesByProduct = {};
    const movementsByProduct = {};

    movements.forEach(m => {
      const productId = m.product_id;
      if (!salesByProduct[productId]) {
        salesByProduct[productId] = 0;
        movementsByProduct[productId] = [];
      }
      movementsByProduct[productId].push(m);
      
      const prevStock = parseFloat(m.previous_stock || 0);
      const newStock = parseFloat(m.new_stock || 0);
      const qty = parseFloat(m.quantity || 0);

      // If previous_stock = 0 and new_stock is negative, it wasn't deducted correctly
      if (prevStock === 0 && newStock < 0) {
        salesByProduct[productId] += Math.abs(qty);
      }
    });

    const discrepancies = [];

    for (const productId of Object.keys(salesByProduct)) {
      const totalSalesNotDeducted = salesByProduct[productId];
      if (totalSalesNotDeducted === 0) continue;

      const inv = inventory.find(i => i.product_id === productId);
      if (!inv) continue;

      const currentQty = parseFloat(inv.quantity || 0);
      const expectedQuantity = currentQty - totalSalesNotDeducted;
      const avgCost = parseFloat(inv.avg_cost || 0);

      const movementToFix = movementsByProduct[productId].find(m => {
        const prevStock = parseFloat(m.previous_stock || 0);
        const newStock = parseFloat(m.new_stock || 0);
        return prevStock === 0 && newStock < 0;
      });

      discrepancies.push({
        product_id: productId,
        product_name: inv.product_name,
        current_quantity: currentQty,
        sales_not_deducted: totalSalesNotDeducted,
        expected_quantity: expectedQuantity,
        inventory_id: inv.id,
        avg_cost: avgCost,
        movement_to_fix: movementToFix
      });
    }

    const corrected = [];

    // Correct discrepancies
    for (const disc of discrepancies) {
      await pool.query(
        'UPDATE `inventory` SET `quantity` = ?, `total_value` = ? WHERE `id` = ?',
        [disc.expected_quantity, disc.expected_quantity * disc.avg_cost, disc.inventory_id]
      );

      if (disc.movement_to_fix) {
        await pool.query(
          'UPDATE `inventory_movement` SET `previous_stock` = ?, `new_stock` = ? WHERE `id` = ?',
          [disc.current_quantity, disc.expected_quantity, disc.movement_to_fix.id]
        );
      }

      corrected.push({
        product_name: disc.product_name,
        before: disc.current_quantity,
        after: disc.expected_quantity
      });
    }

    return res.json({
      success: true,
      message: `Corregidas ${corrected.length} discrepancias de inventario`,
      details: {
        total_discrepancies: discrepancies.length,
        corrected_count: corrected.length,
        corrected_products: corrected.slice(0, 20)
      }
    });
  } catch (err) {
    console.error('fixCofradiaInventoryDiscrepancies error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 4. POST /api/functions/initializeCofradiaInventory
router.post('/initializeCofradiaInventory', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  const COFADRIA_BRANCH_ID = '6a0b8b9458fa22a7efce711f';
  const COFADRIA_BRANCH_NAME = 'Cofradia';

  // The 318 products list
  const inventoryList = [
    { sku: 'CU30', name: 'Aceite Menen', quantity: 6 },
    { sku: 'GR11', name: 'Aceite Santa Monica Galon', quantity: 3 },
    { sku: 'GR12', name: 'Aceite Santa Monica Litro', quantity: 62 },
    { sku: 'GR16', name: 'Aceite Toys', quantity: 7 },
    { sku: 'ME310', name: 'Acetaminofen', quantity: 101 },
    { sku: 'ME35', name: 'Actimicina Bronquial', quantity: 191 },
    { sku: 'ME34', name: 'Actimicina Gripe Y Tos', quantity: 33 },
    { sku: 'BH213', name: 'Agua Alpina 1 Lt', quantity: 25 },
    { sku: 'BH214', name: 'Agua Alpina 2 Lt', quantity: 16 },
    { sku: 'SN717', name: 'Alboroto', quantity: 18 },
    { sku: 'ME32', name: 'Alka Ad', quantity: 62 },
    { sku: '', name: 'Alka seltzer', quantity: 7 },
    { sku: 'ME339', name: 'Alkagastric', quantity: 11 },
    { sku: 'ME36', name: 'Amoxicilina', quantity: 109 },
    { sku: 'BE191', name: 'Amp Grande', quantity: 34 },
    { sku: 'BE192', name: 'Amp Pequeño', quantity: 18 },
    { sku: '', name: 'Arroz Caballo Negro', quantity: 69 },
    { sku: 'GR114', name: 'Arroz Faisan Libra Empacad', quantity: 69 },
    { sku: 'GR116', name: 'Arroz Tio Pelon Azul', quantity: 64 },
    { sku: 'GR117', name: 'Arroz Tio Pelon Azul 25 Lb', quantity: 15 },
    { sku: 'GR119', name: 'Arroz Tio Pelon Qq Rojo', quantity: 79.5 },
    { sku: 'GR118', name: 'Arroz Tio Pelon Rojo 25 Lb', quantity: 2 },
    { sku: 'AS41', name: 'Asistin 450 Ml', quantity: 9 },
    { sku: 'CE51', name: 'Avena Bolsa De Libra - Quaker', quantity: 16 },
    { sku: 'CE52', name: 'Avena Ristra', quantity: 8 },
    { sku: 'CE53', name: 'Avena Ristra De - Quaker', quantity: 10 },
    { sku: 'ME353', name: 'Azitromicina', quantity: 7 },
    { sku: 'GR121', name: 'Café 1820 40 Sobres', quantity: 3 },
    { sku: '', name: 'Cafe 1820-80 unidades', quantity: 1 },
    { sku: 'CA126', name: 'Café Presto (80 Sobre)', quantity: 4 },
    { sku: 'CA128', name: 'Café Presto (Vaso 50Gr)', quantity: 8 },
    { sku: 'CA127', name: 'Café Presto 150 Gr', quantity: 5 },
    { sku: 'CA1211', name: 'Café Selecto', quantity: 36 },
    { sku: 'CA1212', name: 'Café Toro (1 Bolsitas Para 6 Tasas)', quantity: 118 },
    { sku: 'JU2014', name: 'Campestre 1 Ltro', quantity: 42 },
    { sku: 'HO65', name: 'Candela', quantity: 2 },
    { sku: 'CA121', name: 'Capuccino', quantity: 9 },
    { sku: 'CC131', name: 'Carne De Cerdo', quantity: 45.5 },
    { sku: 'CR113', name: 'Carne De Res Giba', quantity: 3.5 },
    { sku: 'CR114', name: 'Carne De Res Posta', quantity: 20.5 },
    { sku: 'CR112', name: 'Carne Molida Pollo', quantity: 12 },
    { sku: 'CR111', name: 'Carne Molida Res', quantity: 27 },
    { sku: 'SN718', name: 'Centavito', quantity: 39 },
    { sku: 'CU263', name: 'Cepillo Adulto Premier', quantity: 2 },
    { sku: 'CU22', name: 'Cepillo Dental Adulto Clasico', quantity: 17 },
    { sku: 'CU262', name: 'Cepillo Dental Niño', quantity: 9 },
    { sku: 'CH142', name: 'Cereal Corn Flakes (Gran Día) Pequeño', quantity: 5 },
    { sku: 'CH145', name: 'Cereal Trigo Miel', quantity: 5 },
    { sku: 'EN256', name: 'Chicharos Herz', quantity: 2 },
    { sku: 'SN75', name: 'Chicharrones', quantity: 73 },
    { sku: 'DU94', name: 'Chiclin', quantity: 500 },
    { sku: 'SA1522', name: 'Chile Don Julio Grande', quantity: 1 },
    { sku: 'SA151', name: 'Chile Lizano Don Julio Peq', quantity: 4 },
    { sku: 'SA153', name: 'Chile Lizano Pequeño', quantity: 12 },
    { sku: 'CU23', name: 'Chinola', quantity: 5 },
    { sku: 'SN719', name: 'Churritos', quantity: 12 },
    { sku: 'CI161', name: 'Cigarro Elephante Pqt', quantity: 1 },
    { sku: '', name: 'Cigarro Pall Mall Unidad', quantity: 11 },
    { sku: 'CI164', name: 'Cigarro Palmal 10 Medio Paquete', quantity: 21 },
    { sku: 'CI167', name: 'Cigarros Elephante Unidad', quantity: 9 },
    { sku: 'CI162', name: 'Cigarros Moder Pqt', quantity: 165 },
    { sku: 'CI166', name: 'Cigarros Moder Unidad', quantity: 17 },
    { sku: 'DU93', name: 'Cloret', quantity: 273 },
    { sku: 'AS49', name: 'Cloro Magia Blanca', quantity: 92 },
    { sku: 'AS411', name: 'Cloro Magia Blanca Lt', quantity: 5 },
    { sku: 'BG188', name: 'Coca Cola De 1 Ltrs Desechable', quantity: 110 },
    { sku: 'BG185', name: 'Cocacola Desechable 2Lts', quantity: 56 },
    { sku: 'BG186', name: 'Cocacola Desechable 355Ml', quantity: 158 },
    { sku: 'BG187', name: 'Cocacola Desechable 3Lts', quantity: 73 },
    { sku: 'HO66', name: 'Comida Para Cachorro', quantity: 58.5 },
    { sku: 'HO611', name: 'Comida Para Gato', quantity: 18 },
    { sku: 'HO67', name: 'Comida Para Perro', quantity: 131 },
    { sku: 'CO225', name: 'Consome Ajo Molido', quantity: 12 },
    { sku: 'CO221', name: 'Consome De Pollo', quantity: 25 },
    { sku: 'CO222', name: 'Consome De Res', quantity: 17 },
    { sku: 'CO226', name: 'Consome Pimienta Negra', quantity: 36 },
    { sku: 'CO223', name: 'Consome Sabor Y Color', quantity: 19 },
    { sku: 'CU24', name: 'Crema Corporal Stefania', quantity: 3 },
    { sku: 'LA172', name: 'Crema Media Libra', quantity: 16 },
    { sku: 'CU25', name: 'Crema Para Peinar Savile', quantity: 2 },
    { sku: 'CU26', name: 'Crema Para Peinar Sedal', quantity: 5 },
    { sku: 'CA1214', name: 'Cremora Ristra', quantity: 11 },
    { sku: 'LA174', name: 'Cuajada -Libra', quantity: 3 },
    { sku: 'ME317', name: 'Delor Antigripal', quantity: 63 },
    { sku: 'CU28', name: 'Desodorante Rexona 50Gr', quantity: 39 },
    { sku: 'CU29', name: 'Desodorante Rexona Bolsita', quantity: 83 },
    { sku: 'CU211', name: 'Desodorante Speed Stick Barra', quantity: 29 },
    { sku: 'AS442', name: 'Detergente Blanca Nieve', quantity: 26 },
    { sku: 'AS416', name: 'Detergente Espumil 500 Gr', quantity: 32 },
    { sku: 'ME318', name: 'Diclofenac', quantity: 80 },
    { sku: 'ME314', name: 'Dolo Vitalgia', quantity: 31 },
    { sku: 'ME313', name: 'Dolofin', quantity: 5 },
    { sku: 'CO228', name: 'Empanizador', quantity: 10 },
    { sku: 'HO68', name: 'Encendedor', quantity: 27 },
    { sku: 'RE231', name: 'Enrejado De Piña', quantity: 6 },
    { sku: 'BG1815', name: 'Ensa 1/2', quantity: 29 },
    { sku: 'AS418', name: 'Escoba Tucan', quantity: 4 },
    { sku: 'HO69', name: 'Fosforos Cajita', quantity: 127 },
    { sku: 'GR125', name: 'Frijol', quantity: 85.5 },
    { sku: 'ME319', name: 'Fungil', quantity: 12 },
    { sku: 'ME320', name: 'Fungil Spray', quantity: 6 },
    { sku: 'BE193', name: 'Fury', quantity: 85 },
    { sku: 'GA242', name: 'Galleta - Canasta', quantity: 2 },
    { sku: 'GA243', name: 'Galleta - Chiky', quantity: 17 },
    { sku: 'GA2423', name: 'Galleta - Chiky - Unidad', quantity: 1 },
    { sku: 'GA244', name: 'Galleta - Club Max', quantity: 5 },
    { sku: 'GA2424', name: 'Galleta - Club Max - Unidad', quantity: 8 },
    { sku: 'GA245', name: 'Galleta - Club Social', quantity: 17 },
    { sku: 'GA2425', name: 'Galleta - Club Social - Unidad', quantity: 9 },
    { sku: 'GA247', name: 'Galleta - Escolar', quantity: 19 },
    { sku: 'GA2427', name: 'Galleta - Escolar-Unidad', quantity: 1 },
    { sku: 'GA2410', name: 'Galleta - Ritz C/Queso', quantity: 3 },
    { sku: 'GA2430', name: 'Galleta - Ritz C/Queso - Unidad', quantity: 11 },
    { sku: 'GA2429', name: 'Galleta - Ritz -Unidad', quantity: 3 },
    { sku: 'GA241', name: 'Galleta - Waffle', quantity: 10 },
    { sku: 'GA2421', name: 'Galleta - Waffle-Unidad', quantity: 6 },
    { sku: 'GA2438', name: 'Galleta Mantequilla', quantity: 3 },
    { sku: 'GA2439', name: 'Galleta Mantequilla -Unidad', quantity: 6 },
    { sku: 'GA2413', name: 'Galleta Maria', quantity: 22 },
    { sku: 'BH215', name: 'Gatorade', quantity: 20 },
    { sku: 'CU268', name: 'Gel Babery 500Ml', quantity: 6 },
    { sku: 'CU215', name: 'Gel Barbery 200', quantity: 4 },
    { sku: 'CU216', name: 'Gel Ego 110Ml', quantity: 17 },
    { sku: 'CU214', name: 'Gel Ego 200', quantity: 10 },
    { sku: 'CU213', name: 'Gel Para Cabello Ego 500 Ml', quantity: 3 },
    { sku: 'CU217', name: 'Gel Ristra', quantity: 26 },
    { sku: 'AS48', name: 'Glide', quantity: 9 },
    { sku: 'DU96', name: 'Gomapino', quantity: 13 },
    { sku: 'HA261', name: 'Harina De Trigo', quantity: 11 },
    { sku: 'JU2011', name: 'Hi-C 250 Manzana Ml', quantity: 4 },
    { sku: 'JU2013', name: 'Hi-C Te 2 Litros', quantity: 12 },
    { sku: 'JU2012', name: 'Hi-C Te 250 Ml', quantity: 32 },
    { sku: 'ME350', name: 'Higadosanil', quantity: 89 },
    { sku: 'GR126', name: 'Huevos', quantity: 14 },
    { sku: 'ME321', name: 'Ibuwin Gel', quantity: 109 },
    { sku: 'CU219', name: 'Jabon Baño Palmolive 150Gr', quantity: 16 },
    { sku: 'CU220', name: 'Jabon De Baño Protex', quantity: 14 },
    { sku: 'AS420', name: 'Jabon De Lavar Ropa Bex', quantity: 13 },
    { sku: 'AS419', name: 'Jabon De Lavar Ropa Extra Jumbo', quantity: 14 },
    { sku: 'AS421', name: 'Jabon De Lavar Ropa Marfil (Ristra De 3)', quantity: 6 },
    { sku: 'AS422', name: 'Jabon De Lavar Ropa Zixx (Ristra De 3)', quantity: 13 },
    { sku: 'AS423', name: 'Jabon De Traste Zagas', quantity: 5 },
    { sku: 'CU222', name: 'Jabon Dk12', quantity: 16 },
    { sku: 'CU32', name: 'Jabon Menen', quantity: 3 },
    { sku: 'AS424', name: 'Jabon Rinso Borra', quantity: 23 },
    { sku: 'AS425', name: 'Jabon Rinso Disco', quantity: 12 },
    { sku: 'AS441', name: 'Jabon Zote', quantity: 6 },
    { sku: 'SN723', name: 'Jalapeño', quantity: 24 },
    { sku: 'CA123', name: 'Jalea', quantity: 8 },
    { sku: 'JU204', name: 'Jugo California', quantity: 20 },
    { sku: 'JU207', name: 'Jugo Campestre 1/2', quantity: 47 },
    { sku: 'JU208', name: 'Jugo Campestre 355', quantity: 39 },
    { sku: 'JU209', name: 'Jugo Campestre 3Ltrs', quantity: 13 },
    { sku: '', name: 'Jugo de la Granja', quantity: 13 },
    { sku: 'JU206', name: 'Jugo Del Valle Citrico 500Ml', quantity: 29 },
    { sku: 'JU203', name: 'Jugo Jugazzo', quantity: 58 },
    { sku: 'JU202', name: 'Jugo Lipton 1/2', quantity: 33 },
    { sku: 'CU224', name: 'Kit De Cepillo', quantity: 2 },
    { sku: 'BG1824', name: 'Kola Shaler 2 Litros', quantity: 2 },
    { sku: 'BG1823', name: 'Kola Shaler 3 Litros', quantity: 2 },
    { sku: 'CU225', name: 'Kotex Essencial', quantity: 2 },
    { sku: 'CU226', name: 'Kotex Manzanilla', quantity: 8 },
    { sku: 'CU227', name: 'Kotex Nocturna', quantity: 11 },
    { sku: 'SN729', name: 'Laky', quantity: 9 },
    { sku: 'LI271', name: 'Lapiceros Smarty', quantity: 10 },
    { sku: 'EN252', name: 'Lata - Atun Gaviota', quantity: 19 },
    { sku: 'EN257', name: 'Lata - Atun Valvo', quantity: 21 },
    { sku: 'EN254', name: 'Lata - Sardina Sirena Ovalada Grande', quantity: 2 },
    { sku: 'EN253', name: 'Lata - Sardina Sirena Picante 200Gr', quantity: 25 },
    { sku: 'LE281', name: 'Leche - Delisoya Libra Chocolate', quantity: 1 },
    { sku: 'LE284', name: 'Leche - Delisoya Libra Natural', quantity: 4 },
    { sku: 'LE288', name: 'Leche - Matilde Medio Litro', quantity: 5 },
    { sku: 'LE285', name: 'Leche - Nido Bolsa 360 #1', quantity: 5 },
    { sku: 'LE287', name: 'Leche - Nido Bolsa 360 #3', quantity: 9 },
    { sku: 'LE2811', name: 'Leche - Pinito Libra', quantity: 9 },
    { sku: 'DU103', name: 'Leche Burra', quantity: 1 },
    { sku: 'DU99', name: 'Leche Condensada Pequeña', quantity: 10 },
    { sku: 'LE2814', name: 'Leche Nutry Letty Litro', quantity: 3 },
    { sku: 'RE232', name: 'Lengua De Guayaba', quantity: 7 },
    { sku: 'ME360', name: 'Loratadina', quantity: 72 },
    { sku: 'SN76', name: 'Maruchan', quantity: 57 },
    { sku: 'HA263', name: 'Maseca Libra', quantity: 4 },
    { sku: 'SA156', name: 'Mayonesa Regia Bolsa Peq', quantity: 7 },
    { sku: 'GR131', name: 'Media Cajilla De Huevo', quantity: 1 },
    { sku: 'LA175', name: 'Media Margarina', quantity: 15.5 },
    { sku: 'CP301', name: 'Menudo', quantity: 12 },
    { sku: 'RE233', name: 'Morenita', quantity: 6 },
    { sku: 'EM311', name: 'Mortadela Delmor', quantity: 35 },
    { sku: 'SA1510', name: 'Mostaza Doy Pack', quantity: 3 },
    { sku: 'PB84', name: 'Mrs Brows', quantity: 11 },
    { sku: 'CP302', name: 'Muslo', quantity: 23 },
    { sku: 'SN721', name: 'Nachos', quantity: 23 },
    { sku: 'CA123', name: 'Nescafe De 120 Gr', quantity: 3 },
    { sku: 'CA1217', name: 'Nescafe Sobre', quantity: 133 },
    { sku: 'SN720', name: 'Pachanga Mix', quantity: 24 },
    { sku: 'AS429', name: 'Palas Plasticas', quantity: 2 },
    { sku: 'DU97', name: 'Paleta Tipitin-Cervez', quantity: 59 },
    { sku: 'RE237', name: 'Pan Para Hot Dog', quantity: 1 },
    { sku: 'PB85', name: 'Pan Tostado Clasico', quantity: 9 },
    { sku: 'CU273', name: 'Pañales Arrullito', quantity: 19 },
    { sku: 'CU229', name: 'Pañales Jueguitos', quantity: 10 },
    { sku: 'CU230', name: 'Papel Higienico Encanto', quantity: 1 },
    { sku: 'CU232', name: 'Papel Higienico Nevax', quantity: 34 },
    { sku: '', name: 'Papel Higienico Nube Blanca', quantity: 24 },
    { sku: '', name: 'Papel Higienico Scoot Rinde Max', quantity: 9 },
    { sku: 'CU231', name: 'Papel Higienico Vueno', quantity: 24 },
    { sku: 'CU233', name: 'Pasta De Lustrar Nugget Grande (65Gr)', quantity: 6 },
    { sku: 'CU234', name: 'Pasta De Lustrar Nugget Mediana', quantity: 5 },
    { sku: 'CU237', name: 'Pasta Dental Colgate 100Ml', quantity: 23 },
    { sku: 'CU238', name: 'Pasta Dental Colgate 150Ml', quantity: 22 },
    { sku: 'CU236', name: 'Pasta Dental Colgate 75Ml', quantity: 39 },
    { sku: 'CU241', name: 'Pasta Dental Total Doce 150 Ml', quantity: 11 },
    { sku: 'CU239', name: 'Pasta Dental Total Doce 75Ml', quantity: 16 },
    { sku: 'PA325', name: 'Pasta Spaguetty Milano', quantity: 6 },
    { sku: 'PA321', name: 'Pasta Spaguetty Padova', quantity: 6 },
    { sku: 'PA3210', name: 'Pasta Tornillito', quantity: 16 },
    { sku: 'AS443', name: 'Paste De Alumino', quantity: 6 },
    { sku: 'AS430', name: 'Paste De Traste', quantity: 5 },
    { sku: 'RE234', name: 'Pastel De Queso', quantity: 1 },
    { sku: 'ME327', name: 'Pastilla Omeprazol', quantity: 49 },
    { sku: 'ME326', name: 'Pastilla Virogrip', quantity: 26 },
    { sku: 'HO64', name: 'Pega Loca', quantity: 13 },
    { sku: 'SA1513', name: 'Pepinesa Doy Pack', quantity: 5 },
    { sku: 'BG1822', name: 'Pepsi 1 Lt Sabor', quantity: 74 },
    { sku: 'BG1813', name: 'Pepsi 1/2', quantity: 72 },
    { sku: 'BG1811', name: 'Pepsi 12 Onz', quantity: 196 },
    { sku: 'BG1817', name: 'Pepsi 3 Ltrs', quantity: 12 },
    { sku: 'ME349', name: 'Peptobismol - Pastilla', quantity: 16 },
    { sku: 'CP303', name: 'Pierna Con Muslo', quantity: 67.21 },
    { sku: 'PB810', name: 'Pingüino', quantity: 15 },
    { sku: 'CE56', name: 'Pinolillo Libra', quantity: 28 },
    { sku: 'HO610', name: 'Plagatop', quantity: 45 },
    { sku: 'DE353', name: 'Plato #9', quantity: 2 },
    { sku: 'CP306', name: 'Pollo Entero', quantity: 212.28 },
    { sku: 'CP308', name: 'Pollo Trozos', quantity: 14 },
    { sku: 'CA125', name: 'Presto Sobre', quantity: 58 },
    { sku: 'GA2418', name: 'Principe (Chocolate Y Vainilla)', quantity: 28 },
    { sku: 'GA2419', name: 'Principe Drops', quantity: 1 },
    { sku: 'SN71', name: 'Quesito Max', quantity: 46 },
    { sku: 'LA173', name: 'Queso Media Libra', quantity: 3 },
    { sku: 'SN77', name: 'Ranchita Queso Y Picante', quantity: 85 },
    { sku: 'BE194', name: 'Raptor Grande', quantity: 26 },
    { sku: 'BE195', name: 'Raptor Pequeño', quantity: 75 },
    { sku: 'AS433', name: 'Ristra De Suavitel', quantity: 11 },
    { sku: 'RE237', name: 'Roscas', quantity: 5 },
    { sku: 'CU275', name: 'Saba Manzanilla', quantity: 7 },
    { sku: 'CU228', name: 'Saba Nocturna', quantity: 5 },
    { sku: 'GR127', name: 'Sal Fina Atlantida', quantity: 27 },
    { sku: 'ME328', name: 'Salandrew', quantity: 32 },
    { sku: '', name: 'salchicha para hotdog', quantity: 45 },
    { sku: 'EM312', name: 'Salchichon Chile Y Sin Chile', quantity: 25 },
    { sku: 'SA1518', name: 'Salsa De Tomate Gourmet', quantity: 2 },
    { sku: 'SA1519', name: 'Salsa De Tomate Jumbito', quantity: 26 },
    { sku: 'SA1517', name: 'Salsa De Tomate Natura Doy Pack', quantity: 6 },
    { sku: 'SA1520', name: 'Salsa Inglesa 280 Ml', quantity: 10 },
    { sku: 'CU243', name: 'Shampo Head & Shoulder 180 Ml', quantity: 8 },
    { sku: 'CU244', name: 'Shampo Head & Shoulder 375 Ml', quantity: 6 },
    { sku: 'CU245', name: 'Shampo Palmolive Naturals 750Ml', quantity: 4 },
    { sku: 'CU247', name: 'Shampo Palmolive Optims 400Ml', quantity: 8 },
    { sku: 'CU257', name: 'Shampo Pantene 200Ml', quantity: 11 },
    { sku: 'CU250', name: 'Shampo Ricitos De Oro', quantity: 6 },
    { sku: 'CU249', name: 'Shampo Ristra Pequeña', quantity: 110 },
    { sku: 'CU252', name: 'Shampo Sabile De 550 Ml', quantity: 3 },
    { sku: 'CU253', name: 'Shampo Sedal 340Ml', quantity: 4 },
    { sku: 'GR128', name: 'Sopas Maggui - Costilla', quantity: 8 },
    { sku: 'GR129', name: 'Sopas Maggui - Pollo', quantity: 19 },
    { sku: 'GA2420', name: 'Sponch', quantity: 6 },
    { sku: 'AS435', name: 'Suavitel 850 Ml', quantity: 3 },
    { sku: 'ME352', name: 'Sulfaprin', quantity: 36 },
    { sku: 'ME329', name: 'Tabcin', quantity: 10 },
    { sku: 'ME330', name: 'Tabcin Gripe Y Tos', quantity: 7 },
    { sku: 'SN724', name: 'Tajada Simple', quantity: 8 },
    { sku: 'BP341', name: 'Tang', quantity: 62 },
    { sku: 'SN711', name: 'Taquerito Queso Y Picante', quantity: 53 },
    { sku: 'ME358', name: 'Te Tilo', quantity: 16 },
    { sku: 'ME359', name: 'Te Verde', quantity: 11 },
    { sku: 'AS438', name: 'Terso 720 Ml', quantity: 15 },
    { sku: 'CU259', name: 'Toallas Humedas Family Choice Grande', quantity: 22 },
    { sku: 'SN734', name: 'Tozteka', quantity: 19 },
    { sku: 'BA333', name: 'Ultralite Celeste Litro', quantity: 4 },
    { sku: 'ME346', name: 'Uropirin', quantity: 7 },
    { sku: 'DE351', name: 'Vaso 12 Onz', quantity: 2 },
    { sku: 'SA1521', name: 'Vinagre Blanco', quantity: 7 },
    { sku: 'ME334', name: 'Vitaflenaco', quantity: 31 },
    { sku: 'ME332', name: 'Vital Fuerte', quantity: 1 },
    { sku: 'HO613', name: 'Windex', quantity: 1 },
    { sku: 'SN722', name: 'Yukateka', quantity: 24 },
    { sku: 'SN713', name: 'Yumi Semilla', quantity: 24 },
    { sku: 'SN712', name: 'Yumix', quantity: 33 },
    { sku: 'SN735', name: 'Yumix Semilla Grande', quantity: 17 },
    { sku: 'SN714', name: 'Zambos', quantity: 17 },
    { sku: 'ME335', name: 'Zepol', quantity: 7 },
    { sku: 'ME336', name: 'Zepol Deportista', quantity: 8 },
    { sku: 'SN715', name: 'Zibas Especies Y Clasicas', quantity: 11 },
    { sku: 'ME337', name: 'Zorritone', quantity: 463 },
    { sku: '', name: 'Talco de Bebe menen', quantity: 2 },
    { sku: '', name: 'Crema para Peinar Sobre Pequeño', quantity: 2 },
    { sku: '', name: 'Crema para Peinar Sobre Grande', quantity: 24 },
    { sku: '', name: 'Pasta Colgate 50ml', quantity: 4 },
    { sku: '', name: 'Acetona', quantity: 1 },
    { sku: '', name: 'Jabon Palmolive Pequeño', quantity: 5 }
  ];

  try {
    // Step 1: Fetch all products from catalog
    const [allProducts] = await pool.query('SELECT * FROM `product`');
    
    // Map products by SKU and name
    const productMapBySku = {};
    const productMapByName = {};

    allProducts.forEach(p => {
      if (p.sku) {
        productMapBySku[p.sku.toUpperCase()] = p;
      }
      const normalizedName = p.name.toLowerCase().trim().replace(/\s+/g, ' ');
      productMapByName[normalizedName] = p;
    });

    // Step 2: Delete current Cofradia inventory records
    await pool.query('DELETE FROM `inventory` WHERE `branch_id` = ?', [COFADRIA_BRANCH_ID]);

    let createdCount = 0;
    let notFoundCount = 0;
    const notFoundProducts = [];

    // Step 3: Loop and insert matching records
    for (const item of inventoryList) {
      let product = null;

      if (item.sku) {
        product = productMapBySku[item.sku.toUpperCase()];
      }

      if (!product && item.name) {
        const normalizedName = item.name.toLowerCase().trim().replace(/\s+/g, ' ');
        product = productMapByName[normalizedName];

        if (!product) {
          // Approximate match
          const found = allProducts.find(p =>
            p.name.toLowerCase().includes(item.name.toLowerCase().substring(0, 10))
          );
          if (found) product = found;
        }
      }

      if (!product) {
        notFoundCount++;
        notFoundProducts.push(item);
        continue;
      }

      const invId = generateId();
      const movId = generateId();
      const productCost = parseFloat(product.cost || 0);

      // Create Inventory Row
      await pool.query(
        'INSERT INTO `inventory` (id, created_date, updated_date, product_id, product_name, branch_id, branch_name, quantity, avg_cost, total_value) VALUES (?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?)',
        [
          invId,
          product.id,
          product.name,
          COFADRIA_BRANCH_ID,
          COFADRIA_BRANCH_NAME,
          item.quantity,
          productCost,
          productCost * item.quantity
        ]
      );

      // Create Movement Row
      await pool.query(
        'INSERT INTO `inventory_movement` (id, created_date, updated_date, product_id, product_name, branch_id, branch_name, movement_type, quantity, unit_cost, reference_id, reference_type, notes, previous_stock, new_stock, movement_date) VALUES (?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        [
          movId,
          product.id,
          product.name,
          COFADRIA_BRANCH_ID,
          COFADRIA_BRANCH_NAME,
          'adjustment',
          item.quantity,
          productCost,
          'cofadia-initial-load',
          'initial_inventory',
          'Carga Inicial Inventario Cofradía 11-Jun-2026',
          0,
          item.quantity
        ]
      );

      createdCount++;
    }

    return res.json({
      success: true,
      message: 'Inventario de Cofradía cargado exitosamente',
      details: {
        deleted_previous_records: allProducts.length, // approximation of what was processed
        created_records: createdCount,
        not_found_products: notFoundCount,
        not_found_list: notFoundProducts
      }
    });
  } catch (err) {
    console.error('initializeCofradiaInventory error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 5. POST /api/functions/notifyPurchaseApproval
router.post('/notifyPurchaseApproval', authenticateToken, async (req, res) => {
  const purchase = req.body?.purchase;

  if (!purchase) {
    return res.status(400).json({ error: 'Missing purchase data' });
  }

  const approverEmails = purchase.approver_emails || [];
  const emailsArray = Array.isArray(approverEmails)
    ? approverEmails
    : typeof approverEmails === 'string'
      ? approverEmails.split(',').map(e => e.trim())
      : [];

  if (emailsArray.length === 0) {
    return res.json({ ok: true, sent_to: 0, message: 'No approver emails configured' });
  }

  const appUrl = process.env.APP_URL || 'http://localhost:5000';
  const token = generateApprovalToken(purchase.id);
  const approveUrl = `${appUrl}/approve-purchase?id=${purchase.id}&token=${token}&action=approve`;
  const rejectUrl  = `${appUrl}/approve-purchase?id=${purchase.id}&token=${token}&action=reject`;

  const items = Array.isArray(purchase.items)
    ? purchase.items
    : typeof purchase.items === 'string'
      ? JSON.parse(purchase.items)
      : [];

  const itemsHtml = items.map(item => `
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

  // Log/Mock sending the emails
  let sent = 0;
  let failed = 0;

  for (const email of emailsArray) {
    try {
      console.log('----------------------------------------------------');
      console.log(`[MOCK EMAIL SENT TO ${email.trim()}]`);
      console.log(`Subject: 🛒 Aprobación requerida: ${purchase.purchase_number} — ${purchase.supplier_name}`);
      console.log(`Body Snippet: App/Reject URLs logged below.`);
      console.log(`Approve URL: ${approveUrl}`);
      console.log(`Reject URL: ${rejectUrl}`);
      console.log('----------------------------------------------------');
      sent++;
    } catch (err) {
      console.error(`Failed to send email to ${email}:`, err);
      failed++;
    }
  }

  return res.json({ ok: true, sent_to: sent, failed });
});

// 6. POST /api/functions/updateCofradiaMovementDates
router.post('/updateCofradiaMovementDates', authenticateToken, async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  const COFADRIA_BRANCH_ID = '6a0b8b9458fa22a7efce711f';
  const MOVEMENT_DATE = '2026-05-31 23:59:59'; // Clean format for datetime

  try {
    // Perform bulk update of all matching movements
    const [result] = await pool.query(
      'UPDATE `inventory_movement` SET `movement_date` = ? WHERE `branch_id` = ? AND `reference_id` = ?',
      [MOVEMENT_DATE, COFADRIA_BRANCH_ID, 'cofadia-initial-load']
    );

    return res.json({
      success: true,
      message: 'Fechas de movimientos actualizadas exitosamente',
      details: {
        updated_count: result.affectedRows,
        movement_date: MOVEMENT_DATE
      }
    });
  } catch (err) {
    console.error('updateCofradiaMovementDates error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 7. POST /api/functions/generateOrderNumber
router.post('/generateOrderNumber', authenticateToken, async (req, res) => {
  const { branch_id, branch_code } = req.body || {};

  if (!branch_id || !branch_code) {
    return res.json({ data: { error: 'Faltan parámetros branch_id o branch_code' } });
  }

  try {
    const [sequences] = await pool.query(
      'SELECT * FROM `order_sequence` WHERE `branch_id` = ?',
      [branch_id]
    );

    let nextNumber = 1;
    let seqId;

    if (sequences.length === 0) {
      seqId = generateId();
      const formattedNum = `${branch_code.toUpperCase()}-${String(nextNumber).padStart(6, '0')}`;
      await pool.query(
        'INSERT INTO `order_sequence` (id, created_date, updated_date, branch_id, branch_code, last_number, last_order_number) VALUES (?, NOW(), NOW(), ?, ?, ?, ?)',
        [seqId, branch_id, branch_code.toUpperCase(), nextNumber, formattedNum]
      );
    } else {
      const seq = sequences[0];
      seqId = seq.id;
      nextNumber = parseInt(seq.last_number || 0, 10) + 1;
      const formattedNum = `${branch_code.toUpperCase()}-${String(nextNumber).padStart(6, '0')}`;
      await pool.query(
        'UPDATE `order_sequence` SET `last_number` = ?, `last_order_number` = ?, `updated_date` = NOW() WHERE `id` = ?',
        [nextNumber, formattedNum, seqId]
      );
    }

    const finalOrderNumber = `${branch_code.toUpperCase()}-${String(nextNumber).padStart(6, '0')}`;
    return res.json({
      data: {
        order_number: finalOrderNumber
      }
    });
  } catch (err) {
    console.error('generateOrderNumber error:', err);
    return res.json({ data: { error: err.message } });
  }
});

module.exports = router;
