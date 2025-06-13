/*
  # Add Color and Size Attributes to Products
  
  1. Changes
    - Add color_images JSONB column to products table for storing color-specific images
    - Add available_sizes text[] column to products table
    - Add show_colors and show_sizes boolean flags to products table
    
  2. Security
    - Maintain existing RLS policies
    - No data loss
*/

-- Add color_images column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'color_images'
  ) THEN
    ALTER TABLE products 
    ADD COLUMN color_images JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add available_sizes column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'available_sizes'
  ) THEN
    ALTER TABLE products 
    ADD COLUMN available_sizes text[] DEFAULT '{}'::text[];
  END IF;
END $$;

-- Add show_colors flag if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'show_colors'
  ) THEN
    ALTER TABLE products 
    ADD COLUMN show_colors boolean DEFAULT false;
  END IF;
END $$;

-- Add show_sizes flag if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    AND column_name = 'show_sizes'
  ) THEN
    ALTER TABLE products 
    ADD COLUMN show_sizes boolean DEFAULT false;
  END IF;
END $$;

-- Update existing products to have default values
UPDATE products 
SET 
  color_images = COALESCE(color_images, '[]'::jsonb),
  available_sizes = COALESCE(available_sizes, '{}'::text[]),
  show_colors = COALESCE(show_colors, false),
  show_sizes = COALESCE(show_sizes, false);

-- Add selected_size to order_items table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'order_items' 
    AND column_name = 'selected_size'
  ) THEN
    ALTER TABLE order_items 
    ADD COLUMN selected_size text DEFAULT NULL;
  END IF;
END $$;