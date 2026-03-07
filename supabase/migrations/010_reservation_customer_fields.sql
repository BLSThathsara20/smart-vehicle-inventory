-- Migration 010: Customer reservation details (when reserved)
-- Required when status is Reserved: customer name, email, phone, deposit, etc.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deposit_agreement_url TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS carplay_included BOOLEAN;
