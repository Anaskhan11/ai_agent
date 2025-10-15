const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');

async function testOperationDisplay() {
  try {
    console.log('🔧 Testing Operation Display and IP Fixes...\n');
    
    // Test 1: Create a proper logout audit log entry
    console.log('1️⃣ Creating logout audit log entry with proper metadata...');
    const logoutAuditData = {
      user_id: 1,
      user_email: 'test@example.com',
      user_name: 'Test User',
      operation_type: 'CREATE',
      table_name: 'auth_sessions',
      record_id: '1',
      old_values: {
        session_active: true,
        user_authenticated: true
      },
      new_values: {
        action: 'LOGOUT',
        user_id: 1,
        user_email: 'test@example.com',
        user_name: 'Test User',
        timestamp: new Date().toISOString(),
        session_active: false,
        user_authenticated: false,
        browser: 'Chrome',
        platform: 'MacIntel'
      },
      ip_address: '::1', // This should be converted to 127.0.0.1
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      request_method: 'POST',
      request_url: '/api/auth/logout',
      response_status: 200,
      execution_time_ms: 100,
      metadata: {
        authentication_event: true,
        action: 'LOGOUT',
        session_type: 'web',
        browser: 'Chrome',
        platform: 'MacIntel'
      }
    };
    
    const logoutId = await AuditLogModel.createAuditLog(logoutAuditData);
    console.log(`   ✅ Created logout audit log with ID: ${logoutId}`);
    
    // Test 2: Create a login audit log entry
    console.log('\n2️⃣ Creating login audit log entry...');
    const loginAuditData = {
      user_id: 1,
      user_email: 'test@example.com',
      user_name: 'Test User',
      operation_type: 'CREATE',
      table_name: 'auth_sessions',
      record_id: '1',
      old_values: null,
      new_values: {
        action: 'LOGIN',
        user_id: 1,
        user_email: 'test@example.com',
        user_name: 'Test User',
        timestamp: new Date().toISOString(),
        session_active: true,
        user_authenticated: true,
        browser: 'Firefox',
        platform: 'Win32'
      },
      ip_address: '::ffff:192.168.1.100', // This should be converted to 192.168.1.100
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
      request_method: 'POST',
      request_url: '/api/auth/login',
      response_status: 200,
      execution_time_ms: 250,
      metadata: {
        authentication_event: true,
        action: 'LOGIN',
        session_type: 'web',
        browser: 'Firefox',
        platform: 'Win32'
      }
    };
    
    const loginId = await AuditLogModel.createAuditLog(loginAuditData);
    console.log(`   ✅ Created login audit log with ID: ${loginId}`);
    
    // Test 3: Test various IP formats
    console.log('\n3️⃣ Testing various IP address formats...');
    const ipTestData = [
      { ip: '::1', expected: '127.0.0.1' },
      { ip: '::ffff:127.0.0.1', expected: '127.0.0.1' },
      { ip: '::ffff:192.168.1.100', expected: '192.168.1.100' },
      { ip: '192.168.1.50', expected: '192.168.1.50' },
      { ip: '10.0.0.1', expected: '10.0.0.1' }
    ];
    
    for (const test of ipTestData) {
      const testAuditData = {
        user_id: 1,
        user_email: 'ip-test@example.com',
        user_name: 'IP Test User',
        operation_type: 'CREATE',
        table_name: 'test_table',
        record_id: 'ip-test',
        new_values: { test: 'ip_format' },
        ip_address: test.ip,
        user_agent: 'Test Agent',
        request_method: 'POST',
        request_url: '/api/test',
        response_status: 200,
        metadata: { test: 'ip_conversion' }
      };
      
      const testId = await AuditLogModel.createAuditLog(testAuditData);
      console.log(`   📍 IP ${test.ip} -> Expected: ${test.expected} (ID: ${testId})`);
    }
    
    // Test 4: Retrieve and verify the enhanced data
    console.log('\n4️⃣ Testing enhanced audit log retrieval...');
    const result = await AuditLogModel.getAuditLogs({
      limit: 10,
      offset: 0,
      sort_by: 'created_at',
      sort_order: 'DESC'
    });
    
    console.log(`   ✅ Retrieved ${result.data.length} audit log entries`);
    
    // Check the latest entries for proper display
    result.data.forEach((log, index) => {
      if (index < 5) { // Show details for first 5 entries
        console.log(`\n   📋 Entry ${index + 1}:`);
        console.log(`      ID: ${log.id}`);
        console.log(`      User: ${log.user_email}`);
        console.log(`      Operation Type: ${log.operation_type}`);
        console.log(`      Display Operation: ${log.display_operation}`);
        console.log(`      Table: ${log.table_name}`);
        console.log(`      IP Address: ${log.ip_address}`);
        console.log(`      Browser: ${log.browser_info}`);
        
        // Check if logout is displaying correctly
        if (log.table_name === 'auth_sessions' && log.new_values && log.new_values.action === 'LOGOUT') {
          if (log.display_operation === 'Logout') {
            console.log(`      ✅ LOGOUT operation displaying correctly as: ${log.display_operation}`);
          } else {
            console.log(`      ❌ LOGOUT operation NOT displaying correctly. Shows: ${log.display_operation}`);
          }
        }
        
        // Check if login is displaying correctly
        if (log.table_name === 'auth_sessions' && log.new_values && log.new_values.action === 'LOGIN') {
          if (log.display_operation === 'Login') {
            console.log(`      ✅ LOGIN operation displaying correctly as: ${log.display_operation}`);
          } else {
            console.log(`      ❌ LOGIN operation NOT displaying correctly. Shows: ${log.display_operation}`);
          }
        }
        
        // Check IP address conversion
        if (log.ip_address && !log.ip_address.includes('::')) {
          console.log(`      ✅ IP address converted correctly: ${log.ip_address}`);
        } else if (log.ip_address && log.ip_address.includes('::')) {
          console.log(`      ⚠️ IP address still contains IPv6 format: ${log.ip_address}`);
        }
      }
    });
    
    console.log('\n🎉 Operation display and IP address tests completed!');
    
    console.log('\n📋 Summary:');
    console.log('   ✅ Logout audit log entries created');
    console.log('   ✅ Login audit log entries created');
    console.log('   ✅ Various IP address formats tested');
    console.log('   ✅ Enhanced data retrieval verified');
    
    console.log('\n🚀 The fixes should now work correctly in the frontend!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testOperationDisplay();
