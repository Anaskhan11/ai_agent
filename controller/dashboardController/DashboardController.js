const axios = require("axios");
const AssistantModel = require("../../model/AssistantModel/AssistantModel");
const PhoneNumberModel = require("../../model/PhoneNumberModel/PhoneNumberModel");
const { VapiService } = require("../../utils/vapiService");
require("dotenv").config();

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

// Enhanced cache for dashboard data (in production, use Redis)
const dashboardCache = new Map();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
const MAX_CACHE_SIZE = 100; // Maximum number of cached entries

// Cache cleanup function
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of dashboardCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      dashboardCache.delete(key);
    }
  }

  // If cache is still too large, remove oldest entries
  if (dashboardCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(dashboardCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, dashboardCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => dashboardCache.delete(key));
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupCache, 5 * 60 * 1000);

// Get comprehensive dashboard data in a single API call
const getDashboardData = async (req, res) => {
  try {
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;
    const cacheKey = `dashboard_${currentUserId}_${isSuperAdmin}`;

    // Check cache first
    const cachedData = dashboardCache.get(cacheKey);
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
      console.log("📦 Returning cached dashboard data");
      return res.status(200).json({
        success: true,
        message: "Dashboard data retrieved successfully (cached)",
        data: cachedData.data,
        cached: true
      });
    }

    console.log("🔄 Fetching fresh dashboard data...");

    // Use optimized VAPI service for parallel API calls
    const [
      agentsResult,
      callsResult,
      phoneNumbersResult,
      modelStatsResult,
      voiceStatsResult,
      vapiHealthResult
    ] = await Promise.allSettled([
      fetchAgentsData(currentUserId, isSuperAdmin),
      fetchCallsDataOptimized(currentUserId, isSuperAdmin),
      fetchPhoneNumbersData(currentUserId, isSuperAdmin),
      fetchModelStats(currentUserId, isSuperAdmin),
      fetchVoiceStats(currentUserId, isSuperAdmin),
      VapiService.healthCheck()
    ]);

    // Process results and handle errors gracefully
    const dashboardData = {
      agents: processResult(agentsResult, "agents"),
      calls: processResult(callsResult, "calls"),
      phoneNumbers: processResult(phoneNumbersResult, "phoneNumbers"),
      modelStats: processResult(modelStatsResult, "modelStats"),
      voiceStats: processResult(voiceStatsResult, "voiceStats"),
      vapiHealth: processResult(vapiHealthResult, "vapiHealth"),
      summary: {
        totalAgents: 0,
        totalCalls: 0,
        totalPhoneNumbers: 0,
        avgCallDuration: 0,
        successRate: "0%"
      }
    };

    // Calculate summary metrics
    if (dashboardData.agents.success) {
      dashboardData.summary.totalAgents = dashboardData.agents.data?.assistants?.length || dashboardData.agents.data?.length || 0;
    }

    if (dashboardData.calls.success) {
      const callsData = dashboardData.calls.data;
      dashboardData.summary.totalCalls = callsData?.totalCalls || callsData?.length || 0;
      dashboardData.summary.avgCallDuration = callsData?.averageDuration || 0;
      
      if (callsData?.successfulCalls && callsData?.totalCalls) {
        dashboardData.summary.successRate = ((callsData.successfulCalls / callsData.totalCalls) * 100).toFixed(1) + "%";
      }
    }

    if (dashboardData.phoneNumbers.success) {
      dashboardData.summary.totalPhoneNumbers = dashboardData.phoneNumbers.data?.length || 0;
    }

    // Cache the result
    dashboardCache.set(cacheKey, {
      data: dashboardData,
      timestamp: Date.now()
    });

    res.status(200).json({
      success: true,
      message: "Dashboard data retrieved successfully",
      data: dashboardData,
      cached: false
    });

  } catch (error) {
    console.error("❌ Error fetching dashboard data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
      error: error.message
    });
  }
};

// Helper function to fetch agents data
async function fetchAgentsData(userId, isSuperAdmin) {
  try {
    const userIdFilter = isSuperAdmin ? null : userId;
    const { data: localAssistants } = await AssistantModel.getAssistants(1, 50, "", userIdFilter);
    
    return {
      assistants: localAssistants || [],
      total: localAssistants?.length || 0
    };
  } catch (error) {
    console.error("Error fetching agents:", error);
    throw error;
  }
}

// Helper function to fetch calls data with stats (original)
async function fetchCallsData() {
  try {
    // Fetch calls and stats in parallel
    const [callsResponse, statsResponse] = await Promise.allSettled([
      axios.get(`${VAPI_BASE_URL}/call`, {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }),
      // Mock stats for now - replace with actual stats endpoint
      Promise.resolve({
        data: {
          totalCalls: 0,
          successfulCalls: 0,
          averageDuration: 0
        }
      })
    ]);

    const calls = callsResponse.status === 'fulfilled' ? callsResponse.value.data : [];
    const stats = statsResponse.status === 'fulfilled' ? statsResponse.value.data : {
      totalCalls: calls.length,
      successfulCalls: calls.filter(call => call.status === 'ended').length,
      averageDuration: 0
    };

    return {
      calls: calls,
      totalCalls: stats.totalCalls || calls.length,
      successfulCalls: stats.successfulCalls || calls.filter(call => call.status === 'ended').length,
      averageDuration: stats.averageDuration || 0,
      length: calls.length
    };
  } catch (error) {
    console.error("Error fetching calls:", error);
    throw error;
  }
}

// Optimized helper function to fetch calls data using VapiService
async function fetchCallsDataOptimized(userId, isSuperAdmin) {
  try {
    console.log("🚀 Using optimized VAPI service for calls data");

    let calls = [];

    if (isSuperAdmin) {
      // Super admin sees all calls
      console.log("👑 Super admin - fetching all calls");
      calls = await VapiService.getCalls(100);
    } else if (userId) {
      // Regular user - only see calls from their assistants
      console.log(`👤 Regular user ${userId} - fetching calls for user's assistants`);

      // First, get user's assistants to get their assistant_ids (VAPI UUIDs)
      const userAgentsData = await fetchAgentsData(userId, false);
      const userAssistants = userAgentsData?.assistants || [];

      if (userAssistants.length === 0) {
        console.log("📭 User has no assistants - returning empty calls data");
        return {
          calls: [],
          totalCalls: 0,
          successfulCalls: 0,
          averageDuration: 0,
          length: 0
        };
      }

      // Extract assistant_ids (VAPI UUIDs) from user's assistants
      const assistantIds = userAssistants
        .map(assistant => assistant.assistant_id)
        .filter(id => id); // Filter out null/undefined assistant_ids

      console.log(`🔍 Found ${assistantIds.length} assistant IDs for user:`, assistantIds);

      if (assistantIds.length === 0) {
        console.log("📭 User's assistants have no VAPI IDs - returning empty calls data");
        return {
          calls: [],
          totalCalls: 0,
          successfulCalls: 0,
          averageDuration: 0,
          length: 0
        };
      }

      // Fetch calls filtered by user's assistant IDs
      calls = await VapiService.getCalls(100, assistantIds);
    } else {
      console.log("⚠️ No user ID provided - returning empty calls data");
      return {
        calls: [],
        totalCalls: 0,
        successfulCalls: 0,
        averageDuration: 0,
        length: 0
      };
    }

    // Calculate stats from the calls data
    const endedCalls = calls.filter(call => call.status === 'ended');
    const totalDuration = endedCalls.reduce((sum, call) => sum + (call.duration || 0), 0);
    const avgDuration = endedCalls.length > 0 ? Math.round(totalDuration / endedCalls.length) : 0;

    console.log(`📊 Dashboard calls summary: ${calls.length} total, ${endedCalls.length} successful, ${avgDuration}s avg duration`);

    return {
      calls: calls,
      totalCalls: calls.length,
      successfulCalls: endedCalls.length,
      averageDuration: avgDuration,
      length: calls.length
    };
  } catch (error) {
    console.error("Error fetching calls with optimized service:", error);
    // Fallback to original method
    console.log("🔄 Falling back to original calls fetch method");
    return fetchCallsData();
  }
}

// Helper function to fetch phone numbers data
async function fetchPhoneNumbersData(userId, isSuperAdmin) {
  try {
    const phoneNumbers = await PhoneNumberModel.getAllPhoneNumbers(userId, isSuperAdmin);
    return phoneNumbers || [];
  } catch (error) {
    console.error("Error fetching phone numbers:", error);
    throw error;
  }
}

// Helper function to fetch model stats
async function fetchModelStats(userId, isSuperAdmin) {
  try {
    // For now, return empty stats for regular users and mock data for super admin
    // In the future, this could be calculated from actual usage data
    if (isSuperAdmin) {
      return {
        totalRequests: 1250,
        totalTokens: 125000,
        averageResponseTime: 850,
        topModels: [
          { model: "gpt-4o", usage: 45, provider: "openai" },
          { model: "claude-3-5-sonnet-20241022", usage: 30, provider: "anthropic" },
          { model: "gpt-3.5-turbo", usage: 25, provider: "openai" }
        ],
        costBreakdown: {
          openai: 45.50,
          anthropic: 32.25,
          groq: 8.75,
          total: 86.50
        }
      };
    } else {
      // Regular users see empty stats until they have actual usage
      return {
        totalRequests: 0,
        totalTokens: 0,
        averageResponseTime: 0,
        topModels: [],
        costBreakdown: {
          openai: 0,
          anthropic: 0,
          groq: 0,
          total: 0
        }
      };
    }
  } catch (error) {
    console.error("Error fetching model stats:", error);
    throw error;
  }
}

// Helper function to fetch voice stats
async function fetchVoiceStats(userId, isSuperAdmin) {
  try {
    // For now, return empty stats for regular users and mock data for super admin
    // In the future, this could be calculated from actual usage data
    if (isSuperAdmin) {
      return {
        totalSynthesis: 890,
        totalCharacters: 125000,
        averageLatency: 320,
        topVoices: [
          { voice: "Rachel", usage: 35, provider: "11labs" },
          { voice: "Sarah", usage: 28, provider: "openai" },
          { voice: "Alloy", usage: 22, provider: "openai" }
        ],
        costBreakdown: {
          "11labs": 28.50,
          "openai": 15.25,
          "azure": 8.75,
          total: 52.50
        }
      };
    } else {
      // Regular users see empty stats until they have actual usage
      return {
        totalSynthesis: 0,
        totalCharacters: 0,
        averageLatency: 0,
        topVoices: [],
        costBreakdown: {
          "11labs": 0,
          "openai": 0,
          "azure": 0,
          total: 0
        }
      };
    }
  } catch (error) {
    console.error("Error fetching voice stats:", error);
    throw error;
  }
}

// Helper function to process Promise.allSettled results
function processResult(result, dataType) {
  if (result.status === 'fulfilled') {
    return {
      success: true,
      data: result.value,
      error: null
    };
  } else {
    console.error(`Error fetching ${dataType}:`, result.reason);
    return {
      success: false,
      data: null,
      error: result.reason.message || `Failed to fetch ${dataType}`
    };
  }
}

// Clear dashboard cache (for manual cache invalidation)
const clearDashboardCache = async (req, res) => {
  try {
    const cacheSize = dashboardCache.size;
    dashboardCache.clear();
    res.status(200).json({
      success: true,
      message: "Dashboard cache cleared successfully",
      clearedEntries: cacheSize
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to clear dashboard cache",
      error: error.message
    });
  }
};

// Get cache statistics
const getCacheStats = async (req, res) => {
  try {
    const now = Date.now();
    const cacheEntries = Array.from(dashboardCache.entries()).map(([key, value]) => ({
      key,
      age: Math.round((now - value.timestamp) / 1000), // age in seconds
      expired: (now - value.timestamp) > CACHE_DURATION
    }));

    res.status(200).json({
      success: true,
      message: "Cache statistics retrieved successfully",
      data: {
        totalEntries: dashboardCache.size,
        maxSize: MAX_CACHE_SIZE,
        cacheDuration: CACHE_DURATION / 1000, // in seconds
        entries: cacheEntries
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get cache statistics",
      error: error.message
    });
  }
};

// Invalidate specific user's cache
const invalidateUserCache = async (req, res) => {
  try {
    const { userId } = req.params;
    let deletedCount = 0;

    for (const [key] of dashboardCache.entries()) {
      if (key.includes(userId)) {
        dashboardCache.delete(key);
        deletedCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Cache invalidated for user ${userId}`,
      deletedEntries: deletedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to invalidate user cache",
      error: error.message
    });
  }
};

module.exports = {
  getDashboardData,
  clearDashboardCache,
  getCacheStats,
  invalidateUserCache
};
