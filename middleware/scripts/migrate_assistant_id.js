const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function runMigration() {
  let connection;
  
  try {
    connection = await pool.getConnection();
    console.log('🔗 Connected to database');

    // Check if assistant_id column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ai_agent' 
      AND TABLE_NAME = 'workflows' 
      AND COLUMN_NAME = 'assistant_id'
    `);

    if (columns.length > 0) {
      console.log('✅ assistant_id column already exists');
      return;
    }

    console.log('🔧 Adding assistant_id column to workflows table...');

    // Add assistant_id column
    await connection.execute(`
      ALTER TABLE workflows 
      ADD COLUMN assistant_id VARCHAR(255) NULL AFTER org_id
    `);

    // Add index for assistant_id
    await connection.execute(`
      ALTER TABLE workflows 
      ADD INDEX idx_assistant_id (assistant_id)
    `);

    console.log('✅ Successfully added assistant_id column and index');

    // Check if other columns need to be added
    const [nodeColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ai_agent' 
      AND TABLE_NAME = 'workflows' 
      AND COLUMN_NAME = 'nodes'
    `);

    if (nodeColumns.length === 0) {
      console.log('🔧 Adding additional workflow columns...');
      
      await connection.execute(`
        ALTER TABLE workflows 
        ADD COLUMN nodes JSON NULL AFTER description,
        ADD COLUMN edges JSON NULL AFTER nodes,
        ADD COLUMN model JSON NULL AFTER edges,
        ADD COLUMN transcriber JSON NULL AFTER model,
        ADD COLUMN voice JSON NULL AFTER transcriber,
        ADD COLUMN global_prompt TEXT NULL AFTER voice,
        ADD COLUMN background_sound VARCHAR(50) DEFAULT 'off' AFTER global_prompt,
        ADD COLUMN credentials JSON NULL AFTER background_sound,
        ADD COLUMN credential_ids JSON NULL AFTER credentials,
        ADD COLUMN variables JSON NULL AFTER credential_ids,
        ADD COLUMN triggers JSON NULL AFTER variables,
        ADD COLUMN version VARCHAR(20) DEFAULT '1.0.0' AFTER status,
        ADD COLUMN tags JSON NULL AFTER version,
        ADD COLUMN execution_count INT DEFAULT 0 AFTER metadata,
        ADD COLUMN vapi_workflow_id VARCHAR(255) NULL AFTER workflow_id,
        ADD INDEX idx_vapi_workflow_id (vapi_workflow_id)
      `);

      console.log('✅ Successfully added additional workflow columns');

      // Update existing workflows to have default values
      await connection.execute(`
        UPDATE workflows SET 
          nodes = JSON_ARRAY(),
          edges = JSON_ARRAY(),
          variables = JSON_OBJECT(),
          triggers = JSON_ARRAY(),
          tags = JSON_ARRAY()
        WHERE nodes IS NULL
      `);

      console.log('✅ Updated existing workflows with default values');
    }

    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
