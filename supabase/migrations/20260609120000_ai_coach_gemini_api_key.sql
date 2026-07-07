-- AI Coach edge function: Vertex AI service account -> Gemini API key (GEMINI_API_KEY).
-- No schema changes. After applying this migration, update secrets and redeploy:
--   supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
--   supabase secrets unset GOOGLE_SERVICE_ACCOUNT_JSON GOOGLE_CLOUD_PROJECT_ID GOOGLE_CLOUD_LOCATION
--   supabase functions deploy ai-coach-chat
--   supabase functions deploy chat-with-groq

SELECT 1;
