const axios = require("axios");

class VapiService {
  constructor() {
    this.baseURL = process.env.VAPI_BASE_URL || "https://api.vapi.ai";
    this.apiKey = process.env.VAPI_SECRET_KEY;
    
    if (!this.apiKey) {
      console.warn("VAPI_SECRET_KEY not found in environment variables");
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      timeout: 30000
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`VAPI Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error("VAPI Request Error:", error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`VAPI Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error("VAPI Response Error:", error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Workflow Management
  async createWorkflow(workflowData) {
    try {
      const response = await this.client.post("/workflow", workflowData);
      return response.data;
    } catch (error) {
      console.error("Error creating VAPI workflow:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  async getWorkflow(workflowId) {
    try {
      const response = await this.client.get(`/workflow/${workflowId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching VAPI workflow:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  async updateWorkflow(workflowId, workflowData) {
    try {
      const response = await this.client.patch(`/workflow/${workflowId}`, workflowData);
      return response.data;
    } catch (error) {
      console.error("Error updating VAPI workflow:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  async deleteWorkflow(workflowId) {
    try {
      const response = await this.client.delete(`/workflow/${workflowId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting VAPI workflow:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  async listWorkflows(params = {}) {
    try {
      const response = await this.client.get("/workflow", { params });
      return response.data;
    } catch (error) {
      console.error("Error listing VAPI workflows:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  // Call Management
  async createCall(callData) {
    try {
      const response = await this.client.post("/call", callData);
      return response.data;
    } catch (error) {
      console.error("Error creating VAPI call:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  async getCall(callId) {
    try {
      const response = await this.client.get(`/call/${callId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching VAPI call:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  async listCalls(params = {}) {
    try {
      const response = await this.client.get("/call", { params });
      return response.data;
    } catch (error) {
      console.error("Error listing VAPI calls:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  // Phone Number Management
  async listPhoneNumbers() {
    try {
      const response = await this.client.get("/phone-number");
      return response.data;
    } catch (error) {
      console.error("Error listing VAPI phone numbers:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  // Assistant Management (for compatibility)
  async createAssistant(assistantData) {
    try {
      const response = await this.client.post("/assistant", assistantData);
      return response.data;
    } catch (error) {
      console.error("Error creating VAPI assistant:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  async getAssistant(assistantId) {
    try {
      const response = await this.client.get(`/assistant/${assistantId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching VAPI assistant:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  async updateAssistant(assistantId, assistantData) {
    try {
      const response = await this.client.patch(`/assistant/${assistantId}`, assistantData);
      return response.data;
    } catch (error) {
      console.error("Error updating VAPI assistant:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  async deleteAssistant(assistantId) {
    try {
      const response = await this.client.delete(`/assistant/${assistantId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting VAPI assistant:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  async listAssistants(params = {}) {
    try {
      const response = await this.client.get("/assistant", { params });
      return response.data;
    } catch (error) {
      console.error("Error listing VAPI assistants:", error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  // Utility Methods
  validateWorkflow(workflowData) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!workflowData.name) {
      errors.push("Workflow name is required");
    }

    if (!workflowData.nodes || workflowData.nodes.length === 0) {
      errors.push("Workflow must have at least one node");
    }

    // Check for start node
    const startNodes = workflowData.nodes?.filter(node => node.isStart) || [];
    if (startNodes.length === 0) {
      errors.push("Workflow must have exactly one start node");
    } else if (startNodes.length > 1) {
      errors.push("Workflow can only have one start node");
    }

    // Check node connections
    if (workflowData.nodes && workflowData.nodes.length > 1) {
      const nodeNames = workflowData.nodes.map(node => node.name);
      const connectedNodes = new Set();
      
      workflowData.edges?.forEach(edge => {
        connectedNodes.add(edge.from);
        connectedNodes.add(edge.to);
        
        if (!nodeNames.includes(edge.from)) {
          errors.push(`Edge references non-existent node: ${edge.from}`);
        }
        if (!nodeNames.includes(edge.to)) {
          errors.push(`Edge references non-existent node: ${edge.to}`);
        }
      });

      // Check for orphaned nodes (except start node)
      workflowData.nodes.forEach(node => {
        if (!node.isStart && !connectedNodes.has(node.name)) {
          warnings.push(`Node "${node.name}" is not connected to any other nodes`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Error handling
  handleError(error) {
    if (error.response) {
      // VAPI API error response
      return {
        status: error.response.status,
        message: error.response.data?.message || "VAPI API error",
        details: error.response.data,
        type: "VAPI_API_ERROR"
      };
    } else if (error.request) {
      // Network error
      return {
        status: 500,
        message: "Network error connecting to VAPI",
        details: error.message,
        type: "NETWORK_ERROR"
      };
    } else {
      // Other error
      return {
        status: 500,
        message: error.message || "Unknown error",
        details: error,
        type: "UNKNOWN_ERROR"
      };
    }
  }

  // Health check
  async healthCheck() {
    try {
      // Try to list workflows as a health check
      await this.listWorkflows({ limit: 1 });
      return { status: "healthy", timestamp: new Date().toISOString() };
    } catch (error) {
      return { 
        status: "unhealthy", 
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new VapiService();
