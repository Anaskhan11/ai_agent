const pool = require("../../config/DBConnection");
const { v4: uuidv4 } = require('uuid');

// Safe JSON parsing helper
const safeJsonParse = (value, defaultValue = null) => {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  // If it's already an object, return it
  if (typeof value === 'object') {
    return value;
  }

  // If it's a string, try to parse it
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('JSON parse error:', error.message, 'Value:', value);
      return defaultValue;
    }
  }

  return defaultValue;
};

// Retry database operation helper
const retryDbOperation = async (operation, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Database operation attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};

// Create a new default assistant template
async function createDefaultAssistantTemplate(templateData) {
  return await retryDbOperation(async () => {
    const {
      name,
      description,
      category = 'General',
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
      backchannel_enabled = false,
      background_denoising_enabled = false,
      model_output_in_messages_enabled = false,
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
      hipaa_enabled = false,
      client_messages,
      server_messages,
      is_active = true,
      is_featured = false,
      sort_order = 0,
      created_by
    } = templateData;

    const template_id = uuidv4();

    const insertSQL = `
      INSERT INTO default_assistant_templates (
        template_id, name, description, category, first_message, system_message,
        model, voice, transcriber, functions, end_call_message, end_call_phrases,
        metadata, background_sound, backchannel_enabled, background_denoising_enabled,
        model_output_in_messages_enabled, transport_configurations, artifact_plan,
        message_plan, start_speaking_plan, stop_speaking_plan, monitor_plan,
        credential_ids, server_url, server_url_secret, analysis_plan,
        max_duration_seconds, silence_timeout_seconds, response_delay_seconds,
        llm_request_delay_seconds, num_words_to_interrupt_assistant,
        max_words_per_spoken_response, voice_activity_detection, hipaa_enabled,
        client_messages, server_messages, is_active, is_featured, sort_order, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      template_id,
      name || null,
      description || null,
      category,
      first_message || null,
      system_message || null,
      model ? JSON.stringify(model) : null,
      voice ? JSON.stringify(voice) : null,
      transcriber ? JSON.stringify(transcriber) : null,
      JSON.stringify(functions || []),
      end_call_message || null,
      JSON.stringify(end_call_phrases || []),
      JSON.stringify(metadata || {}),
      background_sound || null,
      backchannel_enabled,
      background_denoising_enabled,
      model_output_in_messages_enabled,
      JSON.stringify(transport_configurations || {}),
      JSON.stringify(artifact_plan || {}),
      JSON.stringify(message_plan || {}),
      JSON.stringify(start_speaking_plan || {}),
      JSON.stringify(stop_speaking_plan || {}),
      JSON.stringify(monitor_plan || {}),
      JSON.stringify(credential_ids || []),
      server_url || null,
      server_url_secret || null,
      JSON.stringify(analysis_plan || {}),
      max_duration_seconds || null,
      silence_timeout_seconds || null,
      response_delay_seconds || null,
      llm_request_delay_seconds || null,
      num_words_to_interrupt_assistant || null,
      max_words_per_spoken_response || null,
      JSON.stringify(voice_activity_detection || {}),
      hipaa_enabled,
      JSON.stringify(client_messages || {}),
      JSON.stringify(server_messages || {}),
      is_active,
      is_featured,
      sort_order,
      created_by
    ];

    const [result] = await pool.execute(insertSQL, params);
    
    console.log(`✅ Default assistant template created with ID: ${template_id}`);
    return {
      id: result.insertId,
      template_id,
      ...templateData
    };
  });
}

// Get all default assistant templates
async function getAllDefaultAssistantTemplates(filters = {}) {
  return await retryDbOperation(async () => {
    let sql = `
      SELECT 
        id, template_id, name, description, category,
        first_message, system_message, model, voice, transcriber,
        functions, end_call_message, end_call_phrases, metadata,
        background_sound, backchannel_enabled, background_denoising_enabled,
        model_output_in_messages_enabled, transport_configurations,
        artifact_plan, message_plan, start_speaking_plan, stop_speaking_plan,
        monitor_plan, credential_ids, server_url, server_url_secret,
        analysis_plan, max_duration_seconds, silence_timeout_seconds,
        response_delay_seconds, llm_request_delay_seconds,
        num_words_to_interrupt_assistant, max_words_per_spoken_response,
        voice_activity_detection, hipaa_enabled, client_messages,
        server_messages, is_active, is_featured, sort_order,
        usage_count, created_by, updated_by, created_at, updated_at
      FROM default_assistant_templates
      WHERE 1=1
    `;

    const params = [];

    if (filters.is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(filters.is_active);
    }

    if (filters.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.is_featured !== undefined) {
      sql += ' AND is_featured = ?';
      params.push(filters.is_featured);
    }

    sql += ' ORDER BY is_featured DESC, sort_order ASC, name ASC';

    const [rows] = await pool.execute(sql, params);
    
    // Parse JSON fields safely
    return rows.map(row => ({
      ...row,
      model: safeJsonParse(row.model, null),
      voice: safeJsonParse(row.voice, null),
      transcriber: safeJsonParse(row.transcriber, null),
      functions: safeJsonParse(row.functions, []),
      end_call_phrases: safeJsonParse(row.end_call_phrases, []),
      metadata: safeJsonParse(row.metadata, {}),
      transport_configurations: safeJsonParse(row.transport_configurations, {}),
      artifact_plan: safeJsonParse(row.artifact_plan, {}),
      message_plan: safeJsonParse(row.message_plan, {}),
      start_speaking_plan: safeJsonParse(row.start_speaking_plan, {}),
      stop_speaking_plan: safeJsonParse(row.stop_speaking_plan, {}),
      monitor_plan: safeJsonParse(row.monitor_plan, {}),
      credential_ids: safeJsonParse(row.credential_ids, []),
      analysis_plan: safeJsonParse(row.analysis_plan, {}),
      voice_activity_detection: safeJsonParse(row.voice_activity_detection, {}),
      client_messages: safeJsonParse(row.client_messages, {}),
      server_messages: safeJsonParse(row.server_messages, {})
    }));
  });
}

// Get default assistant template by ID
async function getDefaultAssistantTemplateById(template_id) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT 
        id, template_id, name, description, category,
        first_message, system_message, model, voice, transcriber,
        functions, end_call_message, end_call_phrases, metadata,
        background_sound, backchannel_enabled, background_denoising_enabled,
        model_output_in_messages_enabled, transport_configurations,
        artifact_plan, message_plan, start_speaking_plan, stop_speaking_plan,
        monitor_plan, credential_ids, server_url, server_url_secret,
        analysis_plan, max_duration_seconds, silence_timeout_seconds,
        response_delay_seconds, llm_request_delay_seconds,
        num_words_to_interrupt_assistant, max_words_per_spoken_response,
        voice_activity_detection, hipaa_enabled, client_messages,
        server_messages, is_active, is_featured, sort_order,
        usage_count, created_by, updated_by, created_at, updated_at
      FROM default_assistant_templates
      WHERE template_id = ?
    `;

    const [rows] = await pool.execute(sql, [template_id]);
    
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      ...row,
      model: safeJsonParse(row.model, null),
      voice: safeJsonParse(row.voice, null),
      transcriber: safeJsonParse(row.transcriber, null),
      functions: safeJsonParse(row.functions, []),
      end_call_phrases: safeJsonParse(row.end_call_phrases, []),
      metadata: safeJsonParse(row.metadata, {}),
      transport_configurations: safeJsonParse(row.transport_configurations, {}),
      artifact_plan: safeJsonParse(row.artifact_plan, {}),
      message_plan: safeJsonParse(row.message_plan, {}),
      start_speaking_plan: safeJsonParse(row.start_speaking_plan, {}),
      stop_speaking_plan: safeJsonParse(row.stop_speaking_plan, {}),
      monitor_plan: safeJsonParse(row.monitor_plan, {}),
      credential_ids: safeJsonParse(row.credential_ids, []),
      analysis_plan: safeJsonParse(row.analysis_plan, {}),
      voice_activity_detection: safeJsonParse(row.voice_activity_detection, {}),
      client_messages: safeJsonParse(row.client_messages, {}),
      server_messages: safeJsonParse(row.server_messages, {})
    };
  });
}

// Update default assistant template
async function updateDefaultAssistantTemplate(template_id, templateData, updated_by) {
  return await retryDbOperation(async () => {
    const {
      name,
      description,
      category,
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
      is_active,
      is_featured,
      sort_order
    } = templateData;

    const updateSQL = `
      UPDATE default_assistant_templates SET
        name = ?, description = ?, category = ?, first_message = ?, system_message = ?,
        model = ?, voice = ?, transcriber = ?, functions = ?, end_call_message = ?,
        end_call_phrases = ?, metadata = ?, background_sound = ?, backchannel_enabled = ?,
        background_denoising_enabled = ?, model_output_in_messages_enabled = ?,
        transport_configurations = ?, artifact_plan = ?, message_plan = ?,
        start_speaking_plan = ?, stop_speaking_plan = ?, monitor_plan = ?,
        credential_ids = ?, server_url = ?, server_url_secret = ?, analysis_plan = ?,
        max_duration_seconds = ?, silence_timeout_seconds = ?, response_delay_seconds = ?,
        llm_request_delay_seconds = ?, num_words_to_interrupt_assistant = ?,
        max_words_per_spoken_response = ?, voice_activity_detection = ?, hipaa_enabled = ?,
        client_messages = ?, server_messages = ?, is_active = ?, is_featured = ?,
        sort_order = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE template_id = ?
    `;

    const params = [
      name,
      description,
      category,
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
      backchannel_enabled,
      background_denoising_enabled,
      model_output_in_messages_enabled,
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
      hipaa_enabled,
      JSON.stringify(client_messages || {}),
      JSON.stringify(server_messages || {}),
      is_active,
      is_featured,
      sort_order,
      updated_by,
      template_id
    ];

    const [result] = await pool.execute(updateSQL, params);

    if (result.affectedRows === 0) {
      throw new Error('Template not found or no changes made');
    }

    console.log(`✅ Default assistant template updated: ${template_id}`);
    return await getDefaultAssistantTemplateById(template_id);
  });
}

// Delete default assistant template
async function deleteDefaultAssistantTemplate(template_id) {
  return await retryDbOperation(async () => {
    const sql = 'DELETE FROM default_assistant_templates WHERE template_id = ?';
    const [result] = await pool.execute(sql, [template_id]);

    if (result.affectedRows === 0) {
      throw new Error('Template not found');
    }

    console.log(`✅ Default assistant template deleted: ${template_id}`);
    return { success: true, template_id };
  });
}

// Increment usage count for template
async function incrementTemplateUsage(template_id) {
  return await retryDbOperation(async () => {
    const sql = 'UPDATE default_assistant_templates SET usage_count = usage_count + 1 WHERE template_id = ?';
    const [result] = await pool.execute(sql, [template_id]);

    if (result.affectedRows === 0) {
      console.warn(`Template not found for usage increment: ${template_id}`);
    }

    return { success: true };
  });
}

// Get template categories
async function getTemplateCategories() {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT DISTINCT category, COUNT(*) as count
      FROM default_assistant_templates
      WHERE is_active = 1
      GROUP BY category
      ORDER BY category
    `;

    const [rows] = await pool.execute(sql);
    return rows;
  });
}

module.exports = {
  createDefaultAssistantTemplate,
  getAllDefaultAssistantTemplates,
  getDefaultAssistantTemplateById,
  updateDefaultAssistantTemplate,
  deleteDefaultAssistantTemplate,
  incrementTemplateUsage,
  getTemplateCategories
};
