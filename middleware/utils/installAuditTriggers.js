/**
 * Install Database Audit Triggers
 * This script installs database triggers to capture operations that bypass the middleware
 */

const pool = require('../config/DBConnection');
const fs = require('fs');
const path = require('path');

const installAuditTriggers = async () => {
  try {
    console.log('🔧 Installing database audit triggers...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '../database/triggers/audit_triggers.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Split SQL content by delimiter and execute each statement
    const statements = sqlContent.split('$$').filter(stmt => stmt.trim().length > 0);
    
    const connection = await pool.getConnection();
    
    try {
      // Execute each SQL statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (statement && !statement.startsWith('--') && !statement.startsWith('DELIMITER')) {
          try {
            await connection.execute(statement);
            console.log(`✅ Executed statement ${i + 1}/${statements.length}`);
          } catch (error) {
            console.error(`❌ Error executing statement ${i + 1}:`, error.message);
            console.log('Statement:', statement.substring(0, 100) + '...');
          }
        }
      }
      
      console.log('✅ Database audit triggers installed successfully!');
      
      // Test the triggers by checking if they exist
      const [triggers] = await connection.execute(`
        SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE 
        FROM information_schema.TRIGGERS 
        WHERE TRIGGER_SCHEMA = DATABASE() 
        AND TRIGGER_NAME LIKE '%_audit'
        ORDER BY EVENT_OBJECT_TABLE, EVENT_MANIPULATION
      `);
      
      console.log('\n📋 Installed triggers:');
      triggers.forEach(trigger => {
        console.log(`   - ${trigger.TRIGGER_NAME} (${trigger.EVENT_MANIPULATION} on ${trigger.EVENT_OBJECT_TABLE})`);
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error installing audit triggers:', error);
    throw error;
  }
};

// Function to uninstall triggers (for cleanup)
const uninstallAuditTriggers = async () => {
  try {
    console.log('🗑️ Uninstalling database audit triggers...');
    
    const connection = await pool.getConnection();
    
    try {
      // Get all audit triggers
      const [triggers] = await connection.execute(`
        SELECT TRIGGER_NAME 
        FROM information_schema.TRIGGERS 
        WHERE TRIGGER_SCHEMA = DATABASE() 
        AND TRIGGER_NAME LIKE '%_audit'
      `);
      
      // Drop each trigger
      for (const trigger of triggers) {
        try {
          await connection.execute(`DROP TRIGGER IF EXISTS ${trigger.TRIGGER_NAME}`);
          console.log(`✅ Dropped trigger: ${trigger.TRIGGER_NAME}`);
        } catch (error) {
          console.error(`❌ Error dropping trigger ${trigger.TRIGGER_NAME}:`, error.message);
        }
      }
      
      console.log('✅ Database audit triggers uninstalled successfully!');
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error uninstalling audit triggers:', error);
    throw error;
  }
};

// Function to check trigger status
const checkTriggerStatus = async () => {
  try {
    console.log('🔍 Checking audit trigger status...');
    
    const connection = await pool.getConnection();
    
    try {
      const [triggers] = await connection.execute(`
        SELECT 
          TRIGGER_NAME, 
          EVENT_MANIPULATION, 
          EVENT_OBJECT_TABLE,
          ACTION_TIMING,
          CREATED
        FROM information_schema.TRIGGERS 
        WHERE TRIGGER_SCHEMA = DATABASE() 
        AND TRIGGER_NAME LIKE '%_audit'
        ORDER BY EVENT_OBJECT_TABLE, EVENT_MANIPULATION
      `);
      
      if (triggers.length === 0) {
        console.log('⚠️ No audit triggers found');
        return false;
      }
      
      console.log(`\n📋 Found ${triggers.length} audit triggers:`);
      
      const tableGroups = {};
      triggers.forEach(trigger => {
        if (!tableGroups[trigger.EVENT_OBJECT_TABLE]) {
          tableGroups[trigger.EVENT_OBJECT_TABLE] = [];
        }
        tableGroups[trigger.EVENT_OBJECT_TABLE].push(trigger);
      });
      
      Object.keys(tableGroups).forEach(table => {
        console.log(`\n   📊 ${table}:`);
        tableGroups[table].forEach(trigger => {
          console.log(`      - ${trigger.EVENT_MANIPULATION} (${trigger.ACTION_TIMING})`);
        });
      });
      
      return true;
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error checking trigger status:', error);
    throw error;
  }
};

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'install':
      installAuditTriggers()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'uninstall':
      uninstallAuditTriggers()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'status':
      checkTriggerStatus()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    default:
      console.log('Usage: node installAuditTriggers.js [install|uninstall|status]');
      console.log('');
      console.log('Commands:');
      console.log('  install   - Install database audit triggers');
      console.log('  uninstall - Remove all audit triggers');
      console.log('  status    - Check current trigger status');
      process.exit(1);
  }
}

module.exports = {
  installAuditTriggers,
  uninstallAuditTriggers,
  checkTriggerStatus
};
