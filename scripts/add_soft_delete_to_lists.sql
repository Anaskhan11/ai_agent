-- Migration script to add soft delete functionality to lists table
-- This script adds is_deleted and deleted_at columns to existing lists table

-- Add is_deleted column if it doesn't exist
ALTER TABLE lists 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Add deleted_at column if it doesn't exist
ALTER TABLE lists 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Add index for is_deleted column for better query performance
ALTER TABLE lists 
ADD INDEX IF NOT EXISTS idx_is_deleted (is_deleted);

-- Update existing records to ensure they have is_deleted = FALSE
UPDATE lists SET is_deleted = FALSE WHERE is_deleted IS NULL;

-- Show the updated table structure
DESCRIBE lists;
