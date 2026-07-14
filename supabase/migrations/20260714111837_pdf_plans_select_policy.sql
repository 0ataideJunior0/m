-- pdf_plans had RLS enabled with zero policies, silently denying all reads
-- (including the anon SELECT grant) and breaking .single() lookups in the app.
CREATE POLICY "Anyone can view pdf_plans"
ON pdf_plans
FOR SELECT
USING (true);
