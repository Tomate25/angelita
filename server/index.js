const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
require('dotenv').config();
const { initializeDatabase } = require('./db');
const authRouter = require('./routes/auth');
const { router: entitiesRouter } = require('./routes/entities');
const functionsRouter = require('./routes/functions');
const integrationsRouter = require('./routes/integrations');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// Compress responses
app.use(compression());

// Enable CORS
app.use(cors({
  origin: '*', // Adjust to match your React client origin in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Disable caching for all API routes (prevents browsers from caching auth sessions and tables)
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Parse JSON request bodies
app.use(express.json({ limit: '50mb' })); // Support large payloads e.g. bulk initializations

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/functions', functionsRouter);
app.use('/api/integrations', integrationsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Initialize database and start the server
async function startServer() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Angelitas POS Backend Server running on port ${PORT}`);
    console.log(`👉 Health check: http://localhost:${PORT}/health`);
    console.log(`🔒 Authentication: http://localhost:${PORT}/api/auth`);
    console.log(`📁 Entities CRUD:  http://localhost:${PORT}/api/entities`);
    console.log(`⚡ Deno Functions: http://localhost:${PORT}/api/functions`);
    console.log(`==================================================`);
  });
}

startServer();
