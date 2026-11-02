-- Lock down profiles.is_admin
-- The "Users can update own profile" / "Users can manage own profile" RLS
-- policies have no column restriction, so a signed-in user could set
-- is_admin = true on their own row. This trigger stops anon/authenticated
-- callers from ever changing is_admin:
--   * INSERT: is_admin is forced to false.
--   * UPDATE: is_admin keeps its old value (silently, so existing client
--     upserts that send is_admin: false don't fail or demote an admin).
-- service_role and direct database access (auth.role() is null) can still
-- grant or revoke admin.

CREATE OR REPLACE FUNCTION public.protect_profile_is_admin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_admin := false;
    ELSE
      NEW.is_admin := OLD.is_admin;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_is_admin ON public.profiles;
CREATE TRIGGER tr_protect_profile_is_admin
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_is_admin();
