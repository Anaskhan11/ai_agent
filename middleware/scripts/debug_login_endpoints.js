const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');

async function debugLoginEndpoints() {
  try {
    console.log('🔍 Debugging Login/Logout Endpoint Calls...\n');
    
    // Get the most recent audit logs to see what's being logged
    const result = await AuditLogModel.getAuditLogs({
      limit: 10,
      offset: 0,
      sort_by: 'created_at',
      sort_order: 'DESC'
    });
    
    console.log(`📊 Found ${result.data.length} recent audit log entries\n`);
    
    // Analyze each log to understand what endpoints are being called
    result.data.forEach((log, index) => {
      console.log(`📋 Entry ${index + 1} (ID: ${log.id}):`);
      console.log(`   Timestamp: ${log.created_at}`);
      console.log(`   User: ${log.user_email || 'Unknown'}`);
      console.log(`   Operation: ${log.display_operation || log.operation_type}`);
      console.log(`   Table: ${log.table_name}`);
      console.log(`   Method: ${log.request_method || 'N/A'}`);
      console.log(`   URL: ${log.request_url || 'N/A'}`);
      console.log(`   IP: ${log.ip_address || 'N/A'}`);
      console.log(`   Status: ${log.response_status || 'N/A'}`);
      
      // Check if this is an authentication-related log
      const isAuthLog = log.table_name === 'auth_sessions' || 
                       (log.metadata && log.metadata.authentication_event) ||
                       (log.new_values && (log.new_values.action === 'LOGIN' || log.new_values.action === 'LOGOUT'));
      
      if (isAuthLog) {
        console.log(`   🔐 AUTH LOG: ${log.new_values?.action || 'Unknown action'}`);
      }
      
      // Check if this might be the problematic user endpoint
      if (log.table_name === 'users' || log.request_url?.includes('/users')) {
        console.log(`   👤 USER ENDPOINT: Potential cause of extra log`);
        console.log(`   📝 Details: ${log.request_method} ${log.request_url}`);
        
        if (log.metadata) {
          console.log(`   📋 Metadata: ${JSON.stringify(log.metadata, null, 2)}`);
        }
      }
      
      console.log(''); // Empty line for readability
    });
    
    // Group logs by user and time to identify login/logout sessions
    console.log('🔍 Analyzing Login/Logout Sessions...\n');
    
    const sessions = {};
    result.data.forEach(log => {
      const userKey = log.user_email || 'unknown';
      const timeKey = log.created_at ? log.created_at.substring(0, 16) : 'unknown'; // Group by minute
      const sessionKey = `${userKey}_${timeKey}`;
      
      if (!sessions[sessionKey]) {
        sessions[sessionKey] = [];
      }
      sessions[sessionKey].push(log);
    });
    
    Object.entries(sessions).forEach(([sessionKey, logs]) => {
      if (logs.length > 1) {
        console.log(`📅 Session: ${sessionKey} (${logs.length} logs)`);
        
        logs.forEach((log, index) => {
          console.log(`   ${index + 1}. ${log.display_operation || log.operation_type} | ${log.table_name} | ${log.request_method} ${log.request_url}`);
        });
        
        // Identify the problematic pattern
        const authLogs = logs.filter(log => 
          log.table_name === 'auth_sessions' || 
          (log.metadata && log.metadata.authentication_event)
        );
        const userLogs = logs.filter(log => log.table_name === 'users');
        const otherLogs = logs.filter(log => 
          log.table_name !== 'auth_sessions' && 
          log.table_name !== 'users' &&
          !(log.metadata && log.metadata.authentication_event)
        );
        
        console.log(`   📊 Analysis: ${authLogs.length} auth logs, ${userLogs.length} user logs, ${otherLogs.length} other logs`);
        
        if (userLogs.length > 0) {
          console.log(`   ⚠️ ISSUE: User table logs detected during auth session`);
          userLogs.forEach(userLog => {
            console.log(`      🔍 User log: ${userLog.request_method} ${userLog.request_url} → ${userLog.operation_type}`);
          });
        }
        
        console.log('');
      }
    });
    
    // Recommendations
    console.log('💡 Recommendations:\n');
    
    const userTableLogs = result.data.filter(log => log.table_name === 'users');
    const authTableLogs = result.data.filter(log => log.table_name === 'auth_sessions');
    
    console.log(`📊 Summary:`);
    console.log(`   - Auth session logs: ${authTableLogs.length}`);
    console.log(`   - User table logs: ${userTableLogs.length}`);
    console.log(`   - Total logs: ${result.data.length}`);
    
    if (userTableLogs.length > 0) {
      console.log(`\n⚠️ User table logs detected:`);
      userTableLogs.forEach(log => {
        console.log(`   - ${log.request_method} ${log.request_url} (${log.operation_type})`);
      });
      
      console.log(`\n🔧 Fix needed:`);
      console.log(`   1. Add these user endpoints to middleware skip patterns`);
      console.log(`   2. Or modify the table name extraction logic`);
      console.log(`   3. Consider if these user operations should be logged separately`);
    }
    
    if (authTableLogs.length > 2) {
      console.log(`\n⚠️ Multiple auth logs detected - possible duplicates`);
      console.log(`   🔧 Frontend duplicate prevention should handle this`);
    }
    
    console.log(`\n🎯 Goal: Only 2 logs per login/logout session:`);
    console.log(`   1. LOGIN log (auth_sessions table)`);
    console.log(`   2. LOGOUT log (auth_sessions table)`);
    console.log(`   ❌ No user table logs during authentication`);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

debugLoginEndpoints();
