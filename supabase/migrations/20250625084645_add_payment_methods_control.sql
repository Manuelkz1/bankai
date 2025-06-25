/*
  # Add Payment Methods Control to Products

  1. Changes
    - Add `allowed_payment_methods` field to products table
    - This field will store an array of allowed payment methods for each product
    - Default will include both 'cod' (cash on delivery) and 'mercadopago'

  2. Migration Details
    - Adds new column: allowed_payment_methods text[]
    - Sets default value to include both payment methods
    - Updates existing products to have both payment methods enabled by default
*/

-- Add allowed_payment_methods column to products table
ALTER TABLE products 
ADD COLUMN allowed_payment_methods text[] DEFAULT '{"cod","mercadopago"}';

-- Update existing products to have both payment methods enabled by default
UPDATE products 
SET allowed_payment_methods = '{"cod","mercadopago"}' 
WHERE allowed_payment_methods IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN products.allowed_payment_methods IS 'Array of allowed payment methods for this product. Options: cod (cash on delivery), mercadopago';
