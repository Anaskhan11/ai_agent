// Simple test script to check if the patient API endpoints are working
const mysql = require('mysql2/promise');

async function testPatientAPI() {
  console.log('🧪 Testing Patient API endpoints...');
  
  try {
    // Test database connection
    const connection = await mysql.createConnection({
      host: '37.27.187.4',
      user: 'root',
      password: 'l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX',
      database: 'ai_agent'
    });
    
    console.log('✅ Database connection successful');
    
    // Test basic contacts query
    const [contacts] = await connection.execute('SELECT COUNT(*) as count FROM contacts');
    console.log(`✅ Total contacts in database: ${contacts[0].count}`);
    
    // Test contacts with patient fields
    const [patientContacts] = await connection.execute(`
      SELECT 
        id, fullName, email, phoneNumber, 
        patient_lead_source, banned, status, qualified_status, 
        date_of_birth, age, height, weight_lbs
      FROM contacts 
      LIMIT 5
    `);
    
    console.log('✅ Sample patient data:');
    patientContacts.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.fullName} - Status: ${contact.status || 'null'} - Qualified: ${contact.qualified_status || 'null'}`);
    });
    
    // Test patient statistics query
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_patients,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_patients,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted_patients,
        SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) as qualified_patients,
        SUM(CASE WHEN status = 'enrolled' THEN 1 ELSE 0 END) as enrolled_patients,
        SUM(CASE WHEN banned = 1 THEN 1 ELSE 0 END) as banned_patients,
        SUM(CASE WHEN dnq = 1 THEN 1 ELSE 0 END) as dnq_patients
      FROM contacts c
      LEFT JOIN lists l ON c.listId = l.id
    `);
    
    console.log('✅ Patient statistics:');
    console.log(stats[0]);
    
    await connection.end();
    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPatientAPI();
