const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { authenticateToken, checkEntityPermission } = require('../middleware/auth');

const router = express.Router();

// 18 tables in MySQL
const VALID_TABLES = new Set([
  'a_r_payment',
  'account_receivable',
  'branch',
  'cash_register',
  'category',
  'customer',
  'inventory',
  'inventory_movement',
  'order',
  'order_sequence',
  'product',
  'product_price_schedule',
  'purchase',
  'supplier',
  'supplier_invoice',
  'supplier_payment',
  'transfer',
  'user'
]);

// Entity name to table name mapping
function entityToTable(entityName) {
  const mapping = {
    'arpayment': 'a_r_payment',
    'accountreceivable': 'account_receivable',
    'branch': 'branch',
    'cashregister': 'cash_register',
    'category': 'category',
    'customer': 'customer',
    'inventory': 'inventory',
    'inventorymovement': 'inventory_movement',
    'order': 'order',
    'ordersequence': 'order_sequence',
    'product': 'product',
    'productpriceschedule': 'product_price_schedule',
    'purchase': 'purchase',
    'supplier': 'supplier',
    'supplierinvoice': 'supplier_invoice',
    'supplierpayment': 'supplier_payment',
    'transfer': 'transfer',
    'user': 'user'
  };
  const key = entityName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return mapping[key] || entityName;
}

const JSON_FIELDS = ['items', 'approver_emails', 'permissions'];
const BOOLEAN_FIELDS = [
  'is_warehouse',
  'is_active',
  'applied',
  'is_favorite',
  'can_transform',
  'sent_to_collection'
];

const NUMBER_FIELDS = new Set([
  'original_amount', 'balance', 'amount', 'opening_amount', 
  'cash_sales', 'card_sales', 'transfer_sales', 'credit_sales', 
  'total_sales', 'total_orders', 'cash_in', 'cash_out', 
  'expected_cash', 'actual_cash', 'difference', 'sort_order', 
  'credit_limit', 'credit_days', 'quantity', 'avg_cost', 
  'total_value', 'unit_cost', 'previous_stock', 'new_stock', 
  'subtotal', 'discount_total', 'tax_total', 'total', 
  'amount_paid', 'change_amount', 'last_number', 'cost', 
  'price', 'wholesale_price', 'special_price', 'min_stock', 
  'tax_rate', 'transform_quantity', 'new_price', 'new_wholesale_price', 
  'new_special_price', 'new_cost', 'tax_amount'
]);

// Helper to serialize database rows into JS objects
function serializeRow(row) {
  if (!row) return row;
  const newRow = { ...row };
  for (const field of JSON_FIELDS) {
    if (newRow[field] !== undefined && newRow[field] !== null) {
      if (typeof newRow[field] === 'string') {
        try {
          newRow[field] = JSON.parse(newRow[field]);
        } catch (e) {
          // Keep as string if it fails to parse
        }
      }
    }
  }
  for (const field of BOOLEAN_FIELDS) {
    if (newRow[field] !== undefined && newRow[field] !== null) {
      newRow[field] = Boolean(newRow[field]);
    }
  }
  for (const key of Object.keys(newRow)) {
    if (NUMBER_FIELDS.has(key) && newRow[key] !== undefined && newRow[key] !== null) {
      newRow[key] = Number(newRow[key]);
    }
  }
  return newRow;
}

// Helper to serialize JS objects into MySQL-friendly values
function deserializeRowForDB(row) {
  if (!row) return row;
  const newRow = { ...row };
  for (const field of JSON_FIELDS) {
    if (newRow[field] !== undefined && newRow[field] !== null) {
      if (typeof newRow[field] !== 'string') {
        newRow[field] = JSON.stringify(newRow[field]);
      }
    }
  }
  for (const field of BOOLEAN_FIELDS) {
    if (newRow[field] !== undefined && newRow[field] !== null) {
      newRow[field] = newRow[field] ? 1 : 0;
    }
  }
  return newRow;
}

// Helper to normalize value types (converting boolean strings to numbers)
function normalizeVal(val) {
  if (val === 'true') return 1;
  if (val === 'false') return 0;
  return val;
}

function generateId() {
  return crypto.randomBytes(12).toString('hex'); // 24-character hex string
}

// Middleware to validate entity name
router.use('/:entityName', (req, res, next) => {
  const table = entityToTable(req.params.entityName);
  if (!VALID_TABLES.has(table)) {
    return res.status(400).json({ error: `Invalid entity name: ${req.params.entityName}` });
  }
  req.tableName = table;
  next();
});

// GET /api/entities/:entityName (supports filtering, sorting, limiting)
router.get('/:entityName', authenticateToken, checkEntityPermission, async (req, res) => {
  try {
    let sql = `SELECT * FROM \`${req.tableName}\``;
    const conditions = [];
    const params = [];

    // Server-side branch scoping for non-admin users
    // If the user has a branch_id in their token, automatically filter branch-scoped tables
    const BRANCH_SCOPED_TABLES = new Set([
      'order', 'cash_register', 'account_receivable', 'a_r_payment',
      'inventory', 'inventory_movement', 'transfer'
    ]);
    const userBranchId = req.user?.branch_id;
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin && userBranchId && BRANCH_SCOPED_TABLES.has(req.tableName)) {
      // Only inject if the client hasn't already passed a branch_id filter
      if (!Object.prototype.hasOwnProperty.call(req.query, 'branch_id')) {
        conditions.push('`branch_id` = ?');
        params.push(userBranchId);
      }
    }

    // Extract filters
    for (const [key, val] of Object.entries(req.query)) {
      if (['limit', 'offset', 'orderBy', 'orderDirection', '_limit', '_offset', '_sort', '_order', 'sort', 'skip'].includes(key)) {
        continue;
      }
      conditions.push(`\`${key}\` = ?`);
      params.push(normalizeVal(val));
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Sorting
    let orderBy = req.query._sort || req.query.orderBy || req.query.sort;
    let orderDir = (req.query._order || req.query.orderDirection || 'ASC').toUpperCase();
    if (orderBy) {
      if (typeof orderBy === 'string' && orderBy.startsWith('-')) {
        orderDir = 'DESC';
        orderBy = orderBy.substring(1);
      }
      const finalDir = ['ASC', 'DESC'].includes(orderDir) ? orderDir : 'ASC';
      sql += ` ORDER BY \`${orderBy}\` ${finalDir}`;
    }

    // Limit and Offset
    const limit = parseInt(req.query._limit || req.query.limit, 10);
    const offset = parseInt(req.query._offset || req.query.offset || req.query.skip, 10);

    if (!isNaN(limit)) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    if (!isNaN(offset)) {
      if (isNaN(limit)) {
        sql += ` LIMIT 18446744073709551615`;
      }
      sql += ` OFFSET ?`;
      params.push(offset);
    }

    const [rows] = await pool.query(sql, params);
    return res.json(rows.map(serializeRow));
  } catch (err) {
    console.error(`Error fetching entities for ${req.tableName}:`, err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/entities/:entityName/:id
router.get('/:entityName/:id', authenticateToken, checkEntityPermission, async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${req.tableName}\` WHERE \`id\` = ?`, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    return res.json(serializeRow(rows[0]));
  } catch (err) {
    console.error(`Error fetching entity ${req.params.id} for ${req.tableName}:`, err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/entities/:entityName
router.post('/:entityName', authenticateToken, checkEntityPermission, async (req, res) => {
  const body = req.body;

  try {
    if (Array.isArray(body)) {
      // Bulk create
      const inserted = [];
      for (const item of body) {
        const record = { ...item };
        if (!record.id) {
          record.id = generateId();
        }
        record.created_date = record.created_date ? new Date(record.created_date) : new Date();
        record.updated_date = record.updated_date ? new Date(record.updated_date) : new Date();

        if (req.tableName === 'user' && record.password) {
          if (!record.password.startsWith('$2a$') && !record.password.startsWith('$2b$')) {
            record.password = await bcrypt.hash(record.password, 10);
          }
        }

        const dbRow = deserializeRowForDB(record);
        const keys = Object.keys(dbRow);
        const placeholders = keys.map(() => '?').join(', ');
        const values = Object.values(dbRow);

        await pool.query(
          `INSERT INTO \`${req.tableName}\` (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`,
          values
        );
        inserted.push(record);
      }
      return res.status(201).json(inserted);
    } else {
      // Single create
      const record = { ...body };
      if (!record.id) {
        record.id = generateId();
      }
      record.created_date = record.created_date ? new Date(record.created_date) : new Date();
      record.updated_date = record.updated_date ? new Date(record.updated_date) : new Date();

      if (req.tableName === 'user' && record.password) {
        if (!record.password.startsWith('$2a$') && !record.password.startsWith('$2b$')) {
          record.password = await bcrypt.hash(record.password, 10);
        }
      }

      const dbRow = deserializeRowForDB(record);
      const keys = Object.keys(dbRow);
      const placeholders = keys.map(() => '?').join(', ');
      const values = Object.values(dbRow);

      await pool.query(
        `INSERT INTO \`${req.tableName}\` (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`,
        values
      );
      return res.status(201).json(record);
    }
  } catch (err) {
    console.error(`Error creating entity for ${req.tableName}:`, err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// PUT /api/entities/:entityName/:id
router.put('/:entityName/:id', authenticateToken, checkEntityPermission, async (req, res) => {
  const { id } = req.params;
  const record = { ...req.body };
  record.updated_date = new Date();
  delete record.id; // Prevent updating PK

  if (req.tableName === 'user' && record.password) {
    if (!record.password.startsWith('$2a$') && !record.password.startsWith('$2b$')) {
      record.password = await bcrypt.hash(record.password, 10);
    }
  }

  try {
    const dbRow = deserializeRowForDB(record);
    const keys = Object.keys(dbRow);
    
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = keys.map(k => `\`${k}\` = ?`).join(', ');
    const values = Object.values(dbRow);

    const [result] = await pool.query(
      `UPDATE \`${req.tableName}\` SET ${setClause} WHERE \`id\` = ?`,
      [...values, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const [rows] = await pool.query(`SELECT * FROM \`${req.tableName}\` WHERE \`id\` = ?`, [id]);
    return res.json(serializeRow(rows[0]));
  } catch (err) {
    console.error(`Error updating entity ${id} for ${req.tableName}:`, err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// DELETE /api/entities/:entityName/:id
router.delete('/:entityName/:id', authenticateToken, checkEntityPermission, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(`DELETE FROM \`${req.tableName}\` WHERE \`id\` = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    return res.json({ success: true, message: 'Record deleted successfully' });
  } catch (err) {
    console.error(`Error deleting entity ${id} for ${req.tableName}:`, err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// POST /api/entities/:entityName/filter (custom filters)
router.post('/:entityName/filter', authenticateToken, checkEntityPermission, async (req, res) => {
  try {
    let sql = `SELECT * FROM \`${req.tableName}\``;
    const conditions = [];
    const params = [];
    let orderBy = null;
    let orderDir = 'ASC';
    let limit = null;
    let offset = null;

    // Server-side branch scoping for non-admin users
    const BRANCH_SCOPED_TABLES = new Set([
      'order', 'cash_register', 'account_receivable', 'a_r_payment',
      'inventory', 'inventory_movement', 'transfer'
    ]);
    const userBranchId = req.user?.branch_id;
    const isAdmin = req.user?.role === 'admin';

    const bodyKeys = Object.keys(req.body || {});
    if (!isAdmin && userBranchId && BRANCH_SCOPED_TABLES.has(req.tableName)) {
      if (!bodyKeys.includes('branch_id')) {
        conditions.push('`branch_id` = ?');
        params.push(userBranchId);
      }
    }

    // Parse body for filters and control keys
    for (const [key, val] of Object.entries(req.body || {})) {
      if (key === '_sort' || key === 'orderBy' || key === 'sort') {
        orderBy = val;
      } else if (key === '_order' || key === 'orderDirection') {
        orderDir = val;
      } else if (key === '_limit' || key === 'limit') {
        limit = parseInt(val, 10);
      } else if (key === '_offset' || key === 'offset' || key === 'skip') {
        offset = parseInt(val, 10);
      } else {
        conditions.push(`\`${key}\` = ?`);
        params.push(normalizeVal(val));
      }
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (orderBy) {
      if (typeof orderBy === 'string' && orderBy.startsWith('-')) {
        orderDir = 'DESC';
        orderBy = orderBy.substring(1);
      }
      const finalDir = ['ASC', 'DESC'].includes(orderDir.toUpperCase()) ? orderDir.toUpperCase() : 'ASC';
      sql += ` ORDER BY \`${orderBy}\` ${finalDir}`;
    }

    if (limit !== null && !isNaN(limit)) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    if (offset !== null && !isNaN(offset)) {
      if (limit === null) {
        sql += ` LIMIT 18446744073709551615`;
      }
      sql += ` OFFSET ?`;
      params.push(offset);
    }

    const [rows] = await pool.query(sql, params);
    return res.json(rows.map(serializeRow));
  } catch (err) {
    console.error(`Error filtering entities for ${req.tableName}:`, err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = {
  router,
  serializeRow,
  deserializeRowForDB,
  entityToTable,
  generateId
};
