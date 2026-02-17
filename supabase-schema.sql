-- Vehicle Inventory Management - Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Admin users table (for super admin login - you can also use Supabase Auth)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_id TEXT UNIQUE NOT NULL,
  plate_no TEXT UNIQUE NOT NULL,
  location TEXT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  body TEXT,
  details TEXT,
  color TEXT,
  mileage INTEGER,
  cc INTEGER,
  model_year INTEGER,
  fuel_type TEXT,
  gear TEXT,
  features JSONB DEFAULT '{}',
  sold BOOLEAN DEFAULT FALSE,
  reserved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Vehicle images (1-4 per vehicle)
CREATE TABLE IF NOT EXISTS vehicle_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create storage bucket for vehicle images (run in SQL Editor)
-- If this fails, create manually: Dashboard > Storage > New bucket > "vehicle-images" (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-images', 'vehicle-images', true) ON CONFLICT (id) DO NOTHING;
-- Storage policies for vehicle-images bucket
CREATE POLICY "Public read vehicle images" ON storage.objects FOR
SELECT USING (bucket_id = 'vehicle-images');
CREATE POLICY "Allow insert vehicle images" ON storage.objects FOR
INSERT WITH CHECK (bucket_id = 'vehicle-images');
CREATE POLICY "Allow delete vehicle images" ON storage.objects FOR DELETE USING (bucket_id = 'vehicle-images');
-- RLS for vehicles - allow all read for now (adjust for production)
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_images ENABLE ROW LEVEL SECURITY;
-- Allow public read on vehicles
CREATE POLICY "Public read vehicles" ON vehicles FOR
SELECT USING (true);
-- Allow insert/update/delete (for admin - in production, restrict by auth)
CREATE POLICY "Allow all vehicles" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read vehicle_images" ON vehicle_images FOR
SELECT USING (true);
CREATE POLICY "Allow all vehicle_images" ON vehicle_images FOR ALL USING (true) WITH CHECK (true);
-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_stock_id ON vehicles(stock_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_no ON vehicles(plate_no);
CREATE INDEX IF NOT EXISTS idx_vehicles_sold ON vehicles(sold);
CREATE INDEX IF NOT EXISTS idx_vehicles_reserved ON vehicles(reserved);
CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle_id ON vehicle_images(vehicle_id);