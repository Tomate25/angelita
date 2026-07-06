const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

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

const JSON_FIELDS = ['items', 'approver_emails'];
const BOOLEAN_FIELDS = [
  'is_warehouse',
  'is_active',
  'applied',
  'is_favorite',
  'can_transform',
  'sent_to_collection'
];

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
router.get('/:entityName', authenticateToken, async (req, res) => {
  try {
    let sql = `SELECT * FROM \`${req.tableName}\``;
    const conditions = [];
    const params = [];

    // Extract filters
    for (const [key, val] of Object.entries(req.query)) {
      if (['limit', 'offset', 'orderBy', 'orderDirection', '_limit', '_offset', '_sort', '_order'].includes(key)) {
        continue;
      }
      conditions.push(`\`${key}\` = ?`);
      params.push(normalizeVal(val));
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Sorting
    const orderBy = req.query._sort || req.query.orderBy;
    const orderDir = (req.query._order || req.query.orderDirection || 'ASC').toUpperCase();
    if (orderBy) {
      const finalDir = ['ASC', 'DESC'].includes(orderDir) ? orderDir : 'ASC';
      sql += ` ORDER BY \`${orderBy}\` ${finalDir}`;
    }

    // Limit and Offset
    const limit = parseInt(req.query._limit || req.query.limit, 10);
    const offset = parseInt(req.query._offset || req.query.offset, 10);

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
router.get('/:entityName/:id', authenticateToken, async (req, res) => {
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
router.post('/:entityName', authenticateToken, async (req, res) => {
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
router.put('/:entityName/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const record = { ...req.body };
  record.updated_date = new Date();
  delete record.id; // Prevent updating PK

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
router.delete('/:entityName/:id', authenticateToken, async (req, res) => {
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
router.post('/:entityName/filter', authenticateToken, async (req, res) => {
  try {
    let sql = `SELECT * FROM \`${req.tableName}\``;
    const conditions = [];
    const params = [];
    let orderBy = null;
    let orderDir = 'ASC';
    let limit = null;
    let offset = null;

    // Parse body for filters and control keys
    for (const [key, val] of Object.entries(req.body || {})) {
      if (key === '_sort' || key === 'orderBy') {
        orderBy = val;
      } else if (key === '_order' || key === 'orderDirection') {
        orderDir = val;
      } else if (key === '_limit' || key === 'limit') {
        limit = parseInt(val, 10);
      } else if (key === '_offset' || key === 'offset') {
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
