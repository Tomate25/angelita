const { pool } = require('../server/db');

async function run() {
  try {
    const [users] = await pool.query('SELECT id, username, role, permissions FROM `user`');
    console.log('--- USER DATA ---');
    users.forEach(u => {
      console.log(`User: ${u.username}`);
      console.log(`  Role: ${u.role}`);
      console.log(`  Permissions (raw): ${u.permissions}`);
      try {
        console.log(`  Permissions (parsed):`, JSON.parse(u.permissions));
      } catch (e) {
        console.log(`  Permissions (not JSON or null)`);
      }
      console.log('-----------------');
    });
    
    // Also let's inspect branches to see what's in there
    const [branches] = await pool.query('SELECT id, name, code FROM `branch`');
    console.log('\n--- BRANCH DATA ---');
    branches.forEach(b => {
      console.log(`Branch: ${b.name} (${b.code}) - ID: ${b.id}`);
    });
    
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await pool.end();
  }
}

run();
