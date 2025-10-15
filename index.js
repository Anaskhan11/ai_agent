// index.js
const express = require("express");
const app = express();
const dotenv = require("dotenv");
const pool = require("./config/DBConnection");
const helmet = require("helmet");
const cors = require("cors");
const { swaggerUi, specs } = require("./config/swagger");
const userRoutes = require("./routes/userRoute/userRoute");
const roleRoutes = require("./routes/roleRoute/roleRoutes");
const contactRoutes = require("./routes/contactRoute/contactRoute");
const listRoutes = require("./routes/listRoute/listRoute");
const clinicalRoleRoutes = require("./routes/clinicalRoleRoute/clinicalRoleRoute");
const clinicalSiteRoutes = require("./routes/clinicalSiteRoute/clinicalSiteRoute");
const clinicalStudyRoutes = require("./routes/clinicalStudyRoute/clinicalStudyRoute");
const clinicalUserRoutes = require("./routes/clinicalUserRoute/clinicalUserRoute");
const studyParticipantRoutes = require("./routes/studyParticipantRoute/studyParticipantRoute");
const studyAssignmentRoutes = require("./routes/studyAssignmentRoute/studyAssignmentRoute");
const patientLeadRoutes = require("./routes/patientLeadRoute/patientLeadRoute");
const authRoutes = require("./routes/AuthRoutes/AuthRoutes");
const AssistantRoutes = require("./routes/AssistantRoutes/AssistantRoutes");
const outboundCallRoutes = require("./routes/outboundRoutes/outboundCallRoutes");
const transciber_voice_model_routes = require("./routes/transcriber_model_voices_routes/transcriber_model_voice_routes");

// RBAC Routes
const permissionRoutes = require("./routes/rbacRoutes/permissionRoutes");
const rolePermissionRoutes = require("./routes/rbacRoutes/rolePermissionRoutes");
const pagePermissionRoutes = require("./routes/rbacRoutes/pagePermissionRoutes");
const userPermissionRoutes = require("./routes/rbacRoutes/userPermissionRoutes");
const userRoleRoutes = require("./routes/rbacRoutes/userRoleRoutes");
const rolePagePermissionRoutes = require("./routes/rbacRoutes/rolePagePermissionRoutes");

// New VAPI Feature Routes
const modelsRoutes = require("./routes/ModelsRoutes/ModelsRoutes");
const voicesRoutes = require("./routes/VoicesRoutes/VoicesRoutes");
const transcribersRoutes = require("./routes/TranscribersRoutes/TranscribersRoutes");
const phoneNumbersRoutes = require("./routes/PhoneNumbersRoutes/PhoneNumbersRoutes");
const toolsRoutes = require("./routes/ToolsRoutes/ToolsRoutes");
const filesRoutes = require("./routes/FilesRoutes/FilesRoutes");
const knowledgeBasesRoutes = require("./routes/KnowledgeBasesRoutes/KnowledgeBasesRoutes");
const sessionsRoutes = require("./routes/SessionsRoutes/SessionsRoutes");
const chatsRoutes = require("./routes/ChatsRoutes/ChatsRoutes");
const squadsRoutes = require("./routes/SquadsRoutes/SquadsRoutes");
const workflowRoutes = require("./routes/WorkflowRoutes/WorkflowRoutes");

const analyticsRoutes = require("./routes/AnalyticsRoutes/AnalyticsRoutes");
const logsRoutes = require("./routes/LogsRoutes/LogsRoutes");
const webhooksRoutes = require("./routes/WebhooksRoutes/WebhooksRoutes");
const webhookDataRoutes = require("./routes/WebhookDataRoutes/WebhookDataRoutes");
const recordingsRoutes = require("./routes/RecordingsRoutes/RecordingsRoutes");
const vapiRoutes = require("./routes/vapi");
const facebookRoutes = require("./routes/FacebookRoutes/FacebookRoutes");
const gmailRoutes = require("./routes/GmailRoutes/GmailRoutes");
const gmailWebhookRoutes = require("./routes/GmailWebhookRoutes");
const gmailNotificationRoutes = require("./routes/GmailNotificationRoutes");
const webhookTestRoutes = require("./routes/WebhookTestRoutes/WebhookTestRoutes");
const textWebhookTestRoutes = require("./routes/TextWebhookTestRoutes");
const auditLogRoutes = require("./routes/AuditLogRoutes/AuditLogRoutes");
const supportRoutes = require("./routes/SupportRoutes/SupportRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes/DashboardRoutes");
const creditRoutes = require("./routes/creditRoutes");
const defaultAssistantTemplateRoutes = require("./routes/DefaultAssistantTemplateRoutes/DefaultAssistantTemplateRoutes");
const contactMessagesRoutes = require("./routes/ContactMessagesRoutes");
const twilioWebhookRoutes = require("./routes/TwilioWebhookRoutes");

// Import audit log middleware
const auditLogMiddleware = require("./middleware/auditLogMiddleware");

// Import credit middleware
const { blockZeroCredits } = require("./middleware/creditMiddleware");
const authMiddleware = require("./middleware/authMiddleware");

dotenv.config({ path: "./config/config.env" });

// Trust proxy to get real client IP addresses
app.set('trust proxy', true);

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For parsing Twilio webhook data

// Configure helmet with CSP that allows Stripe resources
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://js.stripe.com",
        "https://*.stripe.com",
        "https://maps.googleapis.com",
        "https://connect.facebook.net",
        "https://www.facebook.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://*.stripe.com"
      ],
      fontSrc: [
        "'self'",
        "data:",
        "https://fonts.gstatic.com",
        "https://js.stripe.com",
        "https://*.stripe.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https:",
        "http:",
        "https://*.stripe.com",
        "https://maps.gstatic.com",
        "https://maps.googleapis.com"
      ],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://*.stripe.com",
        "https://maps.googleapis.com",
        "https://graph.facebook.com",
        "https://www.facebook.com",
        "wss:",
        "ws:"
      ],
      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://hooks.stripe.com",
        "https://*.stripe.com",
        "https://www.facebook.com",
        "https://connect.facebook.net"
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "data:", "blob:"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable COEP for compatibility
}));

// Dynamic CORS configuration
app.use(cors({
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers"
  ]
}));

// Cache control middleware - prevent browser caching of API responses
app.use('/api', (req, res, next) => {
  // Set cache control headers to prevent caching
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`🔍 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log(`🔍 Origin: ${req.headers.origin || 'No origin'}`);
  console.log(`🔍 User-Agent: ${req.headers['user-agent'] || 'No user-agent'}`);
  next();
});

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  console.log(`🚀 OPTIONS request from origin: ${req.headers.origin}`);
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});


// Apply audit log middleware globally (before routes)
app.use(auditLogMiddleware);

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'VAPI Platform API Documentation'
}));

// Welcome route - redirect to API documentation
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api", contactRoutes);
app.use("/api/lists", listRoutes);
app.use("/api/clinical-roles", clinicalRoleRoutes);
app.use("/api/clinical-sites", clinicalSiteRoutes);
app.use("/api/clinical-studies", clinicalStudyRoutes);
app.use("/api/clinical-users", clinicalUserRoutes);
app.use("/api/study-participants", studyParticipantRoutes);
app.use("/api/study-assignments", studyAssignmentRoutes);
app.use("/api/patient-leads", patientLeadRoutes);

// Apply zero credit blocking to credit-consuming routes
// Exempt paths: credit management, auth, user management, and read-only operations
const creditExemptPaths = [
  '/api/auth',
  '/api/users',
  '/api/roles',
  '/api/credits',
  '/api/permissions',
  '/api/role-permissions',
  '/api/page-permissions',
  '/api/user-permissions',
  '/api/user-roles',
  '/api/role-page-permissions',
  // Assistant read operations (fetching agents should not require credits)
  '/api/assistant/get_all_assistants',
  '/api/assistant/get-synced-assistants',
  '/api/assistant/get-assistants',
  '/api/assistant/list-all-assistants-from-vapi',
  // Outbound read operations (viewing campaigns should not require credits)
  '/api/outboundcall/campaigns',
  '/api/outboundcall/getAllCalls',
  '/api/outboundcall/getCallsbyID',
  '/api/outboundcall/transcript',
  '/api/outboundcall/stats',
  '/api/outboundcall/recording',
  '/api/outboundcall/test-vapi',
  '/api/outboundcall/endCall', // Ending calls should not require credits
  '/endCall', // Alternative path format for endCall endpoint
  // Workflow read operations (viewing workflows should not require credits)
  // Note: Since middleware uses startsWith, we need to be careful about which paths to exempt
  // For now, we'll exempt the main workflows path and handle creation restrictions in the frontend
  '/api/workflows'
];

app.use("/api/assistant", authMiddleware, blockZeroCredits(creditExemptPaths), AssistantRoutes);
// Public proxy route for audio streaming (no auth required)
app.get("/api/outboundcall/recording/:id/proxy", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🎵 [Public] Proxying recording for call ID: ${id}`);

    const axios = require('axios');

    // First try to get from VAPI directly
    try {
      console.log(`🌐 [Public] Fetching call data from VAPI for ID: ${id}`);
      const vapiResponse = await axios.get(`https://api.vapi.ai/call/${id}`, {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const vapiCall = vapiResponse.data;
      console.log(`📞 [Public] VAPI call data:`, {
        id: vapiCall.id,
        status: vapiCall.status,
        hasRecording: !!vapiCall.recordingUrl,
        recordingUrl: vapiCall.recordingUrl ? 'Present' : 'Missing'
      });

      if (!vapiCall.recordingUrl) {
        console.log(`❌ [Public] No recording URL found in VAPI response for call ${id}`);
        return res.status(404).json({
          success: false,
          message: "Recording not found in VAPI"
        });
      }

      console.log(`🎵 [Public] Proxying recording from VAPI URL: ${vapiCall.recordingUrl.substring(0, 50)}...`);

      // Proxy the recording from VAPI
      const recordingResponse = await axios.get(vapiCall.recordingUrl, {
        responseType: 'stream',
        headers: {
          'User-Agent': 'AI-Cruitment-Proxy/1.0'
        },
        timeout: 30000 // 30 second timeout
      });

      console.log(`✅ [Public] Recording response headers:`, {
        contentType: recordingResponse.headers['content-type'],
        contentLength: recordingResponse.headers['content-length'],
        status: recordingResponse.status
      });

      // Set appropriate headers
      res.setHeader('Content-Type', recordingResponse.headers['content-type'] || 'audio/mpeg');
      if (recordingResponse.headers['content-length']) {
        res.setHeader('Content-Length', recordingResponse.headers['content-length']);
      }
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      // Handle client disconnect
      res.on('close', () => {
        console.log(`🔌 [Public] Client disconnected for call ${id}`);
        if (recordingResponse.data && recordingResponse.data.destroy) {
          recordingResponse.data.destroy();
        }
      });

      // Pipe the recording stream
      recordingResponse.data.pipe(res);

      recordingResponse.data.on('end', () => {
        console.log(`✅ [Public] Recording proxy completed for call ${id}`);
      });

      recordingResponse.data.on('error', (streamError) => {
        console.error(`❌ [Public] Recording stream error for call ${id}:`, streamError);
        // Don't try to send response if headers already sent
        if (!res.headersSent) {
          res.status(500).end();
        }
      });

    } catch (vapiError) {
      console.error(`❌ [Public] Error fetching recording from VAPI for call ${id}:`, {
        message: vapiError.message,
        status: vapiError.response?.status,
        statusText: vapiError.response?.statusText
      });

      return res.status(404).json({
        success: false,
        message: "Recording not available",
        details: vapiError.response?.status === 404 ? "Call not found in VAPI" : "VAPI error"
      });
    }

  } catch (error) {
    console.error(`❌ [Public] Error in proxy recording for call ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: "Failed to proxy recording",
      error: error.message
    });
  }
});

app.use("/api/outboundcall", authMiddleware, blockZeroCredits(creditExemptPaths), outboundCallRoutes);
app.use("/api/trans_voice_model", transciber_voice_model_routes);

// RBAC Routes
app.use("/api/permissions", permissionRoutes);
app.use("/api/role-permissions", rolePermissionRoutes);
app.use("/api/page-permissions", pagePermissionRoutes);
app.use("/api/user-permissions", userPermissionRoutes);
app.use("/api/user-roles", userRoleRoutes);
app.use("/api/role-page-permissions", rolePagePermissionRoutes);

// New VAPI Feature Routes
app.use("/api/models", modelsRoutes);
app.use("/api/voices", voicesRoutes);
app.use("/api/transcribers", transcribersRoutes);
app.use("/api/phone-numbers", phoneNumbersRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/knowledge-bases", knowledgeBasesRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/chats", chatsRoutes);
app.use("/api/squads", authMiddleware, blockZeroCredits(creditExemptPaths), squadsRoutes);
app.use("/api/workflows", authMiddleware, blockZeroCredits(creditExemptPaths), workflowRoutes);


app.use("/api/analytics", analyticsRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/webhooks", webhooksRoutes);
app.use("/api/webhook-data", webhookDataRoutes);
app.use("/api/recordings", recordingsRoutes);
app.use("/api/vapi", authMiddleware, blockZeroCredits(creditExemptPaths), vapiRoutes);
app.use("/api/facebook", facebookRoutes);
app.use("/api/gmail", gmailRoutes);
app.use("/api/gmail-webhook", gmailWebhookRoutes);
app.use("/api/gmail-notifications", gmailNotificationRoutes);
app.use("/api/webhook-test", webhookTestRoutes);
app.use("/api/text-webhook", textWebhookTestRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/credits", creditRoutes);
app.use("/api/default-assistant-templates", defaultAssistantTemplateRoutes);
app.use("/api/contact-messages", contactMessagesRoutes);
app.use("/api/twilio-webhook", twilioWebhookRoutes);

// Contact cleanup routes
const ContactCleanupController = require("./controller/ContactCleanupController");
app.get("/api/contacts/cleanup/preview", ContactCleanupController.previewContactsCleanup);
app.post("/api/contacts/cleanup", ContactCleanupController.cleanupContactsWithJSON);

app.get("/", (req, res) => {
  res.send("User Management API is running.");
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

const PORT = process.env.PORT;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    // Test database connection
    const connection = await pool.getConnection();
    console.log("MySQL Database connected successfully");
    connection.release(); // Release the connection back to the pool
  } catch (err) {
    console.error("Database connection error:", err);
  }
});
