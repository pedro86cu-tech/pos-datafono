/*
  # Add NearPay Fields to Payment Gateways

  ## Changes
  
  Adds NearPay-specific configuration fields to the `payment_gateways` table:
  - `nearpay_email` (text) - Email for NearPay authentication
  - `nearpay_terminal_id` (text) - Optional Terminal ID for NearPay
  - `nearpay_environment` (text) - Environment (sandbox or production), defaults to sandbox

  ## Purpose
  
  These fields allow users to configure NearPay SDK for NFC payment processing
  directly from the app settings without needing separate configuration.
*/

-- Add NearPay configuration fields
ALTER TABLE payment_gateways
ADD COLUMN IF NOT EXISTS nearpay_email TEXT,
ADD COLUMN IF NOT EXISTS nearpay_terminal_id TEXT,
ADD COLUMN IF NOT EXISTS nearpay_environment TEXT DEFAULT 'sandbox';

-- Create index for faster lookups by gateway name
CREATE INDEX IF NOT EXISTS idx_payment_gateways_gateway_name 
ON payment_gateways(user_id, gateway_name, is_active);