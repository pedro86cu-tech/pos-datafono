-- Execute this SQL in Supabase Dashboard > SQL Editor
-- Step 1: Find your user_id
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- Step 2: Check if Mercado Pago is already configured
SELECT * FROM payment_gateways WHERE gateway_name = 'mercadopago';

-- Step 3: Insert Mercado Pago configuration
-- IMPORTANT: Replace BOTH values below:
--   1. 'YOUR_USER_ID_HERE' with the id from Step 1
--   2. 'YOUR_MERCADOPAGO_ACCESS_TOKEN' with your Access Token from https://www.mercadopago.com.uy/developers/panel

INSERT INTO payment_gateways (
  user_id,
  gateway_name,
  api_key,
  is_sandbox,
  is_active,
  created_at,
  updated_at
)
VALUES (
  'YOUR_USER_ID_HERE',  -- Replace with your user ID from Step 1
  'mercadopago',
  'YOUR_MERCADOPAGO_ACCESS_TOKEN',  -- Replace with your Mercado Pago Access Token (TEST-xxx)
  true,  -- true for test mode, false for production
  true,
  now(),
  now()
)
ON CONFLICT (user_id, gateway_name)
DO UPDATE SET
  api_key = EXCLUDED.api_key,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Step 4: Verify the configuration
SELECT id, user_id, gateway_name, is_active, is_sandbox,
       LEFT(api_key, 20) || '...' as api_key_preview,
       created_at
FROM payment_gateways
WHERE gateway_name = 'mercadopago';
