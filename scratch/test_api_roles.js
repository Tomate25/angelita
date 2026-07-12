const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

// Helper to make HTTP requests
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let body = data;
        if (res.headers['content-type']?.includes('application/json')) {
          try {
            body = JSON.parse(data);
          } catch (e) {
            // keep as text
          }
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function testHealth() {
  try {
    const res = await request('http://localhost:5000/health');
    console.log('Server is running! Health check response:', res.body);
    return true;
  } catch (err) {
    console.log('Server is not running or not responding:', err.message);
    return false;
  }
}

async function runTests() {
  const serverRunning = await testHealth();
  if (!serverRunning) {
    console.error('ERROR: Local server is not running on http://localhost:5000. Please start the server first.');
    process.exit(1);
  }

  console.log('\n--- 1. Login as Admin ---');
  let adminToken = '';
  try {
    const loginRes = await request(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: { username: 'admin', password: '123' }
    });
    console.log('Login Admin Status:', loginRes.statusCode);
    if (loginRes.statusCode === 200) {
      adminToken = loginRes.body.token;
      console.log('Admin Token acquired successfully.');
    } else {
      console.error('Failed to login as admin:', loginRes.body);
    }
  } catch (e) {
    console.error('Error during admin login:', e);
  }

  console.log('\n--- 2. Login as Vendor (cofradia) ---');
  let cofradiaToken = '';
  try {
    const loginRes = await request(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: { username: 'cofradia', password: '123' }
    });
    console.log('Login Cofradia Status:', loginRes.statusCode);
    if (loginRes.statusCode === 200) {
      cofradiaToken = loginRes.body.token;
      console.log('Cofradia Token acquired successfully.');
    } else {
      console.error('Failed to login as cofradia:', loginRes.body);
    }
  } catch (e) {
    console.error('Error during cofradia login:', e);
  }

  if (!adminToken || !cofradiaToken) {
    console.error('Could not obtain both tokens. Aborting test endpoints.');
    process.exit(1);
  }

  // Endpoints to test
  const testCases = [
    { name: 'GET /api/entities/user (List Users)', method: 'GET', path: '/entities/user' },
    { name: 'GET /api/entities/branch (List Branches)', method: 'GET', path: '/entities/branch' },
    { name: 'GET /api/entities/product (List Products)', method: 'GET', path: '/entities/product' },
    { name: 'GET /api/entities/order (List Orders)', method: 'GET', path: '/entities/order' },
    { name: 'POST /api/entities/user (Create User)', method: 'POST', path: '/entities/user', body: {
      username: 'temp_user_test',
      password: 'password123',
      role: 'vendedor_temp',
      full_name: 'Temporary User Test'
    }},
    { name: 'DELETE /api/entities/user/some-id (Delete User)', method: 'DELETE', path: '/entities/user/some-id' }
  ];

  console.log('\n--- 3. Testing Endpoint Access with Admin and Cofradia Tokens ---');
  
  for (const tc of testCases) {
    console.log(`\nTesting: ${tc.name}`);
    
    // Test with Admin
    try {
      const adminRes = await request(`${BASE_URL}${tc.path}`, {
        method: tc.method,
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: tc.body
      });
      console.log(`  Admin Response: Status ${adminRes.statusCode}`);
      // Print first 100 chars or summary of response
      console.log(`  Admin Body:`, typeof adminRes.body === 'object' ? JSON.stringify(adminRes.body).substring(0, 150) : String(adminRes.body).substring(0, 150));
    } catch (e) {
      console.error(`  Admin request failed:`, e.message);
    }

    // Test with Vendor (Cofradia)
    try {
      const vendorRes = await request(`${BASE_URL}${tc.path}`, {
        method: tc.method,
        headers: { 'Authorization': `Bearer ${cofradiaToken}` },
        body: tc.body
      });
      console.log(`  Vendor Response: Status ${vendorRes.statusCode}`);
      console.log(`  Vendor Body:`, typeof vendorRes.body === 'object' ? JSON.stringify(vendorRes.body).substring(0, 150) : String(vendorRes.body).substring(0, 150));
    } catch (e) {
      console.error(`  Vendor request failed:`, e.message);
    }
  }
}

runTests();
