-- Execute this SQL in Supabase Dashboard > SQL Editor
-- This migration adds missing columns to the database

/*
  Migration Steps:
  1. Add payment_type field to payment_requests table
  2. Add payment_request_id field to transactions table
*/

-- Step 1: Add payment_type to payment_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_requests' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE payment_requests
    ADD COLUMN payment_type text DEFAULT 'card_debit';

    RAISE NOTICE 'Column payment_type added successfully';
  ELSE
    RAISE NOTICE 'Column payment_type already exists';
  END IF;
END $$;

-- Step 2: Add payment_request_id to transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'payment_request_id'
  ) THEN
    ALTER TABLE transactions
    ADD COLUMN payment_request_id uuid REFERENCES payment_requests(id) ON DELETE SET NULL;

    RAISE NOTICE 'Column payment_request_id added successfully';
  ELSE
    RAISE NOTICE 'Column payment_request_id already exists';
  END IF;
END $$;

-- Create index for better performance on payment_request_id lookups
CREATE INDEX IF NOT EXISTS idx_transactions_payment_request_id
ON transactions(payment_request_id);

-- Verify all columns were added
SELECT 'payment_requests' as table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'payment_requests' AND column_name = 'payment_type'
UNION ALL
SELECT 'transactions' as table_name, column_name, data_type, column_default::text
FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'payment_request_id';
