-- =============================================================
-- CRITICAL SECURITY FIX: Remove dangerous anon (public) policies
-- The public booking feature was removed from the UI but the
-- database policies were still allowing anonymous access to
-- client data (LGPD violation) and unrestricted inserts.
-- =============================================================

-- 1. CLIENTS: remove full anon read/write access
DROP POLICY IF EXISTS "public select clients by phone for booking" ON clients;
DROP POLICY IF EXISTS "public insert clients for booking" ON clients;

-- 2. APPOINTMENTS: remove anon insert and read
DROP POLICY IF EXISTS "public insert appointments for booking" ON appointments;
DROP POLICY IF EXISTS "public read appointments for availability" ON appointments;

-- 3. APPOINTMENT_SERVICES: remove anon insert
DROP POLICY IF EXISTS "public insert appointment_services" ON appointment_services;

-- 4. SERVICES / BARBERS / WORKING_HOURS: remove anon read
--    (no public booking page exists anymore)
DROP POLICY IF EXISTS "public read services by slug" ON services;
DROP POLICY IF EXISTS "public read barbers by slug" ON barbers;
DROP POLICY IF EXISTS "public read working_hours" ON working_hours;

-- 5. PUBLIC_BARBERSHOPS view: revoke anon access
REVOKE SELECT ON public_barbershops FROM anon;
