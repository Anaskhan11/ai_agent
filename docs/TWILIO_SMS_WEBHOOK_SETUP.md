# Twilio SMS Webhook Setup Guide

## Problem Identified

The messaging system was only working in one direction:
- ✅ **Outgoing messages worked**: Users could send SMS to contacts via Twilio API
- ❌ **Incoming messages didn't work**: No webhook endpoint to receive SMS from contacts

## Root Cause

The application was missing a **Twilio webhook endpoint** to handle incoming SMS messages. When contacts replied to SMS messages, Twilio had nowhere to send the incoming message data.

## Solution Implemented

### 1. Created Twilio Webhook Endpoints

**New Routes Added:**
- `POST /api/twilio-webhook/sms` - Handles incoming SMS messages
- `POST /api/twilio-webhook/status` - Handles message status updates

**Files Created/Modified:**
- `backend/routes/TwilioWebhookRoutes.js` - New webhook routes
- `backend/controller/ContactMessagesController.js` - Added `handleTwilioWebhook` function
- `backend/routes/ContactMessagesRoutes.js` - Added webhook route
- `backend/index.js` - Registered new routes

### 2. Webhook Handler Logic

The `handleTwilioWebhook` function:
1. Receives Twilio webhook data (MessageSid, Body, From, To, etc.)
2. Finds the contact by phone number in the database
3. Saves the incoming message to `contact_messages` table with `sender = 'contact'`
4. Responds with HTTP 200 to acknowledge receipt

### 3. Phone Number Matching

The system handles phone number variations:
- Removes `+1` prefix for comparison
- Matches against both `phoneNumber` and `contact_number` fields
- Normalizes phone numbers for reliable matching

## Setup Instructions

### Step 1: Configure Twilio Webhook URLs

Run the configuration script:
```bash
cd backend/scripts
node configure_twilio_webhook.js
```

This will:
- Set your Twilio phone number's SMS webhook URL to: `https://ai.research-hero.com/api/twilio-webhook/sms`
- Set status callback URL to: `https://ai.research-hero.com/api/twilio-webhook/status`

### Step 2: Test the Webhook

Run the test script:
```bash
cd backend/scripts
node test_twilio_webhook.js
```

This will:
- Check if webhook endpoints are accessible
- Send test webhook data to verify functionality
- Test both SMS and status webhooks

### Step 3: Manual Twilio Console Configuration (Alternative)

If the script doesn't work, manually configure in Twilio Console:

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to Phone Numbers → Manage → Active numbers
3. Click on your phone number: `+13462331126`
4. In the "Messaging" section, set:
   - **Webhook URL**: `https://ai.research-hero.com/api/twilio-webhook/sms`
   - **HTTP Method**: POST
   - **Status Callback URL**: `https://ai.research-hero.com/api/twilio-webhook/status`
5. Save configuration

## Testing the Fix

### 1. Database Verification

Check that incoming messages are saved:
```sql
SELECT * FROM contact_messages 
WHERE sender = 'contact' 
ORDER BY timestamp DESC 
LIMIT 10;
```

### 2. End-to-End Test

1. Send an SMS from your application to a contact
2. Have the contact reply to that SMS
3. Check the messaging interface - the reply should appear
4. Verify in database that the message was saved with `sender = 'contact'`

### 3. Log Monitoring

Monitor server logs for webhook activity:
```bash
# Look for these log messages:
📱 Received Twilio webhook: {...}
📞 Incoming SMS from +1234567890 to +13462331126
✅ Found contact: email@example.com for user 123
✅ Saved incoming message with ID: 456
```

## Webhook Data Flow

```
Contact sends SMS → Twilio → Webhook → Your Server → Database → UI Update
```

1. **Contact sends SMS** to your Twilio number
2. **Twilio receives** the SMS and makes HTTP POST to your webhook
3. **Webhook handler** processes the data and finds the contact
4. **Database** stores the message with `sender = 'contact'`
5. **UI** displays the incoming message in the conversation

## Troubleshooting

### Common Issues

1. **Webhook not receiving data**
   - Check Twilio phone number configuration
   - Verify webhook URL is accessible from internet
   - Check server logs for errors

2. **Contact not found**
   - Verify contact phone numbers in database match sender
   - Check phone number normalization (remove +1, dashes, etc.)
   - Ensure contact belongs to a list owned by a user

3. **Messages not appearing in UI**
   - Check database for saved messages
   - Verify frontend is polling for new messages
   - Check user permissions and contact ownership

### Debug Commands

```bash
# Test webhook endpoint accessibility
curl -X POST https://ai.research-hero.com/api/twilio-webhook/sms

# Check Twilio phone number configuration
node backend/scripts/configure_twilio_webhook.js

# Test with sample data
node backend/scripts/test_twilio_webhook.js
```

## Security Considerations

1. **No Authentication**: Webhook endpoints are public (required by Twilio)
2. **Validation**: Consider adding Twilio signature validation for production
3. **Rate Limiting**: Consider implementing rate limiting for webhook endpoints
4. **Error Handling**: Always respond with 200 to prevent Twilio retries

## Next Steps

1. **Test thoroughly** with real phone numbers
2. **Monitor logs** for any issues
3. **Consider adding** Twilio signature validation
4. **Update frontend** to auto-refresh conversations when new messages arrive
5. **Add notifications** for incoming messages

The messaging system should now work bidirectionally! 🎉
