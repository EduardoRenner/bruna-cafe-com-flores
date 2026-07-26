-- Public read for product images
DROP POLICY IF EXISTS "Public read product-images" ON storage.objects;
CREATE POLICY "Public read product-images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

-- Deny writes from anon/authenticated; only service_role (admin) may mutate
DROP POLICY IF EXISTS "Deny insert product-images" ON storage.objects;
CREATE POLICY "Deny insert product-images"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny update product-images" ON storage.objects;
CREATE POLICY "Deny update product-images"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny delete product-images" ON storage.objects;
CREATE POLICY "Deny delete product-images"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (false);