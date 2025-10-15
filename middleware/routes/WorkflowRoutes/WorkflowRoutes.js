const express = require("express");
const workflowController = require("../../controller/WorkflowController/WorkflowController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// List all workflows
router.get("/", authMiddleware, workflowController.listWorkflows);

// Get workflow by ID
router.get("/:id", authMiddleware, workflowController.getWorkflow);

// Create workflow
router.post("/", authMiddleware, workflowController.createWorkflow);

// Update workflow
router.patch("/:id", authMiddleware, workflowController.updateWorkflow);

// Delete workflow
router.delete("/:id", authMiddleware, workflowController.deleteWorkflow);

// Test workflow (create call)
router.post("/:id/test", authMiddleware, workflowController.testWorkflow);

// Get workflow templates
router.get("/templates/all", authMiddleware, workflowController.getWorkflowTemplates);

// VAPI-specific routes
router.post("/vapi", authMiddleware, workflowController.createVapiWorkflow);
router.get("/vapi/:id", authMiddleware, workflowController.getVapiWorkflow);
router.patch("/vapi/:id", authMiddleware, workflowController.updateVapiWorkflow);
router.delete("/vapi/:id", authMiddleware, workflowController.deleteVapiWorkflow);
router.post("/vapi/calls", authMiddleware, workflowController.createVapiCall);
router.get("/vapi/calls", authMiddleware, workflowController.listVapiCalls);
router.get("/vapi/calls/:callId", authMiddleware, workflowController.getVapiCall);
router.post("/vapi/calls/:callId/end", authMiddleware, workflowController.endVapiCall);
router.post("/vapi/validate", authMiddleware, workflowController.validateVapiWorkflow);

// VAPI Assistant routes
router.post("/vapi/assistants", authMiddleware, workflowController.createVapiAssistant);
router.get("/vapi/assistants/:assistantId", authMiddleware, workflowController.getVapiAssistant);



module.exports = router;
