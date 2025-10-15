/**
 * Environment Variables Checker for Backend
 * This utility helps verify that environment variables are loaded correctly
 */

require('dotenv').config({ path: './config/config.env' });

function checkEnvironmentVariables() {
  console.log('🔍 Backend Environment Variables Check:');
  console.log('=====================================');
  
  const requiredVars = [
    'PORT',
    'BASE_URL',
    'FRONTEND_URL',
    'FACEBOOK_APP_ID',
    'FACEBOOK_APP_SECRET',
    'FACEBOOK_REDIRECT_URI',
    'JWT_SECRET'
  ];
  
  const optionalVars = [
    'FACEBOOK_WEBHOOK_VERIFY_TOKEN',
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REDIRECT_URI'
  ];
  
  console.log('\n📋 Required Variables:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      // Mask sensitive values
      const displayValue = ['JWT_SECRET', 'FACEBOOK_APP_SECRET', 'GMAIL_CLIENT_SECRET'].includes(varName) 
        ? '***MASKED***' 
        : value;
      console.log(`  ✅ ${varName}: ${displayValue}`);
    } else {
      console.log(`  ❌ ${varName}: NOT SET`);
    }
  });
  
  console.log('\n📋 Optional Variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      const displayValue = ['GMAIL_CLIENT_SECRET'].includes(varName) 
        ? '***MASKED***' 
        : value;
      console.log(`  ✅ ${varName}: ${displayValue}`);
    } else {
      console.log(`  ⚠️  ${varName}: NOT SET`);
    }
  });
  
  // Check for port consistency
  console.log('\n🔍 Port Analysis:');
  const frontendUrl = process.env.FRONTEND_URL;
  const baseUrl = process.env.BASE_URL;
  
  if (frontendUrl) {
    const frontendPort = frontendUrl.match(/:(\d+)/)?.[1];
    console.log(`  Frontend Port: ${frontendPort || 'NOT FOUND'}`);
    
    if (frontendPort === '5173') {
      console.log('  ✅ Frontend configured for port 5173');
    } else if (frontendPort === '5174') {
      console.log('  ⚠️  Frontend still configured for port 5174');
    }
  }
  
  if (baseUrl) {
    const backendPort = baseUrl.match(/:(\d+)/)?.[1];
    console.log(`  Backend Port: ${backendPort || 'NOT FOUND'}`);
  }
  
  console.log('\n🛠️  Facebook OAuth Configuration:');
  console.log(`  App ID: ${process.env.FACEBOOK_APP_ID || 'NOT SET'}`);
  console.log(`  Redirect URI: ${process.env.FACEBOOK_REDIRECT_URI || 'NOT SET'}`);
  console.log(`  Frontend URL: ${process.env.FRONTEND_URL || 'NOT SET'}`);
  
  // Generate sample OAuth URL to verify configuration
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_REDIRECT_URI) {
    const sampleOAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(process.env.FACEBOOK_REDIRECT_URI)}&scope=pages_manage_metadata,leads_retrieval,pages_read_engagement&response_type=code`;
    console.log('\n🔗 Sample Facebook OAuth URL:');
    console.log(`  ${sampleOAuthUrl}`);
  }
  
  console.log('\n✅ Environment check complete!');
  console.log('\n💡 Tips:');
  console.log('  - Restart the backend server after changing config.env');
  console.log('  - Clear browser cache if OAuth redirects to wrong port');
  console.log('  - Verify Facebook App settings match FACEBOOK_REDIRECT_URI');
}

// Export for use in other modules
module.exports = { checkEnvironmentVariables };

// Run check if this file is executed directly
if (require.main === module) {
  checkEnvironmentVariables();
}
