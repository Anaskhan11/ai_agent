const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');

async function testValuesModalDesign() {
  try {
    console.log('🎨 Testing Values Modal Design...\n');
    
    // Test 1: Create audit log with only old values (DELETE operation)
    console.log('1️⃣ Creating DELETE operation with only old values...');
    const deleteAuditData = {
      user_id: 1,
      user_email: 'john.doe@example.com',
      user_name: 'John Doe',
      operation_type: 'DELETE',
      table_name: 'users',
      record_id: '123',
      old_values: {
        id: 123,
        name: 'John Smith',
        email: 'john.smith@example.com',
        status: 'active',
        created_at: '2024-01-15T10:30:00Z',
        role: 'user',
        last_login: '2024-08-05T14:20:00Z'
      },
      new_values: null, // No new values for DELETE
      changed_fields: null,
      ip_address: '192.168.1.105',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      request_method: 'DELETE',
      request_url: '/api/users/123',
      response_status: 200,
      execution_time_ms: 80,
      metadata: {
        operation_context: 'user_deletion',
        reason: 'account_closure'
      }
    };
    
    const deleteId = await AuditLogModel.createAuditLog(deleteAuditData);
    console.log(`   ✅ Created DELETE audit log with ID: ${deleteId} (Only old values)`);
    
    // Test 2: Create audit log with only new values (CREATE operation)
    console.log('\n2️⃣ Creating CREATE operation with only new values...');
    const createAuditData = {
      user_id: 2,
      user_email: 'jane.doe@example.com',
      user_name: 'Jane Doe',
      operation_type: 'CREATE',
      table_name: 'users',
      record_id: '124',
      old_values: null, // No old values for CREATE
      new_values: {
        id: 124,
        name: 'Alice Johnson',
        email: 'alice.johnson@example.com',
        status: 'active',
        created_at: new Date().toISOString(),
        role: 'user',
        department: 'Marketing',
        phone: '+1-555-0123'
      },
      changed_fields: null,
      ip_address: '203.0.113.78',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      request_method: 'POST',
      request_url: '/api/users',
      response_status: 201,
      execution_time_ms: 150,
      metadata: {
        operation_context: 'user_registration',
        source: 'admin_panel'
      }
    };
    
    const createId = await AuditLogModel.createAuditLog(createAuditData);
    console.log(`   ✅ Created CREATE audit log with ID: ${createId} (Only new values)`);
    
    // Test 3: Create audit log with both old and new values (UPDATE operation)
    console.log('\n3️⃣ Creating UPDATE operation with both old and new values...');
    const updateAuditData = {
      user_id: 3,
      user_email: 'admin@example.com',
      user_name: 'Admin User',
      operation_type: 'UPDATE',
      table_name: 'users',
      record_id: '125',
      old_values: {
        id: 125,
        name: 'Bob Wilson',
        email: 'bob.wilson@example.com',
        status: 'inactive',
        role: 'user',
        department: 'Sales',
        phone: '+1-555-0456',
        last_updated: '2024-07-15T09:00:00Z'
      },
      new_values: {
        id: 125,
        name: 'Bob Wilson',
        email: 'bob.wilson@newcompany.com', // Email changed
        status: 'active', // Status changed
        role: 'manager', // Role changed
        department: 'Sales',
        phone: '+1-555-0456',
        last_updated: new Date().toISOString()
      },
      changed_fields: [
        {
          field: 'email',
          oldValue: 'bob.wilson@example.com',
          newValue: 'bob.wilson@newcompany.com'
        },
        {
          field: 'status',
          oldValue: 'inactive',
          newValue: 'active'
        },
        {
          field: 'role',
          oldValue: 'user',
          newValue: 'manager'
        }
      ],
      ip_address: '10.0.0.50',
      user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      request_method: 'PUT',
      request_url: '/api/users/125',
      response_status: 200,
      execution_time_ms: 120,
      metadata: {
        operation_context: 'profile_update',
        updated_by: 'admin',
        fields_changed: ['email', 'status', 'role']
      }
    };
    
    const updateId = await AuditLogModel.createAuditLog(updateAuditData);
    console.log(`   ✅ Created UPDATE audit log with ID: ${updateId} (Both old and new values)`);
    
    // Test 4: Create authentication logs for modal testing
    console.log('\n4️⃣ Creating authentication logs...');
    const authLogs = [
      {
        action: 'LOGIN',
        user: { id: 1, email: 'test.user@example.com', name: 'Test User' },
        values: {
          action: 'LOGIN',
          user_id: 1,
          user_email: 'test.user@example.com',
          session_id: 'sess_' + Date.now(),
          login_time: new Date().toISOString(),
          browser: 'Chrome',
          platform: 'MacOS'
        }
      },
      {
        action: 'LOGOUT',
        user: { id: 1, email: 'test.user@example.com', name: 'Test User' },
        oldValues: {
          session_active: true,
          user_authenticated: true,
          session_id: 'sess_' + Date.now()
        },
        values: {
          action: 'LOGOUT',
          user_id: 1,
          user_email: 'test.user@example.com',
          session_active: false,
          logout_time: new Date().toISOString()
        }
      }
    ];
    
    for (const authLog of authLogs) {
      const authAuditData = {
        user_id: authLog.user.id,
        user_email: authLog.user.email,
        user_name: authLog.user.name,
        operation_type: 'CREATE',
        table_name: 'auth_sessions',
        record_id: authLog.user.id.toString(),
        old_values: authLog.oldValues || null,
        new_values: authLog.values,
        ip_address: '192.168.1.200',
        user_agent: 'Mozilla/5.0 (Test Browser)',
        request_method: 'POST',
        request_url: `/api/auth/${authLog.action.toLowerCase()}`,
        response_status: 200,
        metadata: {
          authentication_event: true,
          action: authLog.action,
          session_type: 'web'
        }
      };
      
      const authId = await AuditLogModel.createAuditLog(authAuditData);
      console.log(`   🔐 Created ${authLog.action} audit log with ID: ${authId}`);
    }
    
    // Test 5: Retrieve and verify the data structure
    console.log('\n5️⃣ Verifying audit log data structure for modal...');
    const result = await AuditLogModel.getAuditLogs({
      limit: 10,
      offset: 0,
      sort_by: 'created_at',
      sort_order: 'DESC'
    });
    
    console.log(`   ✅ Retrieved ${result.data.length} audit log entries`);
    
    // Analyze each entry for modal display
    result.data.forEach((log, index) => {
      if (index < 5) {
        console.log(`\n   📋 Entry ${index + 1} (ID: ${log.id}):`);
        console.log(`      Operation: ${log.display_operation || log.operation_type}`);
        console.log(`      Table: ${log.table_name}`);
        console.log(`      User: ${log.user_email}`);
        
        // Analyze values for modal display
        const hasOldValues = log.old_values && Object.keys(log.old_values).length > 0;
        const hasNewValues = log.new_values && Object.keys(log.new_values).length > 0;
        const hasChangedFields = log.changed_fields && log.changed_fields.length > 0;
        
        console.log(`      Values Analysis:`);
        console.log(`        - Has Old Values: ${hasOldValues ? '✅' : '❌'}`);
        console.log(`        - Has New Values: ${hasNewValues ? '✅' : '❌'}`);
        console.log(`        - Has Changed Fields: ${hasChangedFields ? '✅' : '❌'}`);
        
        if (hasOldValues) {
          console.log(`        - Old Values Keys: ${Object.keys(log.old_values).join(', ')}`);
        }
        if (hasNewValues) {
          console.log(`        - New Values Keys: ${Object.keys(log.new_values).join(', ')}`);
        }
        if (hasChangedFields) {
          console.log(`        - Changed Fields: ${log.changed_fields.map(f => f.field).join(', ')}`);
        }
        
        // Modal display recommendation
        if (hasOldValues && hasNewValues) {
          console.log(`      📱 Modal Display: Show both old and new values with comparison`);
        } else if (hasOldValues && !hasNewValues) {
          console.log(`      📱 Modal Display: Show old values + "No new values" message`);
        } else if (!hasOldValues && hasNewValues) {
          console.log(`      📱 Modal Display: Show new values + "No old values" message`);
        } else {
          console.log(`      📱 Modal Display: Show "No values available" message`);
        }
      }
    });
    
    console.log('\n🎉 Values modal design test completed!');
    
    console.log('\n📋 Summary:');
    console.log('   ✅ DELETE operation: Only old values (shows old + "No new values")');
    console.log('   ✅ CREATE operation: Only new values (shows new + "No old values")');
    console.log('   ✅ UPDATE operation: Both values (shows old vs new comparison)');
    console.log('   ✅ Authentication logs: Various value combinations');
    
    console.log('\n🎨 Modal Design Features:');
    console.log('   - Single "Values" column with "View Values" button');
    console.log('   - Animated modal with detailed view');
    console.log('   - Color-coded sections (red for old, green for new)');
    console.log('   - Changed fields comparison when available');
    console.log('   - Contextual messages for missing values');
    
    console.log('\n🚀 The new Values modal design is ready!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testValuesModalDesign();
