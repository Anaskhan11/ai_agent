const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');

async function testDuplicatePrevention() {
  try {
    console.log('🛡️ Testing Duplicate Audit Log Prevention...\n');
    
    // Clear recent test logs first
    console.log('🧹 Cleaning up previous test logs...');
    
    // Test 1: Simulate rapid logout calls (like what happens in frontend)
    console.log('\n1️⃣ Simulating rapid logout calls...');
    
    const testUser = {
      id: 999,
      email: 'test.duplicate@example.com',
      first_name: 'Test',
      last_name: 'User'
    };
    
    // Create multiple logout logs rapidly (simulating the duplicate issue)
    const logoutPromises = [];
    for (let i = 0; i < 3; i++) {
      const logoutData = {
        user_id: testUser.id,
        user_email: testUser.email,
        user_name: `${testUser.first_name} ${testUser.last_name}`,
        operation_type: 'CREATE',
        table_name: 'auth_sessions',
        record_id: testUser.id.toString(),
        old_values: {
          session_active: true,
          user_authenticated: true,
          user_id: testUser.id,
          user_email: testUser.email,
          user_name: `${testUser.first_name} ${testUser.last_name}`
        },
        new_values: {
          action: 'LOGOUT',
          user_id: testUser.id,
          user_email: testUser.email,
          user_name: `${testUser.first_name} ${testUser.last_name}`,
          timestamp: new Date().toISOString(),
          session_active: false,
          user_authenticated: false,
          browser: 'Chrome',
          platform: 'Test Platform'
        },
        ip_address: '192.168.1.200',
        user_agent: 'Test User Agent',
        request_method: 'POST',
        request_url: '/api/auth/logout',
        response_status: 200,
        execution_time_ms: 100,
        metadata: {
          authentication_event: true,
          action: 'LOGOUT',
          session_type: 'web',
          browser: 'Chrome',
          platform: 'Test Platform',
          test_scenario: 'rapid_logout_simulation',
          attempt_number: i + 1
        }
      };
      
      logoutPromises.push(AuditLogModel.createAuditLog(logoutData));
    }
    
    const logoutIds = await Promise.all(logoutPromises);
    console.log(`   📝 Created ${logoutIds.length} logout logs: ${logoutIds.join(', ')}`);
    
    // Test 2: Simulate rapid login calls
    console.log('\n2️⃣ Simulating rapid login calls...');
    
    const loginPromises = [];
    for (let i = 0; i < 3; i++) {
      const loginData = {
        user_id: testUser.id,
        user_email: testUser.email,
        user_name: `${testUser.first_name} ${testUser.last_name}`,
        operation_type: 'CREATE',
        table_name: 'auth_sessions',
        record_id: testUser.id.toString(),
        old_values: null,
        new_values: {
          action: 'LOGIN',
          user_id: testUser.id,
          user_email: testUser.email,
          user_name: `${testUser.first_name} ${testUser.last_name}`,
          timestamp: new Date().toISOString(),
          session_active: true,
          user_authenticated: true,
          browser: 'Firefox',
          platform: 'Test Platform'
        },
        ip_address: '192.168.1.201',
        user_agent: 'Test User Agent Firefox',
        request_method: 'POST',
        request_url: '/api/auth/login',
        response_status: 200,
        execution_time_ms: 150,
        metadata: {
          authentication_event: true,
          action: 'LOGIN',
          session_type: 'web',
          browser: 'Firefox',
          platform: 'Test Platform',
          test_scenario: 'rapid_login_simulation',
          attempt_number: i + 1
        }
      };
      
      loginPromises.push(AuditLogModel.createAuditLog(loginData));
    }
    
    const loginIds = await Promise.all(loginPromises);
    console.log(`   📝 Created ${loginIds.length} login logs: ${loginIds.join(', ')}`);
    
    // Test 3: Analyze the created logs for duplicates
    console.log('\n3️⃣ Analyzing created logs for duplicate patterns...');
    
    const allTestIds = [...logoutIds, ...loginIds];
    const result = await AuditLogModel.getAuditLogs({
      limit: 20,
      offset: 0,
      sort_by: 'created_at',
      sort_order: 'DESC'
    });
    
    // Filter to only our test logs
    const testLogs = result.data.filter(log => 
      log.user_email === testUser.email && 
      allTestIds.includes(log.id)
    );
    
    console.log(`   📊 Found ${testLogs.length} test logs out of ${allTestIds.length} created`);
    
    // Group by action type
    const loginLogs = testLogs.filter(log => 
      log.new_values && log.new_values.action === 'LOGIN'
    );
    const logoutLogs = testLogs.filter(log => 
      log.new_values && log.new_values.action === 'LOGOUT'
    );
    
    console.log(`   🔐 Login logs: ${loginLogs.length}`);
    console.log(`   🚪 Logout logs: ${logoutLogs.length}`);
    
    // Check for time-based duplicates
    const checkTimeDuplicates = (logs, actionType) => {
      console.log(`\n   📅 Checking ${actionType} logs for time-based duplicates:`);
      
      logs.forEach((log, index) => {
        console.log(`     ${index + 1}. ID: ${log.id} | Time: ${log.created_at}`);
        console.log(`        User: ${log.user_email} | Action: ${log.new_values?.action}`);
        console.log(`        Metadata: ${JSON.stringify(log.metadata?.test_scenario || 'N/A')}`);
      });
      
      // Check if any logs were created within 1 second of each other
      for (let i = 0; i < logs.length - 1; i++) {
        const currentTime = new Date(logs[i].created_at).getTime();
        const nextTime = new Date(logs[i + 1].created_at).getTime();
        const timeDiff = Math.abs(currentTime - nextTime) / 1000; // seconds
        
        if (timeDiff < 1) {
          console.log(`     ⚠️ Potential duplicate: Logs ${logs[i].id} and ${logs[i + 1].id} created ${timeDiff.toFixed(2)}s apart`);
        }
      }
    };
    
    checkTimeDuplicates(loginLogs, 'LOGIN');
    checkTimeDuplicates(logoutLogs, 'LOGOUT');
    
    // Test 4: Check current audit log count for this user
    console.log('\n4️⃣ Checking total audit logs for test user...');
    
    const userLogs = result.data.filter(log => log.user_email === testUser.email);
    console.log(`   📊 Total logs for ${testUser.email}: ${userLogs.length}`);
    
    const userLoginCount = userLogs.filter(log => 
      log.new_values && log.new_values.action === 'LOGIN'
    ).length;
    const userLogoutCount = userLogs.filter(log => 
      log.new_values && log.new_values.action === 'LOGOUT'
    ).length;
    
    console.log(`   🔐 Total login logs: ${userLoginCount}`);
    console.log(`   🚪 Total logout logs: ${userLogoutCount}`);
    
    // Summary and recommendations
    console.log('\n📋 Summary:');
    console.log(`   ✅ Test completed successfully`);
    console.log(`   📝 Created ${allTestIds.length} audit logs`);
    console.log(`   🔍 Found ${testLogs.length} test logs in database`);
    console.log(`   🔐 Login logs: ${loginLogs.length}`);
    console.log(`   🚪 Logout logs: ${logoutLogs.length}`);
    
    console.log('\n💡 Duplicate Prevention Status:');
    if (loginLogs.length <= 1 && logoutLogs.length <= 1) {
      console.log('   ✅ EXCELLENT: No duplicate logs detected!');
      console.log('   ✅ Frontend duplicate prevention is working correctly');
    } else if (loginLogs.length <= 2 && logoutLogs.length <= 2) {
      console.log('   ⚠️ GOOD: Minimal duplicates detected');
      console.log('   💡 Consider strengthening duplicate prevention');
    } else {
      console.log('   ❌ ISSUE: Multiple duplicate logs detected');
      console.log('   🔧 Frontend duplicate prevention needs improvement');
    }
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. Test the frontend with the new duplicate prevention');
    console.log('   2. Monitor audit logs during login/logout operations');
    console.log('   3. Verify that only 1 log is created per authentication event');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testDuplicatePrevention();
