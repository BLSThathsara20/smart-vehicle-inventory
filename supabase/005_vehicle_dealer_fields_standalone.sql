-- ============================================================
-- Car Dealer Professional - Extended Vehicle Fields
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Core Identification
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vin TEXT;

-- Media & Photography
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photographed BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photo_drive_link TEXT;

-- Listing & Advertising
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS service_record TEXT DEFAULT 'yes';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fb_listed BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS web_listed BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS web_url TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS autotrader_listed BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS autotrader_url TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ads_details TEXT;

-- Documentation
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS doc_status TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS shipment_no TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS shipment_arrived_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS key_no TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS iva_booked TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS v5c TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS v5c_send_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS v5c_received_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS mot_done BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS service_done BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS v55_registration_done BOOLEAN DEFAULT FALSE;

-- Sale & Reservation
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_status TEXT DEFAULT 'available';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS reserved_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(12,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS buyers_name TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS planned_collection_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS selling_price DECIMAL(12,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS warranty TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS wholesale_retail TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS plate_received BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ready_pullout BOOLEAN DEFAULT FALSE;

-- Pending & Work
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS pending_issues BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS pending_issues_details TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS battery_replaced BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS extra_parts TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS dial_ordered BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS body_work_required BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS media_system BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS reverse_camera BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS front_camera BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS front_sensor BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rear_sensor BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS spare_key BOOLEAN DEFAULT FALSE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_status ON vehicles(vehicle_status);
CREATE INDEX IF NOT EXISTS idx_vehicles_selling_price ON vehicles(selling_price);
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin) WHERE vin IS NOT NULL;
