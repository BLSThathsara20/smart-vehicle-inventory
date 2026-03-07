-- Migration 007: User management and account settings
-- Add display_name to profiles, policies for users:manage

-- Add display_name to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Helper: user has users:manage permission
CREATE OR REPLACE FUNCTION has_users_manage()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    JOIN role_permissions rp ON rp.role_id = p.role_id
    JOIN permissions perm ON perm.id = rp.permission_id
    WHERE p.user_id = auth.uid() AND perm.code = 'users:manage'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Users with users:manage can read all profiles
CREATE POLICY "Users manage read all profiles" ON profiles FOR SELECT
USING (has_users_manage());

-- Users with users:manage can update other users' profiles (role, display_name)
CREATE POLICY "Users manage update profiles" ON profiles FOR UPDATE
USING (has_users_manage());

-- Users with users:manage can insert profiles (when adding new users)
CREATE POLICY "Users manage insert profiles" ON profiles FOR INSERT
WITH CHECK (has_users_manage());

-- Add users:manage to admin role so admins can manage users
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code = 'users:manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
