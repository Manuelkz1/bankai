/*
  # Add Custom Message Field to Orders
  
  1. Changes
    - Add custom_message column to orders table
    
  2. Purpose
    - Allow administrators to add personalized messages to customers about their orders
    - Improve communication between admin and customers
*/

-- Add custom_message column to orders table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'custom_message'
  ) THEN
    ALTER TABLE orders ADD COLUMN custom_message text;
  END IF;
END $$;