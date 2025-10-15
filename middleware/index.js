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
const contactMessagesRoutes = require("./routes/ContactMessagesRoutes");

// Import audit log middleware
const auditLogMiddleware = require("./middleware/auditLogMiddleware");

dotenv.config({ path: "./config/config.env" });

// Trust proxy to get real client IP addresses
app.set('trust proxy', true);

app.use(express.json());
app.use(helmet());

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
app.use("/api/assistant", AssistantRoutes);
app.use("/api/outboundcall", outboundCallRoutes);
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
app.use("/api/squads", squadsRoutes);
app.use("/api/workflows", workflowRoutes);


app.use("/api/analytics", analyticsRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/webhooks", webhooksRoutes);
app.use("/api/webhook-data", webhookDataRoutes);
app.use("/api/recordings", recordingsRoutes);
app.use("/api/vapi", vapiRoutes);
app.use("/api/facebook", facebookRoutes);
app.use("/api/gmail", gmailRoutes);
app.use("/api/gmail-webhook", gmailWebhookRoutes);
app.use("/api/gmail-notifications", gmailNotificationRoutes);
app.use("/api/webhook-test", webhookTestRoutes);
app.use("/api/text-webhook", textWebhookTestRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/contacts", contactMessagesRoutes);

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
