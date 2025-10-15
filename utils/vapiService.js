const axios = require("axios");
require("dotenv").config();

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

// Connection pool configuration
const axiosInstance = axios.create({
  baseURL: VAPI_BASE_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Authorization': `Bearer ${VAPI_SECRET_KEY}`,
    'Content-Type': 'application/json'
  },
  // Connection pooling
  maxRedirects: 3,
  maxContentLength: 50 * 1024 * 1024, // 50MB
});

// Request interceptor for logging and retry logic
axiosInstance.interceptors.request.use(
  (config) => {
    console.log(`🌐 VAPI Request: ${config.method?.toUpperCase()} ${config.url}`);
    config.metadata = { startTime: Date.now() };
    return config;
  },
  (error) => {
    console.error('❌ VAPI Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for logging and error handling
axiosInstance.interceptors.response.use(
  (response) => {
    const duration = Date.now() - response.config.metadata.startTime;
    console.log(`✅ VAPI Response: ${response.status} in ${duration}ms`);
    return response;
  },
  async (error) => {
    const duration = Date.now() - error.config.metadata.startTime;
    console.error(`❌ VAPI Error: ${error.response?.status || 'Network Error'} in ${duration}ms`);
    
    // Retry logic for specific errors
    if (error.response?.status === 429 || error.response?.status >= 500) {
      const retryCount = error.config.__retryCount || 0;
      if (retryCount < 3) {
        error.config.__retryCount = retryCount + 1;
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`🔄 Retrying VAPI request in ${delay}ms (attempt ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return axiosInstance(error.config);
      }
    }
    
    return Promise.reject(error);
  }
);

// Batch request utility
class VapiBatchProcessor {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.batchSize = 5;
    this.batchDelay = 100; // 100ms delay between batches
  }

  async addRequest(requestConfig) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        config: requestConfig,
        resolve,
        reject
      });
      
      if (!this.processing) {
        this.processBatch();
      }
    });
  }

  async processBatch() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      
      try {
        const promises = batch.map(item => 
          axiosInstance(item.config)
            .then(response => ({ success: true, data: response.data, item }))
            .catch(error => ({ success: false, error, item }))
        );
        
        const results = await Promise.all(promises);
        
        results.forEach(result => {
          if (result.success) {
            result.item.resolve(result.data);
          } else {
            result.item.reject(result.error);
          }
        });
        
        // Delay between batches to avoid rate limiting
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.batchDelay));
        }
        
      } catch (error) {
        // If batch processing fails, reject all items in the batch
        batch.forEach(item => item.reject(error));
      }
    }
    
    this.processing = false;
  }
}

const batchProcessor = new VapiBatchProcessor();

// VAPI Service Methods
const VapiService = {
  // Get all assistants
  async getAssistants(limit = 100) {
    try {
      const response = await axiosInstance.get('/assistant', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching assistants from VAPI:', error);
      throw error;
    }
  },

  // Get all calls with optional filtering by assistant IDs
  async getCalls(limit = 100, assistantIds = null) {
    try {
      const params = { limit };

      // If assistantIds is provided, we need to make multiple requests
      // since VAPI doesn't support filtering by multiple assistant IDs in one call
      if (assistantIds && assistantIds.length > 0) {
        console.log(`🔍 Fetching calls for ${assistantIds.length} assistants`);

        // Make parallel requests for each assistant ID
        const callPromises = assistantIds.map(assistantId =>
          axiosInstance.get('/call', {
            params: { limit: Math.ceil(limit / assistantIds.length), assistantId }
          }).catch(error => {
            console.warn(`Failed to fetch calls for assistant ${assistantId}:`, error.message);
            return { data: [] }; // Return empty array on error
          })
        );

        const responses = await Promise.all(callPromises);

        // Combine all calls and sort by creation date (newest first)
        const allCalls = responses
          .flatMap(response => response.data || [])
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, limit); // Limit total results

        console.log(`📞 Found ${allCalls.length} calls for user's assistants`);
        return allCalls;
      }

      // Default behavior - get all calls (for super admin)
      const response = await axiosInstance.get('/call', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching calls from VAPI:', error);
      throw error;
    }
  },

  // Get all phone numbers
  async getPhoneNumbers() {
    try {
      const response = await axiosInstance.get('/phone-number');
      return response.data;
    } catch (error) {
      console.error('Error fetching phone numbers from VAPI:', error);
      throw error;
    }
  },

  // Batch request method
  async batchRequest(requestConfig) {
    return batchProcessor.addRequest(requestConfig);
  },

  // Get multiple resources in parallel
  async getMultipleResources(resources) {
    const promises = resources.map(resource => {
      switch (resource) {
        case 'assistants':
          return this.getAssistants().catch(error => ({ error, resource }));
        case 'calls':
          return this.getCalls().catch(error => ({ error, resource }));
        case 'phoneNumbers':
          return this.getPhoneNumbers().catch(error => ({ error, resource }));
        default:
          return Promise.resolve({ error: new Error(`Unknown resource: ${resource}`), resource });
      }
    });

    const results = await Promise.all(promises);
    
    return results.reduce((acc, result, index) => {
      const resourceName = resources[index];
      if (result.error) {
        acc[resourceName] = { success: false, error: result.error.message, data: null };
      } else {
        acc[resourceName] = { success: true, error: null, data: result };
      }
      return acc;
    }, {});
  },

  // Health check
  async healthCheck() {
    try {
      const response = await axiosInstance.get('/assistant', { params: { limit: 1 } });
      return {
        status: 'healthy',
        responseTime: Date.now() - response.config.metadata.startTime,
        statusCode: response.status
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        statusCode: error.response?.status || 0
      };
    }
  }
};

module.exports = {
  VapiService,
  axiosInstance,
  batchProcessor
};
