-- Add indent_level column to todo_items table
ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS indent_level INTEGER DEFAULT 0;

-- Add comment to describe the column
COMMENT ON COLUMN todo_items.indent_level IS 'Indentation level for todo items (0-3)';
