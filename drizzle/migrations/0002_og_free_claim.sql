ALTER TABLE public.verified_badges ADD COLUMN IF NOT EXISTS og_free_claimed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.og_claim_status()
RETURNS TABLE(used int, claimed boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (SELECT count(*)::int FROM verified_badges WHERE og_free_claimed),
         COALESCE((SELECT og FROM verified_badges WHERE user_id = auth.uid()), false)
$$;

CREATE OR REPLACE FUNCTION public.claim_og_badge()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int; me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  PERFORM pg_advisory_xact_lock(424242);
  IF EXISTS (SELECT 1 FROM verified_badges WHERE user_id = me AND og) THEN RETURN 'already'; END IF;
  SELECT count(*) INTO n FROM verified_badges WHERE og_free_claimed;
  IF n >= 50 THEN RAISE EXCEPTION 'All 50 OG badges have been claimed'; END IF;
  INSERT INTO verified_badges(user_id, verified_until, og, og_free_claimed, updated_at)
  VALUES (me, now(), true, true, now())
  ON CONFLICT (user_id) DO UPDATE SET og = true, og_free_claimed = true, updated_at = now();
  RETURN 'ok';
END $$;

REVOKE ALL ON FUNCTION public.claim_og_badge() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.og_claim_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_og_badge() TO authenticated;
GRANT EXECUTE ON FUNCTION public.og_claim_status() TO authenticated;