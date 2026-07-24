
-- 1. admin_login_attempts: add explicit restrictive deny policies for anon/authenticated.
-- SECURITY DEFINER function verify_admin_login continues to write via definer privileges.
CREATE POLICY "Deny public read admin_login_attempts" ON public.admin_login_attempts
  FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny public insert admin_login_attempts" ON public.admin_login_attempts
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny public update admin_login_attempts" ON public.admin_login_attempts
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete admin_login_attempts" ON public.admin_login_attempts
  FOR DELETE TO anon, authenticated USING (false);

-- 2. orders: explicit deny policies for UPDATE/DELETE from anon/authenticated.
-- Admin mutations go through server functions using the service role (bypass RLS).
CREATE POLICY "Deny public update orders" ON public.orders
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public delete orders" ON public.orders
  FOR DELETE TO anon, authenticated USING (false);

-- 3. product-images bucket: remove the broad SELECT policy that allowed
-- listing all objects. Public GET via public bucket URL keeps working.
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
