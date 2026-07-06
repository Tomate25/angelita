const express = require('express');
const jwt = require('jsonwebtoken');
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
    // Check password
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        username: user.username,
        branch_id: user.branch_id,
        branch_name: user.branch_name
      },
      JWT_SECRET,
      { expiresIn: '30d' } // Long-lived token for POS usage
    );

    // Return token and safe user details
    const { password: _, ...userWithoutPassword } = user;
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
    return res.json(userWithoutPassword);
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
