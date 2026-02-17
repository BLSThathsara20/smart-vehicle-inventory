-- Migration 002: Restrict vehicle writes to authenticated users only
-- Public can READ, only logged-in users can INSERT/UPDATE/DELETE
-- Run in Supabase SQL Editor if you want to secure writes

-- Drop existing permissive "allow all" policies
DROP POLICY IF EXISTS "Allow all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow all vehicle_images" ON vehicle_images;

-- Vehicles: add auth-only write (read already exists)
CREATE POLICY "Auth insert vehicles" ON vehicles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update vehicles" ON vehicles FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete vehicles" ON vehicles FOR DELETE USING (auth.uid() IS NOT NULL);

-- Vehicle images: add auth-only write
CREATE POLICY "Auth insert vehicle_images" ON vehicle_images FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update vehicle_images" ON vehicle_images FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete vehicle_images" ON vehicle_images FOR DELETE USING (auth.uid() IS NOT NULL);
