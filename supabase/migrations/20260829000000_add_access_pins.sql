-- Add separate PIN columns for Admin and HOD Review access gates
ALTER TABLE public.program_settings
  ADD COLUMN IF NOT EXISTS admin_pin TEXT NOT NULL DEFAULT 'OHSE-ADMIN',
  ADD COLUMN IF NOT EXISTS hod_pin TEXT NOT NULL DEFAULT 'OHSE-HOD';
