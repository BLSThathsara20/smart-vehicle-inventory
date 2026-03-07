-- Migration 008: Reservation workflow for reserved vehicles
-- Step-by-step status tracking with comments

CREATE TABLE IF NOT EXISTS reservation_workflow_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  step_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'done',
  comment TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reservation_workflow_vehicle ON reservation_workflow_updates(vehicle_id);

ALTER TABLE reservation_workflow_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read reservation workflow" ON reservation_workflow_updates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth insert reservation workflow" ON reservation_workflow_updates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth update reservation workflow" ON reservation_workflow_updates
  FOR UPDATE USING (auth.uid() IS NOT NULL);
