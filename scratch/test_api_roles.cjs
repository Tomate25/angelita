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
      process.exit(1);
    }
  } catch (e) {
    console.error('Error during admin login:', e);
    process.exit(1);
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
      process.exit(1);
    }
  } catch (e) {
    console.error('Error during cofradia login:', e);
    process.exit(1);
  }

  // Endpoints to test with main accounts
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

  console.log('\n--- 4. Testing Granular Permissions via Database JSON array ---');
  console.log('Creating a restricted vendor with only ["pos", "orders"] permissions...');
  
  let restrictedToken = '';
  let createdRestrictedUser = null;
  
  try {
    // Unique username
    const uniqueUsername = `vendor_rest_${Date.now()}`;
    const createRes = await request(`${BASE_URL}/entities/user`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: {
        username: uniqueUsername,
        password: '123',
        role: 'vendedor_restringido',
        full_name: 'Restricted Vendor Test',
        permissions: ['pos', 'orders']
      }
    });
    
    if (createRes.statusCode === 201) {
      createdRestrictedUser = createRes.body;
      console.log(`Restricted vendor created successfully: ${uniqueUsername}`);
      
      // Let's log in as this restricted user
      console.log(`Logging in as ${uniqueUsername}...`);
      const loginRes = await request(`${BASE_URL}/auth/login`, {
        method: 'POST',
        body: { username: uniqueUsername, password: '123' }
      });
      
      if (loginRes.statusCode === 200) {
        restrictedToken = loginRes.body.token;
        console.log('Restricted Vendor Token acquired.');
      } else {
        console.error('Failed to log in as restricted vendor:', loginRes.body);
      }
    } else {
      console.error('Failed to create restricted vendor:', createRes.body);
    }
  } catch (e) {
    console.error('Error during restricted vendor creation/login:', e.message);
  }

  if (restrictedToken) {
    // 1. Should be allowed to read products (since 'pos' is a read permission for products)
    try {
      const res = await request(`${BASE_URL}/entities/product`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${restrictedToken}` }
      });
      console.log(`Testing GET /api/entities/product (Requires 'pos' or 'inventory'):`);
      console.log(`  Response: Status ${res.statusCode} (Expected: 200)`);
    } catch (e) {
      console.error('  Failed request:', e.message);
    }

    // 2. Should be allowed to read orders (since 'orders' is a read permission for orders)
    try {
      const res = await request(`${BASE_URL}/entities/order`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${restrictedToken}` }
      });
      console.log(`Testing GET /api/entities/order (Requires 'pos' or 'orders'):`);
      console.log(`  Response: Status ${res.statusCode} (Expected: 200)`);
    } catch (e) {
      console.error('  Failed request:', e.message);
    }

    // 3. Should NOT be allowed to read categories (requires 'inventory' permission, which is not granted)
    try {
      const res = await request(`${BASE_URL}/entities/category`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${restrictedToken}` }
      });
      console.log(`Testing GET /api/entities/category (Requires 'inventory' only):`);
      console.log(`  Response: Status ${res.statusCode} (Expected: 403)`);
      console.log(`  Body:`, JSON.stringify(res.body));
    } catch (e) {
      console.error('  Failed request:', e.message);
    }

    // Cleanup: Delete the restricted user using Admin token
    if (createdRestrictedUser && createdRestrictedUser.id) {
      console.log('\nCleaning up restricted vendor...');
      try {
        const delRes = await request(`${BASE_URL}/entities/user/${createdRestrictedUser.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        console.log(`Cleanup status: ${delRes.statusCode}`);
      } catch (e) {
        console.error('Cleanup failed:', e.message);
      }
    }
  }
}

runTests();
