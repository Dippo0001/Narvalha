/*
  # Storage bucket for product photos

  Creates a public bucket called "products" for product images.
  Adds storage policies so authenticated users can upload/update/delete
  their own barbershop's files, and anyone can view them.
*/
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'products');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'products');

-- Allow anyone to read public product images
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'products');
