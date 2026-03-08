/*
  # POS System Schema

  ## Overview
  This migration creates the complete database schema for a mobile POS (Point of Sale) system
  with NFC payment capabilities, payment gateway integration, and transaction management.

  ## New Tables

  ### 1. `payment_gateways`
  Stores payment gateway configurations for each user
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `gateway_name` (text) - Name of the gateway (mercadopago, dlocal, etc.)
  - `api_key` (text) - Encrypted API key
  - `api_secret` (text) - Encrypted API secret
  - `is_active` (boolean) - Whether this gateway is currently active
  - `is_sandbox` (boolean) - Whether using sandbox/test environment
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `pos_configurations`
  Stores POS configuration including origin system settings
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `origin_system_url` (text) - URL of the origin system
  - `origin_system_api_key` (text) - API key for origin system
  - `business_name` (text) - Business name
  - `business_id` (text) - Business identification number
  - `currency` (text) - Default currency (USD, COP, etc.)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `transactions`
  Records all payment transactions
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `gateway_id` (uuid, references payment_gateways)
  - `amount` (numeric) - Transaction amount
  - `currency` (text) - Transaction currency
  - `status` (text) - pending, completed, failed, cancelled
  - `payment_method` (text) - nfc_card, manual, qr, etc.
  - `card_last_four` (text) - Last 4 digits of card
  - `card_brand` (text) - Visa, Mastercard, etc.
  - `transaction_reference` (text) - Gateway transaction ID
  - `error_message` (text) - Error message if failed
  - `invoice_number` (text) - Invoice/reference from origin system
  - `metadata` (jsonb) - Additional transaction data
  - `created_at` (timestamptz)
  - `completed_at` (timestamptz)

  ## Security

  - RLS enabled on all tables
  - Users can only access their own data
  - Authenticated users only
*/

-- Create payment_gateways table
CREATE TABLE IF NOT EXISTS payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  gateway_name text NOT NULL,
  api_key text NOT NULL,
  api_secret text,
  is_active boolean DEFAULT false,
  is_sandbox boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create pos_configurations table
CREATE TABLE IF NOT EXISTS pos_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  origin_system_url text,
  origin_system_api_key text,
  business_name text NOT NULL,
  business_id text,
  currency text DEFAULT 'USD',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  gateway_id uuid REFERENCES payment_gateways(id) ON DELETE SET NULL,
  amount numeric(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  payment_method text DEFAULT 'nfc_card',
  card_last_four text,
  card_brand text,
  transaction_reference text,
  error_message text,
  invoice_number text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable RLS
ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_gateways
CREATE POLICY "Users can view own payment gateways"
  ON payment_gateways FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment gateways"
  ON payment_gateways FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment gateways"
  ON payment_gateways FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment gateways"
  ON payment_gateways FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for pos_configurations
CREATE POLICY "Users can view own pos configuration"
  ON pos_configurations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pos configuration"
  ON pos_configurations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pos configuration"
  ON pos_configurations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pos configuration"
  ON pos_configurations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for transactions
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_gateways_user_id ON payment_gateways(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_gateways_active ON payment_gateways(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pos_configurations_user_id ON pos_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(user_id, created_at DESC);