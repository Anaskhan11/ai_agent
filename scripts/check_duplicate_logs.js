const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');

async function checkDuplicateLogs() {
  try {
    console.log('🔍 Checking for Duplicate Audit Logs...\n');
    
    // Get recent audit logs to analyze patterns
    const result = await AuditLogModel.getAuditLogs({
      limit: 20,
      offset: 0,
      sort_by: 'created_at',
      sort_order: 'DESC'
    });
    
    console.log(`📊 Found ${result.data.length} recent audit log entries`);
    
    // Group logs by user and operation to find duplicates
    const logGroups = {};
    const authLogs = [];
    
    result.data.forEach(log => {
      // Check for authentication logs
      if (log.table_name === 'auth_sessions' || 
          (log.metadata && log.metadata.authentication_event) ||
          (log.new_values && (log.new_values.action === 'LOGIN' || log.new_values.action === 'LOGOUT'))) {
        authLogs.push(log);
      }
      
      // Group by user, operation, and time (within 5 seconds)
      const key = `${log.user_email}_${log.operation_type}_${log.table_name}`;
      const timeWindow = Math.floor(new Date(log.created_at).getTime() / 5000); // 5-second windows
      const groupKey = `${key}_${timeWindow}`;
      
      if (!logGroups[groupKey]) {
        logGroups[groupKey] = [];
      }
      logGroups[groupKey].push(log);
    });
    
    // Find potential duplicates
    console.log('\n🔍 Analyzing for duplicate patterns...');
    
    const duplicateGroups = Object.entries(logGroups).filter(([key, logs]) => logs.length > 1);
    
    if (duplicateGroups.length > 0) {
      console.log(`⚠️ Found ${duplicateGroups.length} potential duplicate groups:`);
      
      duplicateGroups.forEach(([groupKey, logs]) => {
        console.log(`\n📋 Group: ${groupKey}`);
        console.log(`   Count: ${logs.length} logs`);
        
        logs.forEach((log, index) => {
          console.log(`   ${index + 1}. ID: ${log.id} | Time: ${log.created_at} | User: ${log.user_email}`);
          console.log(`      Operation: ${log.display_operation || log.operation_type} | Table: ${log.table_name}`);
          console.log(`      IP: ${log.ip_address} | Method: ${log.request_method} | URL: ${log.request_url}`);
          
          if (log.metadata) {
            console.log(`      Metadata: ${JSON.stringify(log.metadata)}`);
          }
          if (log.new_values && log.new_values.action) {
            console.log(`      Action: ${log.new_values.action}`);
          }
        });
      });
    } else {
      console.log('✅ No obvious duplicate groups found');
    }
    
    // Analyze authentication logs specifically
    console.log('\n🔐 Analyzing Authentication Logs...');
    console.log(`Found ${authLogs.length} authentication-related logs:`);
    
    const authByUser = {};
    authLogs.forEach(log => {
      const userKey = log.user_email || 'unknown';
      if (!authByUser[userKey]) {
        authByUser[userKey] = { login: [], logout: [] };
      }
      
      const action = log.new_values?.action || 
                    (log.display_operation === 'Login' ? 'LOGIN' : 
                     log.display_operation === 'Logout' ? 'LOGOUT' : 'UNKNOWN');
      
      if (action === 'LOGIN') {
        authByUser[userKey].login.push(log);
      } else if (action === 'LOGOUT') {
        authByUser[userKey].logout.push(log);
      }
    });
    
    Object.entries(authByUser).forEach(([userEmail, actions]) => {
      console.log(`\n👤 User: ${userEmail}`);
      console.log(`   Login logs: ${actions.login.length}`);
      console.log(`   Logout logs: ${actions.logout.length}`);
      
      if (actions.login.length > 1) {
        console.log(`   ⚠️ Multiple login logs detected:`);
        actions.login.forEach((log, index) => {
          console.log(`     ${index + 1}. ID: ${log.id} | Time: ${log.created_at}`);
        });
      }
      
      if (actions.logout.length > 1) {
        console.log(`   ⚠️ Multiple logout logs detected:`);
        actions.logout.forEach((log, index) => {
          console.log(`     ${index + 1}. ID: ${log.id} | Time: ${log.created_at}`);
        });
      }
    });
    
    // Check for logs created within seconds of each other
    console.log('\n⏱️ Checking for logs created within seconds...');
    
    const timeGroups = {};
    result.data.forEach(log => {
      const timeKey = log.created_at.substring(0, 19); // Group by second
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = [];
      }
      timeGroups[timeKey].push(log);
    });
    
    const simultaneousLogs = Object.entries(timeGroups).filter(([time, logs]) => logs.length > 1);
    
    if (simultaneousLogs.length > 0) {
      console.log(`⚠️ Found ${simultaneousLogs.length} time periods with multiple logs:`);
      
      simultaneousLogs.forEach(([time, logs]) => {
        console.log(`\n⏰ Time: ${time}`);
        console.log(`   Count: ${logs.length} logs`);
        
        logs.forEach((log, index) => {
          console.log(`   ${index + 1}. ID: ${log.id} | User: ${log.user_email} | Op: ${log.display_operation || log.operation_type}`);
        });
      });
    } else {
      console.log('✅ No simultaneous logs found');
    }
    
    // Summary and recommendations
    console.log('\n📋 Summary:');
    console.log(`   Total logs analyzed: ${result.data.length}`);
    console.log(`   Authentication logs: ${authLogs.length}`);
    console.log(`   Potential duplicate groups: ${duplicateGroups.length}`);
    console.log(`   Simultaneous log periods: ${simultaneousLogs.length}`);
    
    console.log('\n💡 Recommendations:');
    if (duplicateGroups.length > 0 || simultaneousLogs.length > 0) {
      console.log('   ⚠️ Duplicate logs detected - investigate the following:');
      console.log('   1. Frontend AuthContext calling createAuditLogEntry multiple times');
      console.log('   2. Backend middleware not properly skipping auth endpoints');
      console.log('   3. React re-renders triggering multiple calls');
      console.log('   4. Multiple event listeners or useEffect calls');
    } else {
      console.log('   ✅ No obvious duplicate patterns found');
      console.log('   ✅ Audit logging appears to be working correctly');
    }
    
  } catch (error) {
    console.error('❌ Error checking duplicate logs:', error);
    console.error('Stack trace:', error.stack);
  }
}

checkDuplicateLogs();
