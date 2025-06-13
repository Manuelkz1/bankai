/*
  # Add Phone Authentication Toggle to Company Settings
  
  1. Changes
    - Add phone_auth_enabled column to company_settings table
    - Set default value to true for backward compatibility
    - Update existing records to have this setting enabled by default
    
  2. Security
    - No changes to security policies needed
    - Existing RLS policies for company_settings apply to this new column
*/

-- Add phone_auth_enabled column if it doesn't exist
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS phone_auth_enabled boolean DEFAULT true;

-- Update existing records to have phone auth enabled by default
UPDATE company_settings 
SET phone_auth_enabled = true
WHERE phone_auth_enabled IS NULL;