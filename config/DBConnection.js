const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  waitForConnections: true,
  connectionLimit: 15, // Increased from 10
  queueLimit: 0,
  idleTimeout: 300000, // 5 minutes
  maxIdle: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  multipleStatements: false
});

// Handle connection events
// pool.on('connection', function (connection) {
//   console.log(`✅ Database connected as id ${connection.threadId}`);
// });

// pool.on('acquire', function (connection) {
//   console.log(`🔗 Connection ${connection.threadId} acquired`);
// });

// pool.on('release', function (connection) {
//   console.log(`🔓 Connection ${connection.threadId} released`);
// });

// pool.on('error', function(err) {
//   console.error('❌ Database pool error:', err);
//   if(err.code === 'PROTOCOL_CONNECTION_LOST') {
//     console.log('🔌 Database connection was closed - will reconnect');
//   }
//   if(err.code === 'ER_CON_COUNT_ERROR') {
//     console.log('⚠️ Database has too many connections');
//   }
//   if(err.code === 'ECONNREFUSED') {
//     console.log('🚫 Database connection was refused');
//   }
//   if(err.code === 'ECONNRESET') {
//     console.log('🔄 Database connection was reset');
//   }
//   if(err.code === 'ETIMEDOUT') {
//     console.log('⏰ Database connection timed out');
//   }
// });

module.exports = pool;
