const axios = require("axios");
require("dotenv").config();

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

// List all squads
const listSquads = async (req, res) => {
  try {
    const response = await axios.get(`${VAPI_BASE_URL}/squad`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Squads retrieved successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error fetching squads:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch squads",
      error: error.response?.data || error.message
    });
  }
};

// Get squad by ID
const getSquad = async (req, res) => {
  try {
    const { id } = req.params;

    const response = await axios.get(`${VAPI_BASE_URL}/squad/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Squad retrieved successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error fetching squad:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to fetch squad",
      error: error.response?.data || error.message
    });
  }
};

// Create squad
const createSquad = async (req, res) => {
  try {
    const {
      name,
      description,
      members,
      membersOverrides
    } = req.body;

    if (!name || !members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Name and members array are required"
      });
    }

    const squadData = {
      name,
      description,
      members,
      membersOverrides
    };

    const response = await axios.post(
      `${VAPI_BASE_URL}/squad`,
      squadData,
      {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.status(201).json({
      success: true,
      message: "Squad created successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error creating squad:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to create squad",
      error: error.response?.data || error.message
    });
  }
};

// Update squad
const updateSquad = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const response = await axios.patch(
      `${VAPI_BASE_URL}/squad/${id}`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.status(200).json({
      success: true,
      message: "Squad updated successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error updating squad:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to update squad",
      error: error.response?.data || error.message
    });
  }
};

// Delete squad
const deleteSquad = async (req, res) => {
  try {
    const { id } = req.params;

    await axios.delete(`${VAPI_BASE_URL}/squad/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Squad deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting squad:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to delete squad",
      error: error.response?.data || error.message
    });
  }
};

// Add member to squad
const addMemberToSquad = async (req, res) => {
  try {
    const { id } = req.params;
    const { assistantId, assistant } = req.body;

    if (!assistantId && !assistant) {
      return res.status(400).json({
        success: false,
        message: "Either assistantId or assistant object is required"
      });
    }

    // Get current squad
    const squadResponse = await axios.get(`${VAPI_BASE_URL}/squad/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const currentSquad = squadResponse.data;
    const newMember = assistantId ? { assistantId } : { assistant };
    
    // Add new member to existing members
    const updatedMembers = [...(currentSquad.members || []), newMember];

    const updateData = {
      members: updatedMembers
    };

    const response = await axios.patch(
      `${VAPI_BASE_URL}/squad/${id}`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.status(200).json({
      success: true,
      message: "Member added to squad successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error adding member to squad:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to add member to squad",
      error: error.response?.data || error.message
    });
  }
};

// Remove member from squad
const removeMemberFromSquad = async (req, res) => {
  try {
    const { id, memberId } = req.params;

    // Get current squad
    const squadResponse = await axios.get(`${VAPI_BASE_URL}/squad/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const currentSquad = squadResponse.data;
    
    // Remove member from existing members
    const updatedMembers = (currentSquad.members || []).filter((member, index) => {
      return index.toString() !== memberId && 
             member.assistantId !== memberId &&
             member.assistant?.id !== memberId;
    });

    const updateData = {
      members: updatedMembers
    };

    const response = await axios.patch(
      `${VAPI_BASE_URL}/squad/${id}`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.status(200).json({
      success: true,
      message: "Member removed from squad successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error removing member from squad:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to remove member from squad",
      error: error.response?.data || error.message
    });
  }
};

module.exports = {
  listSquads,
  getSquad,
  createSquad,
  updateSquad,
  deleteSquad,
  addMemberToSquad,
  removeMemberFromSquad
};
