const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure storage for local uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Route to handle file upload: POST /api/integrations/Core/UploadFile
router.post('/Core/UploadFile', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return relative path that can be served statically
    const fileUrl = `/uploads/${req.file.filename}`;
    return res.json({ file_url: fileUrl });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Failed to upload file', details: err.message });
  }
});

// Helper function to parse CSV simple rows
function parseCSV(content) {
  // Split lines by newline and clean carriage returns
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length < 2) return [];

  // Parse header
  // e.g. "nombre","sku","categoria","unidad","costo","precio_venta","precio_mayorista","precio_especial","stock_minimo","impuesto_pct"
  const parseRow = (row) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ''));
  const products = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]).map(v => v.replace(/['"]/g, ''));
    if (values.length === 0 || !values[0]) continue; // Skip empty name rows

    const product = {};
    headers.forEach((header, idx) => {
      const val = values[idx] || '';
      if (['costo', 'precio_venta', 'precio_mayorista', 'precio_especial', 'stock_minimo', 'impuesto_pct'].includes(header)) {
        product[header] = parseFloat(val) || 0;
      } else {
        product[header] = val;
      }
    });
    
    // Normalize properties to match what Settings.jsx expects
    const mappedProduct = {
      nombre: product.nombre || product.name || '',
      sku: product.sku || '',
      categoria: product.categoria || product.category || '',
      unidad: product.unidad || product.unit || 'unidad',
      costo: product.costo || product.cost || 0,
      precio_venta: product.precio_venta || product.price || 0,
      precio_mayorista: product.precio_mayorista || product.wholesale_price || 0,
      precio_especial: product.precio_especial || product.special_price || 0,
      stock_minimo: product.stock_minimo || product.min_stock || 0,
      impuesto_pct: product.impuesto_pct || product.tax_rate || 0
    };

    products.push(mappedProduct);
  }

  return products;
}

// Route to extract data: POST /api/integrations/Core/ExtractDataFromUploadedFile
router.post('/Core/ExtractDataFromUploadedFile', (req, res) => {
  const { file_url } = req.body || {};
  if (!file_url) {
    return res.status(400).json({ error: 'Missing file_url parameter' });
  }

  try {
    // Resolve local path from the file_url
    const filename = path.basename(file_url);
    const filePath = path.join(__dirname, '../uploads', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found locally' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const products = parseCSV(content);

    return res.json({
      output: {
        products: products
      }
    });
  } catch (err) {
    console.error('Data extraction error:', err);
    return res.status(500).json({ error: 'Failed to extract data', details: err.message });
  }
});

module.exports = router;
