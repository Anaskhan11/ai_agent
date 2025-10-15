const mysql = require('mysql2/promise');
require('dotenv').config();

async function addMissingCreditPricing() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: "37.27.187.4",
      user: "root",
      password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
      database: "ai_agent",
      port: 3306
    });

    console.log('✅ Connected to database');

    // Add missing credit pricing entries
    const pricingEntries = [
      {
        operation_type: 'phone_number_creation',
        unit_type: 'per_operation',
        credits_per_unit: 5.00,
        description: 'Phone number creation/purchase'
      },
      {
        operation_type: 'campaign_launch',
        unit_type: 'per_launch',
        credits_per_unit: 3.00,
        description: 'Campaign launch operation'
      },
      {
        operation_type: 'assistant_creation',
        unit_type: 'per_operation',
        credits_per_unit: 2.00,
        description: 'AI assistant creation'
      },
      {
        operation_type: 'phone_number_purchase',
        unit_type: 'per_operation',
        credits_per_unit: 5.00,
        description: 'Phone number purchase operation'
      }
    ];

    for (const entry of pricingEntries) {
      try {
        const [result] = await connection.execute(`
          INSERT INTO credit_pricing (operation_type, unit_type, credits_per_unit, description) 
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
          credits_per_unit = VALUES(credits_per_unit),
          description = VALUES(description),
          updated_at = CURRENT_TIMESTAMP
        `, [entry.operation_type, entry.unit_type, entry.credits_per_unit, entry.description]);

        console.log(`✅ Added/Updated pricing for ${entry.operation_type}: ${entry.credits_per_unit} credits`);
      } catch (error) {
        console.error(`❌ Error adding pricing for ${entry.operation_type}:`, error.message);
      }
    }

    // Verify the entries were added
    console.log('\n📋 Current credit pricing entries:');
    const [rows] = await connection.execute(`
      SELECT operation_type, unit_type, credits_per_unit, description, is_active 
      FROM credit_pricing 
      WHERE operation_type IN ('phone_number_creation', 'campaign_launch', 'assistant_creation', 'phone_number_purchase')
      ORDER BY operation_type
    `);

    console.table(rows);

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Run the script
addMissingCreditPricing();
