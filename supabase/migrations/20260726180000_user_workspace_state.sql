-- Cloud source of truth for syncable workspace settings
CREATE TABLE IF NOT EXISTS public.user_workspace_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_workspace_state_updated_at_idx
  ON public.user_workspace_state (updated_at DESC);

ALTER TABLE public.user_workspace_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own workspace state" ON public.user_workspace_state;
CREATE POLICY "Users read own workspace state"
  ON public.user_workspace_state
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own workspace state" ON public.user_workspace_state;
CREATE POLICY "Users insert own workspace state"
  ON public.user_workspace_state
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own workspace state" ON public.user_workspace_state;
CREATE POLICY "Users update own workspace state"
  ON public.user_workspace_state
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.upsert_my_workspace_state(p_state jsonb)
RETURNS public.user_workspace_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.user_workspace_state;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_workspace_state AS u (user_id, state, revision, updated_at)
  VALUES (auth.uid(), COALESCE(p_state, '{}'::jsonb), 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET state = EXCLUDED.state,
        revision = u.revision + 1,
        updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_my_workspace_state(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_my_workspace_state(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_workspace_state()
RETURNS public.user_workspace_state
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.user_workspace_state
  WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_workspace_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_workspace_state() TO authenticated;
