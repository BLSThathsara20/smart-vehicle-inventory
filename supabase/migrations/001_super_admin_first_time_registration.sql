-- Migration 001: Super Admin First-Time Registration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Use this if you already have vehicles/vehicle_images tables

-- Admins table for super admin (first-time only registration)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Allow read admins" ON admins;
DROP POLICY IF EXISTS "Allow first admin signup" ON admins;

-- Anyone can check if admins exist (to show Register vs Login)
CREATE POLICY "Allow read admins" ON admins FOR SELECT USING (true);

-- Only allow insert when no admins exist (first-time signup only)
-- Anon can insert so signup works before email confirmation
CREATE POLICY "Allow first admin signup" ON admins FOR INSERT
WITH CHECK ((SELECT COUNT(*) FROM admins) = 0);
