const axios = require('axios');
require('dotenv').config({ path: './config/config.env' });

class VapiService {
  constructor() {
    this.baseURL = 'https://api.vapi.ai';
    this.apiKey = process.env.VAPI_SECRET_KEY;
    
    if (!this.apiKey) {
      console.error('VAPI_SECRET_KEY not found in environment variables');
      throw new Error('VAPI_SECRET_KEY is required');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('VapiService initialized with API key:', this.apiKey ? '✓' : '✗');
  }





  // Create assistant in Vapi
  async createAssistant(assistantData) {
    try {
      console.log('Creating assistant in Vapi:', assistantData.name);
      
      const response = await this.client.post('/assistant', assistantData);
      
      console.log('Vapi assistant created successfully:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error creating assistant in Vapi:', error.response?.data || error.message);
      throw new Error(`Vapi API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get assistant from Vapi
  async getAssistant(assistantId) {
    try {
      console.log('Getting assistant from Vapi:', assistantId);
      
      const response = await this.client.get(`/assistant/${assistantId}`);
      
      console.log('Vapi assistant retrieved successfully:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error getting assistant from Vapi:', error.response?.data || error.message);
      throw new Error(`Vapi API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // List assistants from Vapi
  async listAssistants(params = {}) {
    try {
      console.log('Listing assistants from Vapi');
      
      const response = await this.client.get('/assistant', { params });
      
      console.log('Vapi assistants retrieved successfully:', response.data.length || 0);
      return response.data;
    } catch (error) {
      console.error('Error listing assistants from Vapi:', error.response?.data || error.message);
      throw new Error(`Vapi API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Create call in Vapi
  async createCall(callData) {
    try {
      console.log('Creating call in Vapi');

      const response = await this.client.post('/call', callData);

      console.log('Vapi call created successfully:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error creating call in Vapi:', error.response?.data || error.message);
      throw new Error(`Vapi API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Create credential in Vapi
  async createCredential(credentialData) {
    try {
      console.log('Creating credential in Vapi:', credentialData.provider);

      const response = await this.client.post('/credential', credentialData);

      console.log('Vapi credential created successfully:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error creating credential in Vapi:', error.response?.data || error.message);
      throw new Error(`Vapi Credential API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // List credentials in Vapi
  async listCredentials() {
    try {
      console.log('Listing credentials in Vapi');

      const response = await this.client.get('/credential');

      console.log('Vapi credentials retrieved successfully');
      return response.data;
    } catch (error) {
      console.error('Error listing credentials in Vapi:', error.response?.data || error.message);
      throw new Error(`Vapi Credential API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Create phone number in Vapi
  async createPhoneNumber(phoneNumberData) {
    try {
      console.log('Creating phone number in Vapi:', phoneNumberData.number);

      const response = await this.client.post('/phone-number', phoneNumberData);

      console.log('Vapi phone number created successfully:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error creating phone number in Vapi:', error.response?.data || error.message);
      throw new Error(`Vapi Phone Number API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // List phone numbers in Vapi
  async listPhoneNumbers() {
    try {
      console.log('Listing phone numbers in Vapi');

      const response = await this.client.get('/phone-number');

      console.log('Vapi phone numbers retrieved successfully');
      return response.data;
    } catch (error) {
      console.error('Error listing phone numbers in Vapi:', error.response?.data || error.message);
      throw new Error(`Vapi Phone Number API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Buy/Create free phone number in Vapi
  async buyPhoneNumber(phoneNumberData) {
    try {
      console.log('Buying phone number in Vapi:', phoneNumberData);

      const response = await this.client.post('/phone-number/buy', phoneNumberData);

      console.log('Vapi phone number purchased successfully:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error buying phone number in Vapi:', error.response?.data || error.message);
      throw new Error(`Vapi Phone Number Buy API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Create workflow in Vapi
  async createWorkflow(workflowData) {
    try {
      console.log('Creating workflow in Vapi:', workflowData.name);

      // Validate workflow data first
      const validation = this.validateWorkflowForVapi(workflowData);
      if (validation.errors.length > 0) {
        throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
      }
      if (validation.warnings.length > 0) {
        console.warn('Workflow validation warnings:', validation.warnings);
      }

      // Sanitize the workflow data before sending to VAPI
      const sanitizedData = this.sanitizeWorkflowData(workflowData);
      console.log('Sanitized workflow data for VAPI:', JSON.stringify(sanitizedData, null, 2));

      const response = await this.client.post('/workflow', sanitizedData);

      console.log('Vapi workflow created successfully:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error creating workflow in Vapi:', error.response?.data || error.message);

      // Log the sanitized data that caused the error for debugging
      if (error.response?.data?.message?.includes('nodes.headers.type')) {
        console.error('VAPI validation error - problematic data:', JSON.stringify(sanitizedData, null, 2));

        // Log specific node headers that might be causing issues
        if (sanitizedData.nodes) {
          sanitizedData.nodes.forEach((node, index) => {
            if (node.headers) {
              console.error(`Node ${index} headers:`, JSON.stringify(node.headers, null, 2));
            }
            if (node.apiRequestConfig?.headers) {
              console.error(`Node ${index} apiRequestConfig headers:`, JSON.stringify(node.apiRequestConfig.headers, null, 2));
            }
          });
        }
      }

      throw new Error(`Vapi API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get workflow from Vapi
  async getWorkflow(workflowId) {
    try {
      console.log('Getting workflow from Vapi:', workflowId);

      const response = await this.client.get(`/workflow/${workflowId}`);

      console.log('Vapi workflow retrieved successfully:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error getting workflow from Vapi:', error.response?.data || error.message);
      throw new Error(`Vapi API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // List workflows from Vapi
  async listWorkflows(params = {}) {
    try {
      console.log('Listing workflows from Vapi');

      const response = await this.client.get('/workflow', { params });

      console.log('Vapi workflows retrieved successfully:', response.data.length || 0);
      return response.data;
    } catch (error) {
      console.error('Error listing workflows from Vapi:', error.response?.data || error.message);
      throw new Error(`Vapi API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Sanitize workflow data for VAPI API
  sanitizeWorkflowData(workflowData) {
    const sanitized = JSON.parse(JSON.stringify(workflowData));

    // Sanitize nodes
    if (sanitized.nodes) {
      sanitized.nodes = sanitized.nodes.map(node => {
        const cleanNode = { ...node };

        // Clean headers if they exist
        if (cleanNode.headers) {
          const cleanHeaders = {};
          Object.keys(cleanNode.headers).forEach(key => {
            const header = cleanNode.headers[key];

            // If header is a simple string, keep it as is
            if (typeof header === 'string') {
              cleanHeaders[key] = header;
            }
            // If header is an object with type property
            else if (header && typeof header === 'object' && header.type) {
              // Ensure type is a valid VAPI type
              const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
              if (!validTypes.includes(header.type)) {
                console.warn(`Invalid header type "${header.type}" for key "${key}", converting to string value`);
                // Convert to simple string value instead of object with invalid type
                cleanHeaders[key] = header.value || header.default || '';
              } else {
                cleanHeaders[key] = header;
              }
            }
            // For any other type, convert to string
            else {
              cleanHeaders[key] = String(header || '');
            }
          });
          cleanNode.headers = cleanHeaders;
        }

        // Clean apiRequestConfig headers
        if (cleanNode.apiRequestConfig && cleanNode.apiRequestConfig.headers) {
          const cleanApiHeaders = {};
          Object.keys(cleanNode.apiRequestConfig.headers).forEach(key => {
            const header = cleanNode.apiRequestConfig.headers[key];

            // If header is a simple string, keep it as is
            if (typeof header === 'string') {
              cleanApiHeaders[key] = header;
            }
            // If header is an object with type property
            else if (header && typeof header === 'object' && header.type) {
              const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
              if (!validTypes.includes(header.type)) {
                console.warn(`Invalid apiRequestConfig header type "${header.type}" for key "${key}", converting to string value`);
                // Convert to simple string value instead of object with invalid type
                cleanApiHeaders[key] = header.value || header.default || '';
              } else {
                cleanApiHeaders[key] = header;
              }
            }
            // For any other type, convert to string
            else {
              cleanApiHeaders[key] = String(header || '');
            }
          });
          cleanNode.apiRequestConfig.headers = cleanApiHeaders;
        }

        // Remove any UI-specific properties that shouldn't be sent to VAPI
        delete cleanNode.position;
        delete cleanNode.selected;
        delete cleanNode.dragging;

        return cleanNode;
      });
    }

    // Remove any local UI data
    delete sanitized.localData;
    delete sanitized.uiState;

    return sanitized;
  }

  // Validate workflow data before sending to VAPI
  validateWorkflowForVapi(workflowData) {
    const errors = [];
    const warnings = [];

    if (!workflowData.name) {
      errors.push('Workflow name is required');
    }

    if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
      errors.push('Workflow must have nodes array');
    } else {
      workflowData.nodes.forEach((node, index) => {
        // Validate node headers
        if (node.headers) {
          Object.keys(node.headers).forEach(key => {
            const header = node.headers[key];
            if (header && typeof header === 'object' && header.type) {
              const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
              if (!validTypes.includes(header.type)) {
                warnings.push(`Node ${index}: Invalid header type "${header.type}" for key "${key}"`);
              }
            }
          });
        }

        // Validate apiRequestConfig headers
        if (node.apiRequestConfig?.headers) {
          Object.keys(node.apiRequestConfig.headers).forEach(key => {
            const header = node.apiRequestConfig.headers[key];
            if (header && typeof header === 'object' && header.type) {
              const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
              if (!validTypes.includes(header.type)) {
                warnings.push(`Node ${index}: Invalid apiRequestConfig header type "${header.type}" for key "${key}"`);
              }
            }
          });
        }
      });
    }

    return { errors, warnings };
  }

  // Update workflow in Vapi
  async updateWorkflow(workflowId, workflowData) {
    try {
      console.log('Updating workflow in Vapi:', workflowId);

      // Validate workflow data first
      const validation = this.validateWorkflowForVapi(workflowData);
      if (validation.errors.length > 0) {
        throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
      }
      if (validation.warnings.length > 0) {
        console.warn('Workflow validation warnings:', validation.warnings);
      }

      // Sanitize the workflow data before sending to VAPI
      const sanitizedData = this.sanitizeWorkflowData(workflowData);
      console.log('Sanitized workflow data for VAPI:', JSON.stringify(sanitizedData, null, 2));

      const response = await this.client.patch(`/workflow/${workflowId}`, sanitizedData);

      console.log('Vapi workflow updated successfully:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('Error updating workflow in Vapi:', error.response?.data || error.message);

      // Log the sanitized data that caused the error for debugging
      if (error.response?.data?.message?.includes('nodes.headers.type')) {
        console.error('VAPI validation error - problematic data:', JSON.stringify(sanitizedData, null, 2));

        // Log specific node headers that might be causing issues
        if (sanitizedData.nodes) {
          sanitizedData.nodes.forEach((node, index) => {
            if (node.headers) {
              console.error(`Node ${index} headers:`, JSON.stringify(node.headers, null, 2));
            }
            if (node.apiRequestConfig?.headers) {
              console.error(`Node ${index} apiRequestConfig headers:`, JSON.stringify(node.apiRequestConfig.headers, null, 2));
            }
          });
        }
      }

      throw new Error(`Vapi API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Delete workflow from Vapi
  async deleteWorkflow(workflowId) {
    try {
      console.log('Deleting workflow from Vapi:', workflowId);

      await this.client.delete(`/workflow/${workflowId}`);

      console.log('Vapi workflow deleted successfully:', workflowId);
      return true;
    } catch (error) {
      console.error('Error deleting workflow from Vapi:', error.response?.data || error.message);
      throw new Error(`Vapi API Error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Test connection to Vapi
  async testConnection() {
    try {
      console.log('Testing Vapi connection...');

      // Try to list assistants as a simple test
      await this.client.get('/assistant?limit=1');

      console.log('✅ Vapi connection successful');
      return true;
    } catch (error) {
      console.error('❌ Vapi connection failed:', error.response?.data || error.message);
      return false;
    }
  }
}

module.exports = VapiService;
