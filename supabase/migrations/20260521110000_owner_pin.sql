-- Add owner_pin column to barbershops
-- This is a separate credential from the Supabase auth password.
-- Used only for the "Entrar como dono" gate on the BarberLock screen.
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS owner_pin text;
