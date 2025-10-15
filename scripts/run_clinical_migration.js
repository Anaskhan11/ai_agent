// Clinical Study Management Migration Script
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runClinicalMigration() {
  let connection;
  
  try {
    console.log('🏥 Starting Clinical Study Management Migration...');
    
    // Create database connection
    connection = await mysql.createConnection({
      host: '37.27.187.4',
      user: 'root',
      password: 'l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX',
      database: 'ai_agent',
      multipleStatements: true
    });
    
    console.log('✅ Connected to database');
    
    // Create backup of current database structure
    console.log('💾 Creating backup of current database structure...');
    const backupData = {
      timestamp: new Date().toISOString(),
      tables: {}
    };
    
    // Get list of existing tables
    const [tables] = await connection.execute('SHOW TABLES');
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      try {
        const [structure] = await connection.execute(`DESCRIBE ${tableName}`);
        backupData.tables[tableName] = structure;
      } catch (error) {
        console.warn(`⚠️  Could not backup structure for table ${tableName}: ${error.message}`);
      }
    }
    
    const backupPath = path.join(__dirname, `clinical_backup_${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`✅ Backup saved to: ${backupPath}`);
    
    // Read and execute schema migration
    console.log('🔄 Executing clinical schema migration...');
    const schemaPath = path.join(__dirname, 'clinical_study_management_schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Split SQL into individual statements and execute
    const schemaStatements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.toLowerCase().includes('delimiter'));
    
    console.log(`📝 Found ${schemaStatements.length} schema statements to execute`);
    
    let schemaSuccessCount = 0;
    for (let i = 0; i < schemaStatements.length; i++) {
      const statement = schemaStatements[i];
      
      if (statement.toLowerCase().includes('select ')) {
        console.log(`⏭️  Skipping SELECT statement ${i + 1}`);
        continue;
      }
      
      try {
        await connection.execute(statement);
        schemaSuccessCount++;
        
        // Log table creation
        if (statement.toLowerCase().includes('create table')) {
          const tableName = statement.match(/create table (?:if not exists )?`?(\w+)`?/i)?.[1];
          if (tableName) {
            console.log(`✅ Created table: ${tableName}`);
          }
        }
        
        // Log view creation
        if (statement.toLowerCase().includes('create or replace view')) {
          const viewName = statement.match(/create or replace view `?(\w+)`?/i)?.[1];
          if (viewName) {
            console.log(`✅ Created view: ${viewName}`);
          }
        }
        
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⚠️  Table already exists, skipping statement ${i + 1}`);
        } else if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`⚠️  Index already exists, skipping statement ${i + 1}`);
        } else {
          console.error(`❌ Error in schema statement ${i + 1}:`, error.message);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
        }
      }
    }
    
    console.log(`✅ Schema migration completed: ${schemaSuccessCount} statements executed`);
    
    // Read and execute seed data
    console.log('🌱 Executing clinical roles seed data...');
    const seedPath = path.join(__dirname, 'clinical_roles_seed.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');
    
    const seedStatements = seedSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${seedStatements.length} seed statements to execute`);
    
    let seedSuccessCount = 0;
    for (let i = 0; i < seedStatements.length; i++) {
      const statement = seedStatements[i];
      
      try {
        const [result] = await connection.execute(statement);
        seedSuccessCount++;
        
        // Log INSERT results
        if (statement.toLowerCase().includes('insert into')) {
          const tableName = statement.match(/insert into `?(\w+)`?/i)?.[1];
          if (tableName && result.affectedRows) {
            console.log(`✅ Inserted ${result.affectedRows} rows into ${tableName}`);
          }
        }
        
        // Log SELECT results (status messages)
        if (statement.toLowerCase().includes('select ') && result.length > 0) {
          result.forEach(row => {
            Object.entries(row).forEach(([key, value]) => {
              console.log(`📊 ${key}: ${value}`);
            });
          });
        }
        
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  Duplicate entry, skipping statement ${i + 1}`);
        } else {
          console.error(`❌ Error in seed statement ${i + 1}:`, error.message);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
        }
      }
    }
    
    console.log(`✅ Seed data completed: ${seedSuccessCount} statements executed`);
    
    // Verify migration results
    console.log('🔍 Verifying migration results...');
    
    // Check clinical_roles table
    const [clinicalRoles] = await connection.execute('SELECT COUNT(*) as count FROM clinical_roles');
    console.log(`✅ Clinical roles created: ${clinicalRoles[0].count}`);
    
    // Check sites table
    const [sites] = await connection.execute('SELECT COUNT(*) as count FROM sites');
    console.log(`✅ Sites created: ${sites[0].count}`);
    
    // Check studies table
    const [studies] = await connection.execute('SELECT COUNT(*) as count FROM studies');
    console.log(`✅ Studies created: ${studies[0].count}`);
    
    // Check views
    try {
      const [studyOverview] = await connection.execute('SELECT COUNT(*) as count FROM study_overview');
      console.log(`✅ Study overview view accessible with ${studyOverview[0].count} records`);
    } catch (error) {
      console.error(`❌ Study overview view error: ${error.message}`);
    }
    
    console.log('\n🎉 Clinical Study Management Migration completed successfully!');
    console.log('📋 Summary:');
    console.log(`   - Clinical roles: ${clinicalRoles[0].count}`);
    console.log(`   - Sites: ${sites[0].count}`);
    console.log(`   - Studies: ${studies[0].count}`);
    console.log(`   - Backup saved: ${backupPath}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
runClinicalMigration();
