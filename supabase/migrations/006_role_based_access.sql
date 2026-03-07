-- Migration 006: Role-Based Access Control (RBAC)
-- Roles, permissions, role_permissions, and user profiles

-- Permissions table: defines all possible permissions in the system
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role-Permissions: many-to-many (which permissions each role has)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Profiles: links auth users to roles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);

-- Enable RLS
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Permissions: anyone authenticated can read
CREATE POLICY "Auth read permissions" ON permissions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read roles" ON roles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read role_permissions" ON role_permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- Profiles: users can read own profile; super_admin can manage all
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);

-- Only super_admin can insert/update/delete roles, role_permissions, profiles
-- We check via a helper: user has 'roles:manage' permission
-- For simplicity, we'll use a function to check if user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.user_id = auth.uid() AND r.name = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "Super admin manage roles" ON roles FOR ALL USING (is_super_admin());
CREATE POLICY "Super admin manage role_permissions" ON role_permissions FOR ALL USING (is_super_admin());
CREATE POLICY "Super admin manage profiles" ON profiles FOR ALL USING (is_super_admin());

-- Super admin can also insert/update permissions (for future extensibility)
CREATE POLICY "Super admin manage permissions" ON permissions FOR ALL USING (is_super_admin());

-- Allow profile insert for first-time registration (when no profiles exist)
CREATE POLICY "First profile insert" ON profiles FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    (SELECT COUNT(*) FROM profiles) = 0
    OR is_super_admin()
  )
);

-- Allow profile update for own profile (e.g. when linking after first auth)
CREATE POLICY "Update own profile" ON profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Seed permissions (grouped by category)
INSERT INTO permissions (code, label, category, sort_order) VALUES
  ('inventory:view', 'View inventory', 'Inventory', 1),
  ('inventory:add', 'Add vehicles', 'Inventory', 2),
  ('inventory:edit', 'Edit vehicles', 'Inventory', 3),
  ('inventory:delete', 'Delete vehicles', 'Inventory', 4),
  ('search:view', 'Search vehicles', 'Search', 10),
  ('health:view', 'View app health', 'System', 20),
  ('space:view', 'View storage & space', 'System', 21),
  ('settings:view', 'View settings', 'System', 22),
  ('roles:manage', 'Manage roles & permissions', 'Admin', 30),
  ('users:manage', 'Manage users', 'Admin', 31)
ON CONFLICT (code) DO NOTHING;

-- Seed roles
INSERT INTO roles (name, description, is_system) VALUES
  ('super_admin', 'Full system access', true),
  ('admin', 'Administrative access', false),
  ('mechanic', 'Vehicle maintenance & inventory', false),
  ('viewer', 'Read-only access', false)
ON CONFLICT (name) DO NOTHING;

-- Super admin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin: all except users:manage (can add users:manage if needed)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code != 'users:manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Mechanic: inventory + search
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'mechanic'
AND p.code IN ('inventory:view', 'inventory:add', 'inventory:edit', 'search:view', 'settings:view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer: view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer'
AND p.code IN ('inventory:view', 'search:view', 'settings:view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Migrate existing admins to profiles (if admins table exists and has rows)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admins') THEN
    INSERT INTO profiles (user_id, role_id, email)
    SELECT au.id, r.id, a.email
    FROM admins a
    JOIN auth.users au ON au.email = a.email
    JOIN roles r ON r.name = 'super_admin'
    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = au.id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if admins or auth.users join fails
END $$;
