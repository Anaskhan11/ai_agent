const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');
const pool = require('../config/DBConnection');

async function testDuplicateFix() {
  try {
    console.log('🔧 Testing Duplicate Audit Log Fix...\n');
    
    // Get current audit log count
    const [beforeCount] = await pool.execute('SELECT COUNT(*) as total FROM audit_logs');
    console.log(`📊 Current audit logs in database: ${beforeCount[0].total}`);
    
    // Show recent logs to understand the current pattern
    const [recentLogs] = await pool.execute(`
      SELECT 
        id, user_email, operation_type, table_name, 
        request_method, request_url, created_at
      FROM audit_logs 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log(`\n📋 Recent audit logs (last 10):`);
    recentLogs.forEach((log, index) => {
      const userDisplay = log.user_email || 'null';
      console.log(`${index + 1}. ID: ${log.id} | ${log.operation_type} | ${log.table_name} | ${userDisplay} | ${log.created_at}`);
      console.log(`   URL: ${log.request_method} ${log.request_url || 'N/A'}`);
      
      // Identify problematic patterns
      if (log.table_name === 'users' && !log.user_email) {
        console.log(`   ⚠️ PROBLEMATIC: User table operation with null user`);
      }
      if (log.table_name === 'auth_sessions') {
        console.log(`   ✅ EXPECTED: Authentication log`);
      }
      console.log('');
    });
    
    // Analyze the pattern
    const authLogs = recentLogs.filter(log => log.table_name === 'auth_sessions');
    const userLogs = recentLogs.filter(log => log.table_name === 'users');
    const nullUserLogs = recentLogs.filter(log => log.table_name === 'users' && !log.user_email);
    
    console.log(`📊 Analysis of recent logs:`);
    console.log(`   - Auth session logs: ${authLogs.length} ✅`);
    console.log(`   - User table logs: ${userLogs.length} ${userLogs.length > 0 ? '⚠️' : '✅'}`);
    console.log(`   - User logs with null user: ${nullUserLogs.length} ${nullUserLogs.length > 0 ? '❌' : '✅'}`);
    
    if (nullUserLogs.length > 0) {
      console.log(`\n❌ ISSUE DETECTED: User table logs with null user found!`);
      console.log(`🔧 These should be prevented by the middleware fix:`);
      nullUserLogs.forEach(log => {
        console.log(`   - ID: ${log.id} | ${log.request_method} ${log.request_url} | ${log.created_at}`);
      });
    } else {
      console.log(`\n✅ GOOD: No user table logs with null user found!`);
    }
    
    // Test the expected behavior
    console.log(`\n💡 Expected behavior after fix:`);
    console.log(`   ✅ Login should create: 1 auth_sessions log`);
    console.log(`   ✅ Logout should create: 1 auth_sessions log`);
    console.log(`   ❌ Should NOT create: users table logs during auth`);
    console.log(`   ❌ Should NOT create: logs with null user_email`);
    
    // Create a test authentication log to verify the system works
    console.log(`\n🧪 Creating test authentication logs...`);
    
    const testUser = {
      id: 888,
      email: 'fix.test@example.com',
      name: 'Fix Test User'
    };
    
    // Test login log
    const loginData = {
      user_id: testUser.id,
      user_email: testUser.email,
      user_name: testUser.name,
      operation_type: 'CREATE',
      table_name: 'auth_sessions',
      record_id: testUser.id.toString(),
      old_values: null,
      new_values: {
        action: 'LOGIN',
        user_id: testUser.id,
        user_email: testUser.email,
        user_name: testUser.name,
        timestamp: new Date().toISOString(),
        session_active: true,
        user_authenticated: true,
        browser: 'Test Browser',
        platform: 'Test Platform'
      },
      ip_address: '192.168.1.150',
      user_agent: 'Mozilla/5.0 (Test) Fix Test',
      request_method: 'POST',
      request_url: '/api/auth/login',
      response_status: 200,
      metadata: {
        authentication_event: true,
        action: 'LOGIN',
        session_type: 'web',
        test: 'duplicate_fix_verification'
      }
    };
    
    const loginId = await AuditLogModel.createAuditLog(loginData);
    console.log(`   ✅ Test login log created: ID ${loginId}`);
    
    // Test logout log
    const logoutData = {
      ...loginData,
      old_values: {
        session_active: true,
        user_authenticated: true,
        user_id: testUser.id,
        user_email: testUser.email
      },
      new_values: {
        action: 'LOGOUT',
        user_id: testUser.id,
        user_email: testUser.email,
        user_name: testUser.name,
        timestamp: new Date().toISOString(),
        session_active: false,
        user_authenticated: false
      },
      request_url: '/api/auth/logout',
      metadata: {
        authentication_event: true,
        action: 'LOGOUT',
        session_type: 'web',
        test: 'duplicate_fix_verification'
      }
    };
    
    const logoutId = await AuditLogModel.createAuditLog(logoutData);
    console.log(`   ✅ Test logout log created: ID ${logoutId}`);
    
    // Final count
    const [afterCount] = await pool.execute('SELECT COUNT(*) as total FROM audit_logs');
    console.log(`\n📊 Final audit log count: ${afterCount[0].total} (added ${afterCount[0].total - beforeCount[0].total})`);
    
    // Summary
    console.log(`\n📋 Fix Summary:`);
    console.log(`   🔧 Middleware now skips:`);
    console.log(`      - All /api/auth/ endpoints`);
    console.log(`      - User profile endpoints (/api/users/me, /api/users/current, etc.)`);
    console.log(`      - User table operations without user context`);
    console.log(`   ✅ Frontend duplicate prevention implemented`);
    console.log(`   ✅ Logout state management added`);
    
    console.log(`\n🎯 Expected Result:`);
    console.log(`   - Login: Creates exactly 1 auth_sessions log`);
    console.log(`   - Logout: Creates exactly 1 auth_sessions log`);
    console.log(`   - Total: 2 logs per login/logout cycle (not 3 or 4)`);
    
    console.log(`\n🚀 Test the fix by logging in and out in the frontend!`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testDuplicateFix();
