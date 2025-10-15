-- Add assistant_id column to workflows table for agent-workflow integration
ALTER TABLE workflows 
ADD COLUMN assistant_id VARCHAR(255) NULL AFTER org_id,
ADD INDEX idx_assistant_id (assistant_id);

-- Add assistant_id to the enhanced workflows table as well
ALTER TABLE workflows 
ADD COLUMN nodes JSON NULL AFTER description,
ADD COLUMN edges JSON NULL AFTER nodes,
ADD COLUMN model JSON NULL AFTER edges,
ADD COLUMN transcriber JSON NULL AFTER model,
ADD COLUMN voice JSON NULL AFTER transcriber,
ADD COLUMN global_prompt TEXT NULL AFTER voice,
ADD COLUMN background_sound VARCHAR(50) DEFAULT 'off' AFTER global_prompt,
ADD COLUMN credentials JSON NULL AFTER background_sound,
ADD COLUMN credential_ids JSON NULL AFTER credentials,
ADD COLUMN variables JSON NULL AFTER credential_ids,
ADD COLUMN triggers JSON NULL AFTER variables,
ADD COLUMN version VARCHAR(20) DEFAULT '1.0.0' AFTER status,
ADD COLUMN tags JSON NULL AFTER version,
ADD COLUMN execution_count INT DEFAULT 0 AFTER metadata,
ADD COLUMN vapi_workflow_id VARCHAR(255) NULL AFTER workflow_id,
ADD INDEX idx_vapi_workflow_id (vapi_workflow_id);

-- Update existing workflows to have default values
UPDATE workflows SET 
  nodes = JSON_ARRAY(),
  edges = JSON_ARRAY(),
  variables = JSON_OBJECT(),
  triggers = JSON_ARRAY(),
  tags = JSON_ARRAY()
WHERE nodes IS NULL;
