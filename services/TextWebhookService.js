const twilio = require('twilio');

// Twilio configuration from environment variables
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'AC9a586635a05429bf70270a3d01832733';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '890c9bbfefa0e771c6d3a8247ca2b0c5';
const TWILIO_PHONE_NUMBER = '+13462331126'; // Default phone number

// Initialize Twilio client
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * Send SMS using Twilio
 * @param {string} toPhoneNumber - The phone number to send SMS to
 * @param {string} message - The message content
 * @param {string} fromPhoneNumber - The phone number to send from (defaults to configured number)
 * @returns {Promise<Object>} - Twilio message object
 */
const sendSMS = async (toPhoneNumber, message, fromPhoneNumber = TWILIO_PHONE_NUMBER) => {
  try {
    console.log(`📱 Sending SMS to ${toPhoneNumber} from ${fromPhoneNumber}`);
    console.log(`📝 Message: ${message}`);

    const result = await twilioClient.messages.create({
      body: message,
      from: fromPhoneNumber,
      to: toPhoneNumber
    });

    console.log(`✅ SMS sent successfully! SID: ${result.sid}`);
    return {
      success: true,
      messageId: result.sid,
      status: result.status,
      data: result
    };
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
};

/**
 * Process text webhook action from webhook data
 * @param {Object} webhook - Webhook configuration
 * @param {Object} rawData - Raw webhook data
 * @param {Object} structuredData - Structured webhook data
 * @returns {Promise<Object>} - Result of SMS sending
 */
const processTextWebhookAction = async (webhook, rawData, structuredData) => {
  try {
    console.log('📱 Processing text webhook action...');
    
    // Parse webhook metadata to find text webhook configuration
    let metadata = {};
    try {
      const rawMeta = webhook?.metadata ?? {};
      metadata = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : (rawMeta || {});
      if (metadata === null) metadata = {};
    } catch (error) {
      console.log('❌ Error parsing webhook metadata:', error);
      metadata = {};
    }

    const actionCards = Array.isArray(metadata.actionCards) ? metadata.actionCards : [];
    console.log(`📋 Found ${actionCards.length} action cards`);
    if (actionCards.length > 0) {
      console.log(`📋 Action cards details:`, JSON.stringify(actionCards, null, 2));
    }

    // Find text webhook action card (robust matching)
    let textWebhookCard = actionCards.find(card =>
      (card?.selectedApp?.id === 'text-webhook' ||
       (typeof card?.selectedApp?.name === 'string' && card.selectedApp.name.toLowerCase().includes('text webhook')))
      && (card.isConnected ?? true)
    );

    // Fallback: also check workflow_config.actions if present
    if (!textWebhookCard) {
      try {
        let wf = webhook?.workflow_config ?? {};
        wf = typeof wf === 'string' ? JSON.parse(wf) : (wf || {});
        const wfActions = Array.isArray(wf.actions) ? wf.actions : [];
        if (wfActions.length > 0) {
          const wfText = wfActions.find(a =>
            a?.type === 'text-webhook' ||
            a?.type === 'send-sms' ||
            a?.type === 'sms' ||
            a?.app?.id === 'text-webhook' ||
            (typeof a?.app?.name === 'string' && a.app.name.toLowerCase().includes('text webhook'))
          );
          if (wfText) {
            textWebhookCard = {
              isConnected: true,
              textConfig: {
                messageTemplate: wfText.messageTemplate || wfText.template || 'New webhook data received from {name} at {timestamp}',
                fromPhoneNumber: wfText.fromPhoneNumber || TWILIO_PHONE_NUMBER
              }
            };
            console.log('ℹ️ Using workflow_config action as Text Webhook source');
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (!textWebhookCard) {
      console.log('ℹ️ No text webhook action found or not connected');
      return { success: false, error: 'Text webhook not configured' };
    }

    console.log('✅ Text webhook action found:', textWebhookCard);

    // Get text webhook configuration
    const textConfig = textWebhookCard.textConfig;
    if (!textConfig) {
      console.log('❌ No text configuration found in text webhook card');
      return { success: false, error: 'Text configuration missing' };
    }

    // Extract phone number from webhook data
    const phoneNumber = normalizeToE164(extractPhoneNumber(rawData, structuredData));
    if (!phoneNumber) {
      console.log('❌ No phone number found in webhook data');
      return { success: false, error: 'No phone number in webhook data' };
    }

    // Get message template
    const messageTemplate = textConfig.messageTemplate || 'New webhook data received';
    
    // Replace placeholders in message template
    const message = replaceMessagePlaceholders(messageTemplate, rawData, structuredData);
    
    // Send SMS
    const result = await sendSMS(phoneNumber, message, textConfig.fromPhoneNumber);
    
    if (result.success) {
      console.log(`✅ Text webhook action completed successfully`);
    } else {
      console.log(`❌ Text webhook action failed: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error processing text webhook action:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Extract phone number from webhook data
 * @param {Object} rawData - Raw webhook data
 * @param {Object} structuredData - Structured webhook data
 * @returns {string|null} - Phone number or null if not found
 */
const extractPhoneNumber = (rawData, structuredData) => {
  // Check structured data first
  if (structuredData?.phone) {
    return structuredData.phone;
  }

  // Check raw data for common phone number fields
  const phoneFields = [
    'phone', 'Phone', 'PHONE', 'phoneNumber', 'phone_number',
    'mobile', 'Mobile', 'MOBILE', 'cell', 'Cell', 'CELL',
    'telephone', 'Telephone', 'TELEPHONE'
  ];

  for (const field of phoneFields) {
    if (rawData[field]) {
      return rawData[field];
    }
  }

  // Check nested data structures
  if (rawData.data && typeof rawData.data === 'object') {
    for (const field of phoneFields) {
      if (rawData.data[field]) {
        return rawData.data[field];
      }
    }
  }

  if (rawData.payload && typeof rawData.payload === 'object') {
    for (const field of phoneFields) {
      if (rawData.payload[field]) {
        return rawData.payload[field];
      }
    }
  }

  return null;
};

/**
 * Replace placeholders in message template with actual data
 * @param {string} template - Message template with placeholders
 * @param {Object} rawData - Raw webhook data
 * @param {Object} structuredData - Structured webhook data
 * @returns {string} - Message with replaced placeholders
 */
const replaceMessagePlaceholders = (template, rawData, structuredData) => {
  let message = template;

  // Replace common placeholders
  const placeholders = {
    '{name}': structuredData?.name || rawData?.name || rawData?.fullName || 'Lead',
    '{email}': structuredData?.email || rawData?.email || 'No email',
    '{phone}': structuredData?.phone || rawData?.phone || 'No phone',
    '{company}': structuredData?.company || rawData?.company || 'No company',
    '{message}': structuredData?.message || rawData?.message || 'No message',
    '{timestamp}': new Date().toLocaleString(),
    '{webhook_id}': rawData?.webhook_id || rawData?.id || 'Unknown'
  };

  // Replace placeholders in template
  Object.entries(placeholders).forEach(([placeholder, value]) => {
    message = message.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  });

  return message;
};

// Normalize phone to E.164 basic format (best-effort)
const normalizeToE164 = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (/^\+[1-9]\d{6,14}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (/^[1-9]\d{6,14}$/.test(digits)) return `+${digits}`;
  const defaultCc = (process.env.DEFAULT_CALLING_COUNTRY_CODE || '+1').replace(/\D/g, '1');
  return `+${defaultCc}${digits}`;
};

/**
 * Test Twilio connection
 * @returns {Promise<Object>} - Connection test result
 */
const testTwilioConnection = async () => {
  try {
    console.log('🧪 Testing Twilio connection...');
    
    // Try to get account info to test connection
    const account = await twilioClient.api.accounts(TWILIO_ACCOUNT_SID).fetch();
    
    console.log(`✅ Twilio connection successful! Account: ${account.friendlyName}`);
    return {
      success: true,
      accountName: account.friendlyName,
      accountSid: account.sid
    };
  } catch (error) {
    console.error('❌ Twilio connection test failed:', error);
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
};

module.exports = {
  sendSMS,
  processTextWebhookAction,
  extractPhoneNumber,
  replaceMessagePlaceholders,
  normalizeToE164,
  testTwilioConnection
};
