const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const [users] = await pool.query('SELECT * FROM `user` WHERE `username` = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    // Check password (supports bcrypt hash and legacy plain text)
    const isMatch = user.password.startsWith('$2a$') || user.password.startsWith('$2b$')
      ? await bcrypt.compare(password, user.password)
      : user.password === password;

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Auto-migrate legacy plain text passwords to hashed passwords
    if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('UPDATE `user` SET `password` = ? WHERE `id` = ?', [hashedPassword, user.id]);
        console.log(`Auto-migrated password to hash for user: ${user.username}`);
      } catch (err) {
        console.error('Failed to auto-migrate password hash:', err);
      }
    }

    // Generate JWT token
    let permissionsArray = [];
    if (user.permissions) {
      try {
        permissionsArray = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
      } catch (e) {
        permissionsArray = [];
      }
    } else if (user.role && user.role !== 'admin') {
      // Fallback: If no permissions are explicitly defined, use default branch permissions
      permissionsArray = ['pos', 'cash_register', 'orders', 'inventory', 'customers', 'ar', 'reports'];
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        username: user.username,
        branch_id: user.branch_id,
        branch_name: user.branch_name,
        permissions: permissionsArray
      },
      JWT_SECRET,
      { expiresIn: '30d' } // Long-lived token for POS usage
    );

    // Return token and safe user details
    const { password: _, ...userWithoutPassword } = user;
    if (userWithoutPassword.permissions && typeof userWithoutPassword.permissions === 'string') {
      try { userWithoutPassword.permissions = JSON.parse(userWithoutPassword.permissions); } catch(e) {}
    }
    return res.json({
      token,
      user: userWithoutPassword
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM `user` WHERE `id` = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const { password: _, ...userWithoutPassword } = user;
    if (userWithoutPassword.permissions && typeof userWithoutPassword.permissions === 'string') {
      try { userWithoutPassword.permissions = JSON.parse(userWithoutPassword.permissions); } catch(e) {}
    }
    return res.json(userWithoutPassword);
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  return res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
