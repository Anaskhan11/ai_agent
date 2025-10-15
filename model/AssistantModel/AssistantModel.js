const db = require("../../config/DBConnection");

// Retry function for database operations
async function retryDbOperation(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Database operation attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw error;
      }

      // Check if it's a connection error that might be retryable
      if (error.code === 'ECONNRESET' ||
          error.code === 'PROTOCOL_CONNECTION_LOST' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ETIMEDOUT') {
        console.log(`Retrying database operation in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }

      // If it's not a retryable error, throw immediately
      throw error;
    }
  }
}

// Enhanced assistant creation with full Vapi feature support
async function createEnhancedAssistant(assistantData) {
  return await retryDbOperation(async () => {
    const {
      user_id,
      assistant_id,
      org_id,
      name,
      first_message,
      system_message,
      model,
      voice,
      transcriber,
      functions,
      end_call_message,
      end_call_phrases,
      metadata,
      background_sound,
      backchannel_enabled,
      background_denoising_enabled,
      model_output_in_messages_enabled,
      transport_configurations,
      artifact_plan,
      message_plan,
      start_speaking_plan,
      stop_speaking_plan,
      monitor_plan,
      credential_ids,
      server_url,
      server_url_secret,
      analysis_plan,
      max_duration_seconds,
      silence_timeout_seconds,
      response_delay_seconds,
      llm_request_delay_seconds,
      num_words_to_interrupt_assistant,
      max_words_per_spoken_response,
      voice_activity_detection,
      hipaa_enabled,
      client_messages,
      server_messages,
      phone_number_id,
      customer_id,
      squad_id,
      workflow_id,
      status = 'active'
    } = assistantData;

    const insertSQL = `
      INSERT INTO assistants (
        user_id, assistant_id, org_id, name, first_message, system_message,
        model, voice, transcriber, functions, end_call_message, end_call_phrases,
        metadata, background_sound, backchannel_enabled, background_denoising_enabled,
        model_output_in_messages_enabled, transport_configurations, artifact_plan,
        message_plan, start_speaking_plan, stop_speaking_plan, monitor_plan,
        credential_ids, server_url, server_url_secret, analysis_plan,
        max_duration_seconds, silence_timeout_seconds, response_delay_seconds,
        llm_request_delay_seconds, num_words_to_interrupt_assistant,
        max_words_per_spoken_response, voice_activity_detection, hipaa_enabled,
        client_messages, server_messages, phone_number_id, customer_id,
        squad_id, workflow_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      user_id,
      assistant_id,
      org_id,
      name,
      first_message,
      system_message,
      JSON.stringify(model),
      JSON.stringify(voice),
      JSON.stringify(transcriber),
      JSON.stringify(functions || []),
      end_call_message,
      JSON.stringify(end_call_phrases || []),
      JSON.stringify(metadata || {}),
      background_sound,
      backchannel_enabled || false,
      background_denoising_enabled || false,
      model_output_in_messages_enabled || false,
      JSON.stringify(transport_configurations || {}),
      JSON.stringify(artifact_plan || {}),
      JSON.stringify(message_plan || {}),
      JSON.stringify(start_speaking_plan || {}),
      JSON.stringify(stop_speaking_plan || {}),
      JSON.stringify(monitor_plan || {}),
      JSON.stringify(credential_ids || []),
      server_url,
      server_url_secret,
      JSON.stringify(analysis_plan || {}),
      max_duration_seconds,
      silence_timeout_seconds,
      response_delay_seconds,
      llm_request_delay_seconds,
      num_words_to_interrupt_assistant,
      max_words_per_spoken_response,
      JSON.stringify(voice_activity_detection || {}),
      hipaa_enabled || false,
      JSON.stringify(client_messages || []),
      JSON.stringify(server_messages || []),
      phone_number_id,
      customer_id,
      squad_id,
      workflow_id,
      status
    ];

    const [result] = await db.query(insertSQL, params);
    return result.insertId;
  });
}

async function createAssistantRecord(
  user_id,
  assistantId,
  orgId,
  name,
  firstMessage,
  assistantData
) {
  console.log(user_id, "++++++++++++++++++++Model++++++++++++");

  return await retryDbOperation(async () => {
    const insertSQL = `
      INSERT INTO assistants ( user_id,assistant_id, org_id, name, first_message, assistant_data)
      VALUES (?, ?, ?, ?, ?,?)
    `;

    const params = [
      user_id,
      assistantId,
      orgId,
      name,
      firstMessage,
      JSON.stringify(assistantData),
    ];

    const [result] = await db.query(insertSQL, params);

    return result.insertId;
  });
}

const getAssistants = async (page, limit, search = "", userId = null) => {
  return await retryDbOperation(async () => {
    // Start with an empty array for parameters
    let values = [];
    let whereConditions = [];

    // Add user filter if provided
    if (userId) {
      whereConditions.push("user_id = ?");
      values.push(userId);
    }

    // Add search filter if provided
    if (search) {
      whereConditions.push("name LIKE ?");
      values.push(`%${search}%`);
    }

    // Build WHERE clause
    const whereClause = whereConditions.length > 0 ? ` WHERE ${whereConditions.join(' AND ')}` : '';

    // Count query
    let countQuery = `SELECT COUNT(*) AS total FROM assistants${whereClause}`;

    // Execute count query
    const [totalRows] = await db.query(countQuery, values);
    const totalAssistant = totalRows[0]?.total || 0;

    // Calculate total pages and adjust if necessary
    const totalPages = Math.ceil(totalAssistant / limit);
    const adjustedPage = page > totalPages && totalPages > 0 ? totalPages : page;
    const offset = (adjustedPage - 1) * limit;

    // Now build the SELECT query
    let selectQuery = `SELECT * FROM assistants${whereClause}`;

    // Pagination
    selectQuery += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;

    // We need a fresh array for the SELECT query parameters:
    // Copy the existing values and add limit & offset
    let selectValues = [...values];
    selectValues.push(limit, offset);

    // Execute the SELECT query
    const [rows] = await db.query(selectQuery, selectValues);

    // Return rows (renamed to data) along with totalAssistant
    return { data: rows, totalAssistant };
  });
};

async function updateAssistantRecord(assistantId, updatedData) {
  return await retryDbOperation(async () => {
    console.log('🔄 Updating assistant record in DB:', assistantId);
    const { name, firstMessage } = updatedData;

    const assistantDataJson = JSON.stringify(updatedData);

    const updateSQL = `
      UPDATE assistants
      SET name = ?, first_message = ?, assistant_data = ?
      WHERE assistant_id = ?
    `;

    const params = [
      name || null,
      firstMessage || null,
      assistantDataJson,
      assistantId,
    ];

    console.log('📝 Update params:', { name, firstMessage, assistantId });
    const [result] = await db.query(updateSQL, params);
    console.log('✅ DB update result:', result.affectedRows, 'rows affected');
    return result.affectedRows;
  });
}

async function deleteAssistantRecordById(id) {
  return await retryDbOperation(async () => {
    console.log('🗑️ Attempting to delete assistant with ID:', id);

    // First try to delete by assistant_id (VAPI ID)
    let sql = `DELETE FROM assistants WHERE assistant_id = ?`;
    let [result] = await db.query(sql, [id]);

    if (result.affectedRows > 0) {
      console.log('✅ Deleted by assistant_id:', result.affectedRows, 'rows');
      return result.affectedRows;
    }

    // If no rows affected, try deleting by local database id
    console.log('🔄 No rows found by assistant_id, trying by local id...');
    sql = `DELETE FROM assistants WHERE id = ?`;
    [result] = await db.query(sql, [id]);

    console.log('🗄️ Delete by local id result:', result.affectedRows, 'rows');
    return result.affectedRows;
  });
}

module.exports = {
  createAssistantRecord,
  getAssistants,
  updateAssistantRecord,
  deleteAssistantRecordById,
};
