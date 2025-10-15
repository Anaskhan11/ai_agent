const axios = require('axios');
const CallModel = require('../model/CallModel/CallModel');

/**
 * Sync recording URLs from VAPI for calls that don't have them
 */
async function syncRecordingsFromVAPI() {
  try {
    console.log('🎵 Starting recording sync from VAPI...');

    // Get all ended calls without recording URLs
    const callsNeedingRecordings = await CallModel.getCalls(1, 100, {
      status: 'ended',
      missing_recording: true
    });

    if (!callsNeedingRecordings.calls || callsNeedingRecordings.calls.length === 0) {
      console.log('✅ No calls need recording sync');
      return { synced: 0, errors: 0 };
    }

    console.log(`📞 Found ${callsNeedingRecordings.calls.length} calls needing recording sync`);

    let syncedCount = 0;
    let errorCount = 0;

    // Process each call
    for (const call of callsNeedingRecordings.calls) {
      try {
        await syncSingleCallRecording(call.call_id || call.id);
        syncedCount++;
        console.log(`✅ Synced recording for call ${call.call_id || call.id}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to sync recording for call ${call.call_id || call.id}:`, error.message);
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🎵 Recording sync completed: ${syncedCount} synced, ${errorCount} errors`);
    return { synced: syncedCount, errors: errorCount };

  } catch (error) {
    console.error('❌ Error in recording sync:', error);
    throw error;
  }
}

/**
 * Sync recording for a single call
 */
async function syncSingleCallRecording(callId) {
  try {
    // Fetch call details from VAPI
    const vapiResponse = await axios.get(`https://api.vapi.ai/call/${callId}`, {
      headers: {
        Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const vapiCall = vapiResponse.data;

    // Check if VAPI has a recording URL
    if (vapiCall.recordingUrl) {
      // Update our database with the recording URL
      await CallModel.updateCall(callId, { 
        recording_url: vapiCall.recordingUrl,
        updated_at: new Date()
      });

      return { success: true, recordingUrl: vapiCall.recordingUrl };
    } else {
      return { success: false, reason: 'No recording URL in VAPI response' };
    }

  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`📞 Call ${callId} not found in VAPI`);
      return { success: false, reason: 'Call not found in VAPI' };
    }
    throw error;
  }
}

/**
 * Sync recording for a specific call (used by webhook or manual trigger)
 */
async function syncCallRecording(callId) {
  try {
    const result = await syncSingleCallRecording(callId);
    
    if (result.success) {
      console.log(`✅ Successfully synced recording for call ${callId}`);
      return result;
    } else {
      console.log(`⚠️ No recording available for call ${callId}: ${result.reason}`);
      return result;
    }
  } catch (error) {
    console.error(`❌ Error syncing recording for call ${callId}:`, error.message);
    throw error;
  }
}

/**
 * Schedule periodic recording sync (can be called by cron job)
 */
function scheduleRecordingSync(intervalMinutes = 30) {
  console.log(`⏰ Scheduling recording sync every ${intervalMinutes} minutes`);
  
  setInterval(async () => {
    try {
      await syncRecordingsFromVAPI();
    } catch (error) {
      console.error('❌ Scheduled recording sync failed:', error);
    }
  }, intervalMinutes * 60 * 1000);
}

module.exports = {
  syncRecordingsFromVAPI,
  syncSingleCallRecording,
  syncCallRecording,
  scheduleRecordingSync
};
