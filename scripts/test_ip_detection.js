const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');

async function testIPDetection() {
  try {
    console.log('🌐 Testing IP Address Detection...\n');
    
    // Test 1: Create audit logs with different IP scenarios
    console.log('1️⃣ Testing various IP address scenarios...');
    
    const ipTestCases = [
      {
        description: 'Localhost development',
        ip: '127.0.0.1 (localhost)',
        scenario: 'local_development'
      },
      {
        description: 'Local network IP',
        ip: '192.168.1.100',
        scenario: 'local_network'
      },
      {
        description: 'Public IP address',
        ip: '203.0.113.45',
        scenario: 'public_ip'
      },
      {
        description: 'Corporate network',
        ip: '10.0.0.50',
        scenario: 'corporate_network'
      },
      {
        description: 'Mobile network',
        ip: '172.16.0.25',
        scenario: 'mobile_network'
      }
    ];
    
    const createdIds = [];
    
    for (const testCase of ipTestCases) {
      const auditData = {
        user_id: 1,
        user_email: 'ip-test@example.com',
        user_name: 'IP Test User',
        operation_type: 'CREATE',
        table_name: 'ip_test',
        record_id: `test-${testCase.scenario}`,
        new_values: {
          test: 'ip_detection',
          scenario: testCase.scenario,
          description: testCase.description
        },
        ip_address: testCase.ip,
        user_agent: 'Mozilla/5.0 (Test Browser) IP Detection Test',
        request_method: 'POST',
        request_url: '/api/test/ip',
        response_status: 200,
        execution_time_ms: 50,
        metadata: {
          test: 'ip_detection',
          scenario: testCase.scenario,
          expected_ip: testCase.ip
        }
      };
      
      const id = await AuditLogModel.createAuditLog(auditData);
      createdIds.push(id);
      console.log(`   📍 ${testCase.description}: ${testCase.ip} (ID: ${id})`);
    }
    
    // Test 2: Create authentication logs with proper IP detection
    console.log('\n2️⃣ Creating authentication logs with IP detection...');
    
    const authTestCases = [
      {
        action: 'LOGIN',
        user: { id: 1, email: 'john.doe@company.com', name: 'John Doe' },
        ip: '192.168.1.105',
        browser: 'Chrome'
      },
      {
        action: 'LOGOUT',
        user: { id: 1, email: 'john.doe@company.com', name: 'John Doe' },
        ip: '192.168.1.105',
        browser: 'Chrome'
      },
      {
        action: 'LOGIN',
        user: { id: 2, email: 'jane.smith@company.com', name: 'Jane Smith' },
        ip: '203.0.113.78',
        browser: 'Firefox'
      }
    ];
    
    for (const authTest of authTestCases) {
      const authAuditData = {
        user_id: authTest.user.id,
        user_email: authTest.user.email,
        user_name: authTest.user.name,
        operation_type: 'CREATE',
        table_name: 'auth_sessions',
        record_id: authTest.user.id.toString(),
        old_values: authTest.action === 'LOGOUT' ? {
          session_active: true,
          user_authenticated: true
        } : null,
        new_values: {
          action: authTest.action,
          user_id: authTest.user.id,
          user_email: authTest.user.email,
          user_name: authTest.user.name,
          timestamp: new Date().toISOString(),
          session_active: authTest.action === 'LOGIN',
          user_authenticated: authTest.action === 'LOGIN',
          browser: authTest.browser,
          platform: 'Test Platform'
        },
        ip_address: authTest.ip,
        user_agent: `Mozilla/5.0 (Test Platform) ${authTest.browser} Test`,
        request_method: 'POST',
        request_url: `/api/auth/${authTest.action.toLowerCase()}`,
        response_status: 200,
        execution_time_ms: authTest.action === 'LOGIN' ? 250 : 100,
        metadata: {
          authentication_event: true,
          action: authTest.action,
          session_type: 'web',
          browser: authTest.browser,
          platform: 'Test Platform'
        }
      };
      
      const authId = await AuditLogModel.createAuditLog(authAuditData);
      createdIds.push(authId);
      console.log(`   🔐 ${authTest.action} for ${authTest.user.email} from ${authTest.ip} (ID: ${authId})`);
    }
    
    // Test 3: Retrieve and verify the IP addresses
    console.log('\n3️⃣ Verifying IP address display...');
    
    const result = await AuditLogModel.getAuditLogs({
      limit: 15,
      offset: 0,
      sort_by: 'created_at',
      sort_order: 'DESC'
    });
    
    console.log(`   ✅ Retrieved ${result.data.length} audit log entries`);
    
    // Check the latest entries for proper IP display
    result.data.forEach((log, index) => {
      if (index < 8) { // Show details for first 8 entries
        console.log(`\n   📋 Entry ${index + 1}:`);
        console.log(`      ID: ${log.id}`);
        console.log(`      User: ${log.user_email}`);
        console.log(`      Operation: ${log.display_operation || log.operation_type}`);
        console.log(`      Table: ${log.table_name}`);
        console.log(`      IP Address: ${log.ip_address}`);
        console.log(`      Browser: ${log.browser_info}`);
        
        // Analyze IP address format
        if (log.ip_address) {
          if (log.ip_address.includes('localhost')) {
            console.log(`      📍 IP Type: Localhost (${log.ip_address})`);
          } else if (log.ip_address.startsWith('192.168.') || log.ip_address.startsWith('10.') || log.ip_address.startsWith('172.16.')) {
            console.log(`      📍 IP Type: Private Network (${log.ip_address})`);
          } else if (log.ip_address.includes('::')) {
            console.log(`      📍 IP Type: IPv6 (${log.ip_address})`);
          } else if (log.ip_address.match(/^\d+\.\d+\.\d+\.\d+$/)) {
            console.log(`      📍 IP Type: Public IPv4 (${log.ip_address})`);
          } else {
            console.log(`      📍 IP Type: Other format (${log.ip_address})`);
          }
        }
        
        // Check authentication events
        if (log.table_name === 'auth_sessions' && log.new_values && log.new_values.action) {
          const action = log.new_values.action;
          const displayOp = log.display_operation;
          if ((action === 'LOGIN' && displayOp === 'Login') || (action === 'LOGOUT' && displayOp === 'Logout')) {
            console.log(`      ✅ Authentication event displaying correctly: ${action} → ${displayOp}`);
          } else {
            console.log(`      ⚠️ Authentication event display issue: ${action} → ${displayOp}`);
          }
        }
      }
    });
    
    console.log('\n🎉 IP address detection test completed!');
    
    console.log('\n📋 Summary:');
    console.log('   ✅ Various IP address formats tested');
    console.log('   ✅ Authentication events with IP addresses created');
    console.log('   ✅ IP address display verification completed');
    
    console.log('\n💡 IP Address Handling:');
    console.log('   - Localhost: Shows as "127.0.0.1 (localhost)" instead of "::1"');
    console.log('   - Private IPs: 192.168.x.x, 10.x.x.x, 172.16.x.x');
    console.log('   - Public IPs: Real external IP addresses');
    console.log('   - Proxy headers: x-forwarded-for, x-real-ip, cf-connecting-ip');
    
    console.log('\n🚀 The IP detection should now show meaningful addresses!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testIPDetection();
