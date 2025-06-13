/*
  # Add Custom Message Field to Orders Table
  
  1. Changes
    - Add custom_message column to orders table
    
  2. Purpose
    - Allow admins to add personalized messages to customers about their orders
    - These messages will be displayed to customers in their order details
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