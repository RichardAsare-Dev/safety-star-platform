-- Fix missing grants and RLS policies for admin mutations

-- departments: allow anon to INSERT, UPDATE, DELETE
GRANT INSERT, UPDATE, DELETE ON public.departments TO anon, authenticated;
CREATE POLICY "Anyone can manage departments" ON public.departments
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- users_employees: allow anon to INSERT, UPDATE, DELETE
GRANT INSERT, UPDATE, DELETE ON public.users_employees TO anon, authenticated;
CREATE POLICY "Anyone can manage employees" ON public.users_employees
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- support_requests: allow anon to SELECT and DELETE
GRANT SELECT, DELETE ON public.support_requests TO anon, authenticated;
CREATE POLICY "Support requests are readable" ON public.support_requests
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can delete support requests" ON public.support_requests
  FOR DELETE TO anon, authenticated USING (true);

-- program_settings: allow anon to UPDATE
GRANT UPDATE ON public.program_settings TO anon, authenticated;
CREATE POLICY "Anyone can update settings" ON public.program_settings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- nominations: allow DELETE (for admin delete nomination)
GRANT DELETE ON public.nominations TO anon, authenticated;
CREATE POLICY "Anyone can delete a nomination" ON public.nominations
  FOR DELETE TO anon, authenticated USING (true);
