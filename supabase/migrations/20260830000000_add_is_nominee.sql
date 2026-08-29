ALTER TABLE public.users_employees
  ADD COLUMN IF NOT EXISTS is_nominee BOOLEAN NOT NULL DEFAULT false;
