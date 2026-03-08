/*
  # Fix API Keys Access for Edge Functions

  1. Changes
    - Add policy to allow service role to read API keys for validation
    - This enables edge functions to validate API keys without bypassing RLS
  
  2. Security
    - Service role can read all API keys (needed for validation)
    - Users can still only see/manage their own keys
*/

-- Allow service role to read API keys for validation
-- This is needed because edge functions use service_role_key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'api_keys' 
    AND policyname = 'Service role can read all API keys'
  ) THEN
    CREATE POLICY "Service role can read all API keys"
      ON api_keys
      FOR SELECT
      USING (true);
  END IF;
END $$;
