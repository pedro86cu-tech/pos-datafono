/*
  # Add payment_type field to payment_requests

  1. Changes
    - Add `payment_type` column to `payment_requests` table
    - Default value is 'card_debit' for backward compatibility

  2. Payment Types Supported
    - cash (Efectivo)
    - card_debit (Tarjeta Débito)
    - card_credit (Tarjeta Crédito)
    - transfer (Transferencia)
    - qr (QR/Billetera Digital)
    - check (Cheque)
    - credit_note (Nota de Crédito)
    - qr_mp (QR Mercado Pago)

  3. Notes
    - Uses IF NOT EXISTS to prevent errors on re-run
    - Maintains backward compatibility with existing records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_requests' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE payment_requests
    ADD COLUMN payment_type text DEFAULT 'card_debit';
  END IF;
END $$;
