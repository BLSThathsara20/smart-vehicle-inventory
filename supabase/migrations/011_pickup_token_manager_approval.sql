-- Migration 011: Customer pickup URL token for reserved vehicles
-- Unique token allows customers to view their reserved vehicle status via /pickup/:token

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS pickup_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_vehicles_pickup_token ON vehicles(pickup_token) WHERE pickup_token IS NOT NULL;

-- Allow public read of reservation workflow for vehicles with pickup_token (customer page)
CREATE POLICY "Public read workflow for pickup vehicles" ON reservation_workflow_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vehicles v
      WHERE v.id = reservation_workflow_updates.vehicle_id
        AND v.reserved = true
        AND v.pickup_token IS NOT NULL
    )
  );
