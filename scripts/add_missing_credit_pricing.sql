-- Add missing credit pricing entries for phone number creation, campaign launch, and assistant creation

-- Insert credit pricing for phone number creation (5 credits)
INSERT INTO credit_pricing (operation_type, unit_type, credits_per_unit, description) VALUES
('phone_number_creation', 'per_operation', 5.00, 'Phone number creation/purchase')
ON DUPLICATE KEY UPDATE 
credits_per_unit = VALUES(credits_per_unit),
description = VALUES(description),
updated_at = CURRENT_TIMESTAMP;

-- Insert credit pricing for campaign launch (3 credits)
INSERT INTO credit_pricing (operation_type, unit_type, credits_per_unit, description) VALUES
('campaign_launch', 'per_launch', 3.00, 'Campaign launch operation')
ON DUPLICATE KEY UPDATE 
credits_per_unit = VALUES(credits_per_unit),
description = VALUES(description),
updated_at = CURRENT_TIMESTAMP;

-- Insert credit pricing for assistant creation (2 credits)
INSERT INTO credit_pricing (operation_type, unit_type, credits_per_unit, description) VALUES
('assistant_creation', 'per_operation', 2.00, 'AI assistant creation')
ON DUPLICATE KEY UPDATE 
credits_per_unit = VALUES(credits_per_unit),
description = VALUES(description),
updated_at = CURRENT_TIMESTAMP;

-- Also add phone_number_purchase if it doesn't exist (same as phone_number_creation)
INSERT INTO credit_pricing (operation_type, unit_type, credits_per_unit, description) VALUES
('phone_number_purchase', 'per_operation', 5.00, 'Phone number purchase operation')
ON DUPLICATE KEY UPDATE 
credits_per_unit = VALUES(credits_per_unit),
description = VALUES(description),
updated_at = CURRENT_TIMESTAMP;

-- Verify the entries were added
SELECT operation_type, unit_type, credits_per_unit, description, is_active 
FROM credit_pricing 
WHERE operation_type IN ('phone_number_creation', 'campaign_launch', 'assistant_creation', 'phone_number_purchase')
ORDER BY operation_type;
