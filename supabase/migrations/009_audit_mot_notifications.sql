-- Migration 009: Audit trail, MOT expiry, app notifications

-- MOT expiration date
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS mot_expiry_date DATE;

-- Audit fields for reservation workflow updates
ALTER TABLE reservation_workflow_updates ADD COLUMN IF NOT EXISTS updated_by_name TEXT;
ALTER TABLE reservation_workflow_updates ADD COLUMN IF NOT EXISTS device_info TEXT;

-- App notifications are generated dynamically from vehicles (delivery dates, PDI, MOT expiry)
