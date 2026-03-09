-- Execute this SQL in Supabase Dashboard > SQL Editor
-- This adds the payment_type field to payment_requests table

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

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'payment_requests' AND column_name = 'payment_type';
