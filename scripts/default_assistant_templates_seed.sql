-- Default Assistant Templates Seed Data
-- This script populates the database with initial default assistant templates

-- Insert default assistant templates
INSERT INTO default_assistant_templates (
  template_id, name, description, category,
  first_message, system_message, model, voice, transcriber,
  background_sound, max_duration_seconds, is_featured, sort_order, created_by
) VALUES

-- Customer Service Assistant
('customer-service', 'Customer Service Assistant', 'Professional customer service assistant for handling inquiries, complaints, and support requests', 'Business',
 'Hello! I''m your customer service assistant. How can I help you today?',
 'You are a professional customer service assistant. You are helpful, patient, and empathetic. Always listen carefully to customer concerns and provide clear, actionable solutions. If you cannot resolve an issue, offer to escalate to a human representative.',
 JSON_OBJECT(
   'provider', 'openai',
   'model', 'gpt-4',
   'temperature', 0.7,
   'maxTokens', 1000,
   'messages', JSON_ARRAY(
     JSON_OBJECT('role', 'system', 'content', 'You are a professional customer service assistant. You are helpful, patient, and empathetic.')
   )
 ),
 JSON_OBJECT(
   'provider', 'vapi',
   'voiceId', 'Cole',
   'speed', 1.0
 ),
 JSON_OBJECT(
   'provider', 'deepgram',
   'language', 'en',
   'confidenceThreshold', 0.4
 ),
 'office', 1800, TRUE, 1, 1),

-- Sales Assistant
('sales-assistant', 'Sales Assistant', 'Engaging sales assistant for lead qualification, product demos, and closing deals', 'Sales',
 'Hi there! I''m excited to help you learn more about our products and find the perfect solution for your needs. What brings you here today?',
 'You are an enthusiastic and knowledgeable sales assistant. Your goal is to understand customer needs, present relevant solutions, and guide them through the sales process. Be consultative, not pushy. Ask qualifying questions and provide value in every interaction.',
 JSON_OBJECT(
   'provider', 'openai',
   'model', 'gpt-4',
   'temperature', 0.8,
   'maxTokens', 1200,
   'messages', JSON_ARRAY(
     JSON_OBJECT('role', 'system', 'content', 'You are an enthusiastic and knowledgeable sales assistant focused on understanding customer needs.')
   )
 ),
 JSON_OBJECT(
   'provider', 'vapi',
   'voiceId', 'Sarah',
   'speed', 1.1
 ),
 JSON_OBJECT(
   'provider', 'deepgram',
   'language', 'en',
   'confidenceThreshold', 0.4
 ),
 'off', 2400, TRUE, 2, 1),

-- Appointment Scheduler
('appointment-scheduler', 'Appointment Scheduler', 'Efficient appointment booking assistant for scheduling meetings, consultations, and services', 'Scheduling',
 'Hello! I''m here to help you schedule an appointment. Let me check our availability and find the perfect time for you.',
 'You are an efficient appointment scheduling assistant. You help customers book appointments by checking availability, confirming details, and sending confirmations. Always be clear about dates, times, and requirements. Ask for necessary information like contact details and appointment purpose.',
 JSON_OBJECT(
   'provider', 'openai',
   'model', 'gpt-4',
   'temperature', 0.6,
   'maxTokens', 800,
   'messages', JSON_ARRAY(
     JSON_OBJECT('role', 'system', 'content', 'You are an efficient appointment scheduling assistant focused on booking and managing appointments.')
   )
 ),
 JSON_OBJECT(
   'provider', 'vapi',
   'voiceId', 'Emma',
   'speed', 1.0
 ),
 JSON_OBJECT(
   'provider', 'deepgram',
   'language', 'en',
   'confidenceThreshold', 0.4
 ),
 'office', 1200, TRUE, 3, 1),

-- Technical Support
('tech-support', 'Technical Support Assistant', 'Knowledgeable technical support assistant for troubleshooting and IT help', 'Support',
 'Hi! I''m your technical support assistant. I''m here to help you resolve any technical issues you''re experiencing. Can you describe the problem you''re facing?',
 'You are a knowledgeable technical support assistant. You help users troubleshoot technical problems with clear, step-by-step instructions. Always ask clarifying questions to understand the issue fully. Provide solutions in simple, non-technical language when possible.',
 JSON_OBJECT(
   'provider', 'openai',
   'model', 'gpt-4',
   'temperature', 0.5,
   'maxTokens', 1500,
   'messages', JSON_ARRAY(
     JSON_OBJECT('role', 'system', 'content', 'You are a knowledgeable technical support assistant who provides clear troubleshooting guidance.')
   )
 ),
 JSON_OBJECT(
   'provider', 'vapi',
   'voiceId', 'Alex',
   'speed', 0.9
 ),
 JSON_OBJECT(
   'provider', 'deepgram',
   'language', 'en',
   'confidenceThreshold', 0.4
 ),
 'off', 2400, TRUE, 4, 1),

-- General Assistant
('general-assistant', 'General Purpose Assistant', 'Versatile assistant for general inquiries and basic tasks', 'General',
 'Hello! I''m your AI assistant. I''m here to help with questions, provide information, and assist with various tasks. How can I help you today?',
 'You are a helpful and versatile AI assistant. You can help with a wide range of topics including answering questions, providing information, and assisting with basic tasks. Be friendly, informative, and concise in your responses.',
 JSON_OBJECT(
   'provider', 'openai',
   'model', 'gpt-4',
   'temperature', 0.7,
   'maxTokens', 1000,
   'messages', JSON_ARRAY(
     JSON_OBJECT('role', 'system', 'content', 'You are a helpful and versatile AI assistant.')
   )
 ),
 JSON_OBJECT(
   'provider', 'vapi',
   'voiceId', 'Cole',
   'speed', 1.0
 ),
 JSON_OBJECT(
   'provider', 'deepgram',
   'language', 'en',
   'confidenceThreshold', 0.4
 ),
 'off', 1800, FALSE, 5, 1);
