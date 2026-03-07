-- Migration 013: Allow users with users:manage to delete profiles
-- (Super admin already has FOR ALL; this adds delete for admins with users:manage)

CREATE POLICY "Users manage delete profiles" ON profiles FOR DELETE
USING (has_users_manage());
