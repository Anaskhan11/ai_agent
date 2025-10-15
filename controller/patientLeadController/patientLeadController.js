const PatientLeadModel = require('../../model/patientLeadModel/patientLeadModel');

// Create initial patient lead (from webhook/contact - 3 basic fields)
const createPatientLead = async (req, res) => {
  try {
    const leadData = req.body;
    
    // Validate required fields
    if (!leadData.first_name || !leadData.last_name || !leadData.email) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and email are required'
      });
    }

    const patientLead = await PatientLeadModel.createPatientLead(leadData);
    
    res.status(201).json({
      success: true,
      data: patientLead,
      message: 'Patient lead created successfully'
    });
  } catch (error) {
    console.error('Error creating patient lead:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create patient lead',
      error: error.message
    });
  }
};

// Update patient with extended form data (19 additional fields)
const updatePatientExtendedForm = async (req, res) => {
  try {
    const { id } = req.params;
    const extendedData = req.body;

    const updatedPatient = await PatientLeadModel.updatePatientExtendedForm(id, extendedData);
    
    if (!updatedPatient) {
      return res.status(404).json({
        success: false,
        message: 'Patient lead not found'
      });
    }

    res.status(200).json({
      success: true,
      data: updatedPatient,
      message: 'Patient extended form updated successfully'
    });
  } catch (error) {
    console.error('Error updating patient extended form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update patient extended form',
      error: error.message
    });
  }
};

// Get patient lead by ID
const getPatientLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    const patientLead = await PatientLeadModel.getPatientLeadById(id);
    
    if (!patientLead) {
      return res.status(404).json({
        success: false,
        message: 'Patient lead not found'
      });
    }

    res.status(200).json({
      success: true,
      data: patientLead,
      message: 'Patient lead retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching patient lead:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient lead',
      error: error.message
    });
  }
};

// Get all patient leads with filtering and pagination
const getAllPatientLeads = async (req, res) => {
  try {
    const filters = {
      patient_status: req.query.patient_status,
      qualified_status: req.query.qualified_status,
      patient_lead_source: req.query.patient_lead_source,
      patient_lead_owner_id: req.query.patient_lead_owner_id,
      study_id: req.query.study_id,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
      search: req.query.search
    };

    const result = await PatientLeadModel.getAllPatientLeads(filters);

    res.status(200).json({
      success: true,
      data: result.patients,
      pagination: result.pagination,
      message: 'Patient leads retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching patient leads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient leads',
      error: error.message
    });
  }
};

// Enroll patient in study
const enrollPatientInStudy = async (req, res) => {
  try {
    const { id } = req.params;
    const { study_id, ...enrollmentData } = req.body;

    if (!study_id) {
      return res.status(400).json({
        success: false,
        message: 'Study ID is required for enrollment'
      });
    }

    const enrolledPatient = await PatientLeadModel.enrollPatientInStudy(
      id, 
      study_id, 
      { ...enrollmentData, enrolled_by: req.user?.id }
    );
    
    if (!enrolledPatient) {
      return res.status(404).json({
        success: false,
        message: 'Patient lead not found'
      });
    }

    res.status(200).json({
      success: true,
      data: enrolledPatient,
      message: 'Patient enrolled in study successfully'
    });
  } catch (error) {
    console.error('Error enrolling patient in study:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enroll patient in study',
      error: error.message
    });
  }
};

// Update patient status
const updatePatientStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { patient_status, qualified_status, not_interested_reasons } = req.body;

    // This is a simplified status update - you might want to create a separate method in the model
    const patientLead = await PatientLeadModel.getPatientLeadById(id);
    
    if (!patientLead) {
      return res.status(404).json({
        success: false,
        message: 'Patient lead not found'
      });
    }

    // Update the patient status using the extended form method (reusing the logic)
    const updatedPatient = await PatientLeadModel.updatePatientExtendedForm(id, {
      qualified_status,
      not_interested_reasons,
      // Keep existing data
      patient_lead_name: patientLead.patient_lead_name,
      phone_2: patientLead.phone_2,
      date_of_birth: patientLead.date_of_birth,
      age: patientLead.age,
      height: patientLead.height,
      weight_lbs: patientLead.weight_lbs,
      habits: patientLead.habits,
      medications: patientLead.medications,
      diagnosis: patientLead.diagnosis,
      surgeries: patientLead.surgeries,
      banned: patientLead.banned
    });

    res.status(200).json({
      success: true,
      data: updatedPatient,
      message: 'Patient status updated successfully'
    });
  } catch (error) {
    console.error('Error updating patient status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update patient status',
      error: error.message
    });
  }
};

// Get patient lead statistics
const getPatientLeadStats = async (req, res) => {
  try {
    const filters = {
      patient_lead_owner_id: req.query.patient_lead_owner_id,
      study_id: req.query.study_id
    };

    const stats = await PatientLeadModel.getPatientLeadStats(filters);
    
    res.status(200).json({
      success: true,
      data: stats,
      message: 'Patient lead statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching patient lead stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient lead statistics',
      error: error.message
    });
  }
};

// Get patients available for study enrollment
const getAvailablePatientsForStudy = async (req, res) => {
  try {
    const filters = {
      qualified_status: 'qualified',
      patient_status: 'screening',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    const result = await PatientLeadModel.getAllPatientLeads(filters);
    
    res.status(200).json({
      success: true,
      data: result.patients,
      pagination: result.pagination,
      message: 'Available patients for study enrollment retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching available patients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available patients',
      error: error.message
    });
  }
};

module.exports = {
  createPatientLead,
  updatePatientExtendedForm,
  getPatientLeadById,
  getAllPatientLeads,
  enrollPatientInStudy,
  updatePatientStatus,
  getPatientLeadStats,
  getAvailablePatientsForStudy
};
