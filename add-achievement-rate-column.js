import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function addColumn() {
  try {
    // Execute SQL to add the column
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE revenues ADD COLUMN IF NOT EXISTS achievement_rate DECIMAL(5, 2);'
    })

    if (error) {
      console.error('Error adding column:', error)
    } else {
      console.log('Successfully added achievement_rate column')
    }
  } catch (err) {
    console.error('Error:', err)
  }
}

addColumn()
