-- Migration: Make user_id nullable in phone_numbers table
-- This allows phone numbers to be unassigned (user_id = NULL)

-- Step 1: Modify the user_id column to allow NULL values
ALTER TABLE phone_numbers 
MODIFY COLUMN user_id INT NULL;

-- Step 2: Add an index for better performance on user_id queries
-- (This will help with queries that filter by user_id)
CREATE INDEX IF NOT EXISTS idx_phone_numbers_user_id_nullable ON phone_numbers(user_id);

-- Step 3: Update any existing records that might have invalid user_id values
-- (Optional: Set user_id to NULL for any records with user_id = 0 or invalid user IDs)
UPDATE phone_numbers 
SET user_id = NULL 
WHERE user_id = 0 OR user_id NOT IN (SELECT id FROM users);

-- Verification query (run this to check the change worked)
-- SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'phone_numbers' AND COLUMN_NAME = 'user_id';
