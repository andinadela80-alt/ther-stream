CREATE TABLE public.kageon_requests (source_id uuid PRIMARY KEY, source_kind text NOT NULL CHECK (source_kind IN ('post','comment')), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE, status text NOT NULL DEFAULT 'processing', reply_id uuid REFERENCES public.post_comments(id) ON DELETE SET NULL, error text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.kageon_requests TO authenticated;
GRANT ALL ON public.kageon_requests TO service_role;
ALTER TABLE public.kageon_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY kageon_request_owner ON public.kageon_requests FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE TABLE public.kageon_service_state (id text PRIMARY KEY, pause_reason text, paused_at timestamptz);
GRANT ALL ON public.kageon_service_state TO service_role;
ALTER TABLE public.kageon_service_state ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.protect_kageon_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF current_user NOT IN ('service_role','postgres','supabase_admin') THEN
  IF lower(coalesce(NEW.username,''))='kageon' OR (TG_OP='UPDATE' AND lower(coalesce(OLD.username,''))='kageon') THEN RAISE EXCEPTION 'This username is reserved.'; END IF;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER protect_kageon_identity BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_kageon_identity();
CREATE OR REPLACE FUNCTION public.complete_kageon_request(p_source uuid,p_bot uuid,p_content text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.kageon_requests; cid uuid; BEGIN
 SELECT * INTO r FROM public.kageon_requests WHERE source_id=p_source FOR UPDATE;
 IF r.source_id IS NULL OR r.status<>'processing' THEN RAISE EXCEPTION 'Request is not active'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_bot AND username='kageon') THEN RAISE EXCEPTION 'Invalid bot'; END IF;
 INSERT INTO public.post_comments(post_id,author_id,content) VALUES(r.post_id,p_bot,p_content) RETURNING id INTO cid;
 UPDATE public.kageon_requests SET status='completed',reply_id=cid WHERE source_id=p_source; RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.complete_kageon_request(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_kageon_request(uuid,uuid,text) TO service_role;