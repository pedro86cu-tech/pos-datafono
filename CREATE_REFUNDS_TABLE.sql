/*
  # Create refunds table

  1. New Tables
    - `refunds`
      - `id` (uuid, primary key)
      - `transaction_id` (uuid, foreign key to transactions)
      - `payment_id` (text, Mercado Pago payment ID)
      - `refund_id` (text, Mercado Pago refund ID)
      - `amount` (decimal, refund amount)
      - `status` (text, refund status)
      - `reason` (text, refund reason)
      - `gateway_response` (jsonb, full response from Mercado Pago)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `refunds` table
    - Add policies for authenticated users to read their own refunds
*/

-- Create refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  payment_id text NOT NULL,
  refund_id text NOT NULL,
  amount decimal(10, 2) NOT NULL DEFAULT 0,
  status text NOT NULL,
  reason text,
  gateway_response jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view refunds for their transactions"
  ON refunds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = refunds.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );

-- Service role has full access to refunds
CREATE POLICY "Service role has full access to refunds"
  ON refunds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_refunds_transaction_id ON refunds(transaction_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_refund_id ON refunds(refund_id);
