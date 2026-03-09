-- Function to allow users to delete their own account from the client side
-- This is needed because supabase.auth.admin.deleteUser() requires a service role key
-- but we want the user to be able to trigger their own deletion from the app.

CREATE OR REPLACE FUNCTION delete_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to delete the user
SET search_path = public
AS $$
BEGIN
  -- We delete the user from auth.users. 
  -- Our schema uses ON DELETE CASCADE for profiles, predictions, and league_members,
  -- so those records will be automatically removed by PostgreSQL.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_data() TO authenticated;
