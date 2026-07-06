const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'angelitas_pos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function query(sql, params) {
  const [results] = await pool.execute(sql, params);
  return results;
}

// Function to initialize database and tables (migrations/seeding)
async function initializeDatabase() {
  try {
    console.log('Initializing database schema & seeds...');

    // 1. Check if username and password columns exist in the user table
    const [columns] = await pool.query('DESCRIBE `user`');
    const hasUsername = columns.some(c => c.Field === 'username');
    const hasPassword = columns.some(c => c.Field === 'password');

    if (!hasUsername) {
      console.log('Adding column username to user table...');
      await pool.query('ALTER TABLE `user` ADD COLUMN `username` VARCHAR(255) NULL');
    }
    if (!hasPassword) {
      console.log('Adding column password to user table...');
      await pool.query('ALTER TABLE `user` ADD COLUMN `password` VARCHAR(255) NULL');
    }

    // 2. Check if the user table is empty, and seed default users
    const [users] = await pool.query('SELECT * FROM `user`');
    if (users.length === 0) {
      console.log('Seeding default users...');
      
      const defaultUsers = [
        {
          id: 'user-admin-id',
          role: 'admin',
          branch_id: null,
          branch_name: null,
          username: 'admin',
          password: '123'
        },
        {
          id: 'user-granada-id',
          role: 'granada',
          branch_id: '6a0b8b9458fa22a7efce711e',
          branch_name: 'Granada',
          username: 'granada',
          password: '123'
        },
        {
          id: 'user-cofradia-id',
          role: 'cofradia',
          branch_id: '6a0b8b9458fa22a7efce711f',
          branch_name: 'Cofradia',
          username: 'cofradia',
          password: '123'
        },
        {
          id: 'user-prefaconsa-id',
          role: 'prefaconsa',
          branch_id: '6a0b8b9458fa22a7efce711g',
          branch_name: 'Prefaconsa',
          username: 'prefaconsa',
          password: '123'
        }
      ];

      for (const u of defaultUsers) {
        await pool.query(
          'INSERT INTO `user` (id, created_date, updated_date, role, branch_id, branch_name, username, password) VALUES (?, NOW(), NOW(), ?, ?, ?, ?, ?)',
          [u.id, u.role, u.branch_id, u.branch_name, u.username, u.password]
        );
      }
      console.log('Seeded default users successfully!');
    } else {
      console.log('User table already contains data. Skipping seed.');
    }
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

module.exports = {
  pool,
  query,
  initializeDatabase
};
