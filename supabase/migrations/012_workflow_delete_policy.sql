-- Migration 012: Allow auth users to delete workflow updates (for undo before manager approval)
CREATE POLICY "Auth delete reservation workflow" ON reservation_workflow_updates
  FOR DELETE USING (auth.uid() IS NOT NULL);
