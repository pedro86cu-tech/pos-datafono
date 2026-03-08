-- Create Payment Requests System
--
-- Overview:
-- This migration creates the infrastructure for the POS app to receive and process
-- payment requests from external systems (e.g., web apps, e-commerce platforms).
--
-- New Tables:
--   - payment_requests: Stores incoming payment requests from external systems
--
-- Security:
--   - Enable RLS on payment_requests table
--   - Users can only see their own payment requests
--   - External systems can create requests via authenticated Edge Function

CREATE TABLE IF NOT EXISTS payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  external_sale_id text,
  amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'USD' NOT NULL,
  customer_name text,
  customer_email text,
  note text,
  items jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  callback_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  processed_at timestamptz,
  expires_at timestamptz
);

-- Enable RLS
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment requests
CREATE POLICY "Users can view own payment requests"
  ON payment_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update status of their own payment requests
CREATE POLICY "Users can update own payment requests"
  ON payment_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert payment requests (for Edge Functions)
CREATE POLICY "Service role can insert payment requests"
  ON payment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at ON payment_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_requests_user_status ON payment_requests(user_id, status);