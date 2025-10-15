const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');
const pool = require('../config/DBConnection');

async function testAuditCreation() {
  try {
    console.log('🧪 Testing Audit Log Creation...\n');
    
    // Test 1: Direct database insertion
    console.log('1️⃣ Testing direct database insertion...');
    
    const testData = {
      user_id: 1,
      user_email: 'test@example.com',
      user_name: 'Test User',
      operation_type: 'CREATE',
      table_name: 'test_table',
      record_id: '1',
      new_values: { test: 'direct_insert' },
      ip_address: '127.0.0.1',
      user_agent: 'Test Agent',
      request_method: 'POST',
      request_url: '/api/test',
      response_status: 200,
      metadata: { test: 'direct_creation' }
    };
    
    try {
      const directId = await AuditLogModel.createAuditLog(testData);
      console.log(`   ✅ Direct insertion successful! ID: ${directId}`);
    } catch (error) {
      console.log(`   ❌ Direct insertion failed:`, error.message);
    }
    
    // Test 2: Check if logs are being created
    console.log('\n2️⃣ Checking current audit log count...');
    
    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM audit_logs');
    console.log(`   📊 Total audit logs: ${countResult[0].total}`);
    
    if (countResult[0].total > 0) {
      // Get the most recent log
      const [recentLogs] = await pool.execute(`
        SELECT id, user_email, operation_type, table_name, created_at 
        FROM audit_logs 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      console.log(`\n   📋 Recent logs:`);
      recentLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. ID: ${log.id} | ${log.operation_type} | ${log.table_name} | ${log.user_email} | ${log.created_at}`);
      });
    }
    
    // Test 3: Test authentication log creation
    console.log('\n3️⃣ Testing authentication log creation...');
    
    const authTestData = {
      user_id: 999,
      user_email: 'auth.test@example.com',
      user_name: 'Auth Test User',
      operation_type: 'CREATE',
      table_name: 'auth_sessions',
      record_id: '999',
      old_values: null,
      new_values: {
        action: 'LOGIN',
        user_id: 999,
        user_email: 'auth.test@example.com',
        user_name: 'Auth Test User',
        timestamp: new Date().toISOString(),
        session_active: true,
        user_authenticated: true,
        browser: 'Test Browser',
        platform: 'Test Platform'
      },
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 (Test) Auth Test',
      request_method: 'POST',
      request_url: '/api/auth/login',
      response_status: 200,
      execution_time_ms: 150,
      metadata: {
        authentication_event: true,
        action: 'LOGIN',
        session_type: 'web',
        browser: 'Test Browser',
        platform: 'Test Platform'
      }
    };
    
    try {
      const authId = await AuditLogModel.createAuditLog(authTestData);
      console.log(`   ✅ Auth log creation successful! ID: ${authId}`);
    } catch (error) {
      console.log(`   ❌ Auth log creation failed:`, error.message);
    }
    
    // Test 4: Test the model's getAuditLogs function
    console.log('\n4️⃣ Testing audit log retrieval...');
    
    try {
      const result = await AuditLogModel.getAuditLogs({
        limit: 5,
        offset: 0,
        sort_by: 'created_at',
        sort_order: 'DESC'
      });
      
      console.log(`   ✅ Retrieval successful! Found ${result.data.length} logs`);
      console.log(`   📊 Total count: ${result.total}`);
      
      if (result.data.length > 0) {
        console.log(`\n   📋 Retrieved logs:`);
        result.data.forEach((log, index) => {
          console.log(`   ${index + 1}. ID: ${log.id} | ${log.display_operation || log.operation_type} | ${log.table_name} | ${log.user_email}`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Retrieval failed:`, error.message);
    }
    
    // Test 5: Check database connection
    console.log('\n5️⃣ Testing database connection...');
    
    try {
      const [connectionTest] = await pool.execute('SELECT 1 as test');
      console.log(`   ✅ Database connection working! Test result: ${connectionTest[0].test}`);
    } catch (error) {
      console.log(`   ❌ Database connection failed:`, error.message);
    }
    
    // Test 6: Check table permissions
    console.log('\n6️⃣ Testing table permissions...');
    
    try {
      const [permissionTest] = await pool.execute('SELECT COUNT(*) as count FROM audit_logs LIMIT 1');
      console.log(`   ✅ Table read permission working!`);
      
      // Try a simple insert
      await pool.execute(`
        INSERT INTO audit_logs (operation_type, table_name, record_id, created_at) 
        VALUES ('CREATE', 'permission_test', 'test', NOW())
      `);
      console.log(`   ✅ Table write permission working!`);
      
      // Clean up the test record
      await pool.execute(`DELETE FROM audit_logs WHERE table_name = 'permission_test'`);
      
    } catch (error) {
      console.log(`   ❌ Table permission issue:`, error.message);
    }
    
    // Final summary
    console.log('\n📋 Summary:');
    const [finalCount] = await pool.execute('SELECT COUNT(*) as total FROM audit_logs');
    console.log(`   📊 Final audit log count: ${finalCount[0].total}`);
    
    if (finalCount[0].total === 0) {
      console.log('\n❌ ISSUE IDENTIFIED: Audit logs are not being created!');
      console.log('🔧 Possible causes:');
      console.log('   1. AuditLogModel.createAuditLog() function has bugs');
      console.log('   2. Database connection issues');
      console.log('   3. Table permission problems');
      console.log('   4. Frontend audit log calls are failing silently');
      console.log('   5. Middleware is not being triggered');
    } else {
      console.log('\n✅ Audit log creation is working!');
      console.log('💡 The issue might be:');
      console.log('   1. Frontend not calling the audit log API');
      console.log('   2. Middleware skip patterns too broad');
      console.log('   3. Authentication flow not triggering audit logs');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testAuditCreation();
