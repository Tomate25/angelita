const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'angelitas-jwt-secret-key-2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

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

function checkEntityPermission(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
  }

  // Admin bypass
  if (user.role === 'admin') {
    return next();
  }

  // Get user permissions
  let permissions = [];
  if (Array.isArray(user.permissions)) {
    permissions = user.permissions;
  } else if (user.role) {
    // Fallback: If no permissions are explicitly defined, use default branch permissions
    permissions = ['pos', 'cash_register', 'orders', 'inventory', 'customers', 'ar', 'reports'];
  }

  const entityName = req.params.entityName;
  if (!entityName) {
    return next(); // If no entityName param, skip (handled by other routes)
  }

  const table = req.tableName || entityToTable(entityName);
  const method = req.method;

  // Define entity permissions mapping
  const mapping = {
    'user': {
      read: ['admin_only'],
      write: ['admin_only']
    },
    'branch': {
      read: ['inventory', 'pos'],
      write: ['admin_only']
    },
    'product': {
      read: ['inventory', 'pos'],
      write: ['admin_only']
    },
    'category': {
      read: ['inventory'],
      write: ['admin_only']
    },
    'purchase': {
      read: ['admin_only'],
      write: ['admin_only']
    },
    'supplier': {
      read: ['admin_only'],
      write: ['admin_only']
    },
    'supplier_invoice': {
      read: ['admin_only'],
      write: ['admin_only']
    },
    'supplier_payment': {
      read: ['admin_only'],
      write: ['admin_only']
    },
    'order': {
      read: ['orders', 'pos'],
      write: ['orders', 'pos'],
      delete: ['admin_only']
    },
    'order_sequence': {
      read: ['orders', 'pos'],
      write: ['orders', 'pos']
    },
    'cash_register': {
      read: ['cash_register'],
      write: ['cash_register'],
      delete: ['admin_only']
    },
    'inventory': {
      read: ['inventory'],
      write: ['inventory'],
      delete: ['admin_only']
    },
    'inventory_movement': {
      read: ['inventory'],
      write: ['inventory'],
      delete: ['admin_only']
    },
    'transfer': {
      read: ['inventory'],
      write: ['inventory'],
      delete: ['admin_only']
    },
    'customer': {
      read: ['customers'],
      write: ['customers'],
      delete: ['admin_only']
    },
    'account_receivable': {
      read: ['ar'],
      write: ['ar'],
      delete: ['admin_only']
    },
    'a_r_payment': {
      read: ['ar'],
      write: ['ar'],
      delete: ['admin_only']
    }
  };

  const rule = mapping[table];
  if (!rule) {
    // Protect unmapped tables by default
    return res.status(403).json({ error: `Forbidden: Admin access required for entity ${table}` });
  }

  let requiredPermissions = [];
  if (method === 'GET') {
    requiredPermissions = rule.read;
  } else if (method === 'DELETE') {
    requiredPermissions = rule.delete || rule.write;
  } else {
    // POST, PUT
    requiredPermissions = rule.write;
  }

  const hasAccess = requiredPermissions.some(perm => permissions.includes(perm));
  if (!hasAccess) {
    return res.status(403).json({ error: `Forbidden: You do not have permission to perform ${method} on ${table}` });
  }

  next();
}

module.exports = {
  authenticateToken,
  checkEntityPermission,
  JWT_SECRET
};
