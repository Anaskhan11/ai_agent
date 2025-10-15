const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function simpleTest() {
  try {
    console.log('🧪 Simple Audit Log Test...\n');
    
    const connection = await pool.getConnection();
    
    // Test 1: Check if audit_logs table exists and has data
    console.log('1️⃣ Checking audit_logs table...');
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM audit_logs');
    console.log(`   ✅ Found ${rows[0].count} audit log entries`);
    
    // Test 2: Get recent audit logs
    console.log('\n2️⃣ Getting recent audit logs...');
    const [recentLogs] = await connection.execute(
      'SELECT id, operation_type, table_name, user_email, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 5'
    );
    
    console.log(`   ✅ Retrieved ${recentLogs.length} recent logs:`);
    recentLogs.forEach(log => {
      console.log(`      ${log.id}: ${log.operation_type} on ${log.table_name} by ${log.user_email || 'Unknown'} at ${log.created_at}`);
    });
    
    // Test 3: Test the Logs directory
    console.log('\n3️⃣ Checking Logs directory...');
    const fs = require('fs-extra');
    const path = require('path');
    
    const logsDir = path.join(process.cwd(), 'Logs');
    const combinedFile = path.join(logsDir, 'combined.txt');
    
    if (await fs.pathExists(logsDir)) {
      console.log('   ✅ Logs directory exists');
      
      if (await fs.pathExists(combinedFile)) {
        console.log('   ✅ combined.txt exists');
        const content = await fs.readFile(combinedFile, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        console.log(`   📝 Combined.txt has ${lines.length} lines`);
      } else {
        console.log('   ⚠️ combined.txt does not exist');
      }
      
      // Check for date directories
      const items = await fs.readdir(logsDir);
      const dateDirs = items.filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item));
      console.log(`   📁 Found ${dateDirs.length} date directories: ${dateDirs.join(', ')}`);
    } else {
      console.log('   ❌ Logs directory does not exist');
    }
    
    connection.release();
    console.log('\n🎉 Simple test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

simpleTest();
