const db = require('../config/DBConnection');
const TextWebhookService = require('../services/TextWebhookService');
const twilio = require('twilio');

/**
 * Get message history for a specific contact
 */
const getContactMessages = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.id;

    console.log('🔍 getContactMessages called with:', { contactId, userId, page, limit });

    // First, verify the contact exists and user has access
    const [contacts] = await db.execute(`
      SELECT c.id, c.phoneNumber, l.listName
      FROM contacts c
      JOIN lists l ON c.listId = l.id
      WHERE c.id = ? AND l.userId = ?
    `, [contactId, userId]);

    if (contacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found or access denied'
      });
    }

    console.log('✅ Contact found:', contacts[0]);

    // DEBUG: Check what's actually in the contact_messages table
    try {
      const [allMessages] = await db.execute(`SELECT * FROM contact_messages LIMIT 5`);
      console.log('🔍 Sample messages in database:', allMessages);

      const [contactMessages] = await db.execute(`
        SELECT * FROM contact_messages
        WHERE contact_id = ?
        ORDER BY timestamp DESC
        LIMIT 10
      `, [contactId]);
      console.log(`🔍 Messages for contact ${contactId}:`, contactMessages);

      // Transform messages to match frontend interface
      const transformedMessages = contactMessages.map(msg => ({
        id: msg.id.toString(),
        content: msg.content,
        sender: msg.sender,
        timestamp: new Date(msg.timestamp).toISOString(),
        status: msg.status,
        messageId: msg.message_id
      }));

      console.log('📤 Sending transformed messages to frontend:', transformedMessages);

      // Return the actual messages
      res.status(200).json({
        success: true,
        messages: transformedMessages.reverse(), // Reverse to show oldest first
        totalCount: contactMessages.length,
        page: parseInt(page),
        totalPages: Math.ceil(contactMessages.length / limit),
        limit: parseInt(limit)
      });
    } catch (error) {
      console.error('❌ Database error:', error);
      // If there's still a database error, return empty array
      res.status(200).json({
        success: true,
        messages: [],
        totalCount: 0,
        page: parseInt(page),
        totalPages: 0,
        limit: parseInt(limit)
      });
    }
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
};

/**
 * Send message to a contact
 */
const sendMessageToContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { content, fromPhoneNumber } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Get contact details
    const [contacts] = await db.execute(`
      SELECT phoneNumber as contact_number, email
      FROM contacts
      WHERE id = ? AND listId IN (SELECT id FROM lists WHERE userId = ?)
    `, [contactId, userId]);

    if (contacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    const contact = contacts[0];
    const toPhoneNumber = contact.contact_number;

    // Send SMS using Twilio
    const smsResult = await TextWebhookService.sendSMS(
      toPhoneNumber,
      content.trim(),
      fromPhoneNumber
    );

    if (!smsResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to send SMS',
        error: smsResult.error
      });
    }

    // Save message to database
    const [result] = await db.execute(`
      INSERT INTO contact_messages (
        contact_id,
        user_id,
        content,
        sender,
        timestamp,
        status,
        message_id,
        twilio_sid,
        phone_number,
        from_phone_number
      ) VALUES (?, ?, ?, 'user', NOW(), 'sent', ?, ?, ?, ?)
    `, [
      contactId.toString(),
      userId,
      content.trim(),
      smsResult.messageId,
      smsResult.data?.sid,
      toPhoneNumber,
      fromPhoneNumber || null
    ]);

    const messageId = result.insertId;

    // Get the saved message
    const [savedMessage] = await db.execute(`
      SELECT * FROM contact_messages WHERE id = ?
    `, [messageId]);

    res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: smsResult.messageId,
        twilioSid: smsResult.data?.sid,
        status: smsResult.data?.status,
        savedMessage: savedMessage[0]
      }
    });
  } catch (error) {
    console.error('Error sending message to contact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

/**
 * Save a message to database
 */
const saveMessage = async (req, res) => {
  try {
    const {
      contactId,
      content,
      sender,
      status = 'sent',
      messageId,
      twilioSid,
      phoneNumber,
      fromPhoneNumber,
      metadata
    } = req.body;
    const userId = req.user.id;

    if (!contactId || !content || !sender) {
      return res.status(400).json({
        success: false,
        message: 'contactId, content, and sender are required'
      });
    }

    const [result] = await db.execute(`
      INSERT INTO contact_messages (
        contact_id,
        user_id,
        content,
        sender,
        timestamp,
        status,
        message_id,
        twilio_sid,
        phone_number,
        from_phone_number,
        metadata
      ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)
    `, [
      contactId.toString(),
      userId,
      content,
      sender,
      status,
      messageId || null,
      twilioSid || null,
      phoneNumber || null,
      fromPhoneNumber || null,
      metadata ? JSON.stringify(metadata) : null
    ]);

    // Get the saved message
    const [savedMessage] = await db.execute(`
      SELECT * FROM contact_messages WHERE id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Message saved successfully',
      data: savedMessage[0]
    });
  } catch (error) {
    console.error('Error saving message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save message',
      error: error.message
    });
  }
};

/**
 * Update message status
 */
const updateMessageStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const validStatuses = ['sending', 'sent', 'delivered', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    const [result] = await db.execute(`
      UPDATE contact_messages 
      SET status = ?, updated_at = NOW()
      WHERE id = ? AND user_id = ?
    `, [status, messageId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message status updated successfully'
    });
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update message status',
      error: error.message
    });
  }
};

/**
 * Get all conversations (contacts with recent messages)
 */
const getConversations = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    const offset = (page - 1) * limit;

    // Get contacts with their latest message
    const [conversations] = await db.execute(`
      SELECT
        c.id as contact_id,
        c.email,
        c.phoneNumber as contact_number,
        l.listName,
        cm.content as last_message,
        cm.timestamp as last_message_time,
        cm.sender as last_message_sender,
        COUNT(cm2.id) as total_messages,
        SUM(CASE WHEN cm2.sender = 'contact' AND cm2.status != 'read' THEN 1 ELSE 0 END) as unread_count
      FROM contacts c
      LEFT JOIN lists l ON c.listId = l.id
      LEFT JOIN contact_messages cm ON c.id = cm.contact_id
        AND cm.timestamp = (
          SELECT MAX(timestamp)
          FROM contact_messages cm3
          WHERE cm3.contact_id = c.id
        )
      LEFT JOIN contact_messages cm2 ON c.id = cm2.contact_id
      WHERE c.listId IN (SELECT id FROM lists WHERE userId = ?)
      GROUP BY c.id, c.email, c.phoneNumber, l.listName, cm.content, cm.timestamp, cm.sender
      HAVING total_messages > 0
      ORDER BY cm.timestamp DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), offset]);

    // Get total count of contacts with messages
    const [countResult] = await db.execute(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM contacts c
      INNER JOIN contact_messages cm ON c.id = cm.contact_id
      WHERE c.listId IN (SELECT id FROM lists WHERE userId = ?)
    `, [userId]);

    const totalCount = countResult[0].total;
    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      conversations,
      totalCount,
      page: parseInt(page),
      totalPages,
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
};

/**
 * Get message statistics
 */
const getMessageStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get various message statistics (with user ownership check through lists)
    const [stats] = await db.execute(`
      SELECT
        COUNT(*) as total_messages,
        SUM(CASE WHEN cm.sender = 'user' THEN 1 ELSE 0 END) as sent_messages,
        SUM(CASE WHEN cm.sender = 'contact' THEN 1 ELSE 0 END) as received_messages,
        SUM(CASE WHEN cm.status = 'failed' THEN 1 ELSE 0 END) as failed_messages,
        COUNT(DISTINCT cm.contact_id) as contacts_with_messages
      FROM contact_messages cm
      JOIN contacts c ON cm.contact_id = c.id
      JOIN lists l ON c.listId = l.id
      WHERE l.userId = ?
    `, [userId]);

    res.status(200).json({
      success: true,
      stats: stats[0]
    });
  } catch (error) {
    console.error('Error fetching message stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch message statistics',
      error: error.message
    });
  }
};

/**
 * Handle incoming Twilio SMS webhook
 * This endpoint receives incoming SMS messages from contacts
 */
const handleTwilioWebhook = async (req, res) => {
  try {
    console.log('📱 Received Twilio webhook:', req.body);

    // Extract Twilio webhook data
    const {
      MessageSid,
      Body,
      From,
      To,
      MessageStatus,
      AccountSid
    } = req.body;

    // Validate required fields
    if (!MessageSid || !Body || !From || !To) {
      console.log('❌ Missing required webhook fields');
      return res.status(400).send('Missing required fields');
    }

    // Normalize phone numbers (remove +1 prefix for comparison)
    const fromPhoneNumber = From.replace(/^\+1/, '');
    const toPhoneNumber = To.replace(/^\+1/, '');

    console.log(`📞 Incoming SMS from ${From} to ${To}`);
    console.log(`📝 Message: ${Body}`);

    // Find the contact by phone number
    const [contacts] = await db.execute(`
      SELECT c.*, l.userId
      FROM contacts c
      JOIN lists l ON c.listId = l.id
      WHERE REPLACE(REPLACE(c.phoneNumber, '+1', ''), '-', '') = ?
      LIMIT 1
    `, [fromPhoneNumber]);

    if (contacts.length === 0) {
      console.log(`❌ Contact not found for phone number: ${From}`);
      // Still respond with 200 to prevent Twilio retries
      return res.status(200).send('Contact not found');
    }

    const contact = contacts[0];
    const userId = contact.userId;

    console.log(`✅ Found contact: ${contact.email || contact.id} for user ${userId}`);

    // Save the incoming message to database
    const [result] = await db.execute(`
      INSERT INTO contact_messages (
        contact_id,
        user_id,
        content,
        sender,
        timestamp,
        status,
        message_id,
        twilio_sid,
        phone_number,
        from_phone_number
      ) VALUES (?, ?, ?, 'contact', NOW(), 'delivered', ?, ?, ?, ?)
    `, [
      contact.id,
      userId,
      Body.trim(),
      MessageSid,
      MessageSid,
      From,
      To
    ]);

    console.log(`✅ Saved incoming message with ID: ${result.insertId}`);

    // Respond to Twilio with 200 status to acknowledge receipt
    res.status(200).send('Message received');

  } catch (error) {
    console.error('❌ Error handling Twilio webhook:', error);
    // Always respond with 200 to prevent Twilio retries
    res.status(200).send('Error processed');
  }
};

// Check for new incoming messages only (for efficient polling)
const checkNewIncomingMessages = async (req, res) => {
  try {
    const { contactId } = req.params;
    const userId = req.user?.id;
    const { lastMessageId } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    console.log(`🔍 Checking new incoming messages for contact ${contactId}, user ${userId}, after message ${lastMessageId}`);

    // Get only new incoming messages (from contacts) after the last known message
    let query = `
      SELECT
        cm.*,
        c.email as contact_email,
        c.phoneNumber as contact_phone
      FROM contact_messages cm
      JOIN contacts c ON cm.contact_id = c.id
      JOIN lists l ON c.listId = l.id
      WHERE l.userId = ?
        AND cm.contact_id = ?
        AND cm.sender = 'contact'
    `;

    const params = [userId, contactId];

    // If lastMessageId provided, only get messages after that
    if (lastMessageId) {
      query += ` AND cm.id > ?`;
      params.push(lastMessageId);
    }

    query += ` ORDER BY cm.timestamp DESC LIMIT 10`;

    const [messages] = await db.execute(query, params);

    console.log(`📨 Found ${messages.length} new incoming messages`);

    res.json({
      success: true,
      data: messages.reverse(), // Reverse to get chronological order
      hasNewMessages: messages.length > 0
    });

  } catch (error) {
    console.error('❌ Error checking new incoming messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check new messages',
      error: error.message
    });
  }
};

module.exports = {
  getContactMessages,
  sendMessageToContact,
  saveMessage,
  updateMessageStatus,
  getConversations,
  getMessageStats,
  handleTwilioWebhook,
  checkNewIncomingMessages
};
