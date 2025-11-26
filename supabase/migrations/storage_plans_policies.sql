CREATE POLICY authenticated_read_plans
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'plans');
