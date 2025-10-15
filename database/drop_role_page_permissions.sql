-- Drop role_page_permissions table and related data
-- This script removes all role page permission functionality from the database

-- First, drop the foreign key constraints to avoid issues
SET FOREIGN_KEY_CHECKS = 0;

-- Drop the role_page_permissions table if it exists
DROP TABLE IF EXISTS `role_page_permissions`;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Note: This script removes the role_page_permissions table completely
-- If you want to restore this functionality later, you'll need to recreate the table
-- and re-populate it with appropriate data
