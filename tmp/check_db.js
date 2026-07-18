import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY);

async function check() {
  let log = "";
  const tables = ['profiles', 'quiz_attempts', 'flashcard_decks', 'battle_results', 'battle_players', 'battle_rooms'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(3);
    if (error) {
      log += `Table ${t}: Error: ${error.message}\n`;
    } else {
      log += `Table ${t} columns: ${data.length > 0 ? Object.keys(data[0]).join(', ') : "(empty table)"}\n`;
      if (data.length > 0) {
        log += `Table ${t} row count fetched: ${data.length}\n`;
        log += `Table ${t} keys/values for row 0:\n`;
        for (const [k, v] of Object.entries(data[0])) {
          log += `  ${k}: ${typeof v === 'object' ? JSON.stringify(v).substring(0, 100) : v}\n`;
        }
      }
    }
    log += "------------------------\n";
  }

  // Also query some database metadata if possible, else just try to insert a test profile
  // to see if we can add 'bio', 'avatar_url', or 'profile_picture_url' columns or if they'll fail.
  // Wait, let's see if we can do an insert/update with some common names to check support.
  log += "Testing profile field support...\n";
  const testId = "00000000-0000-0000-0000-000000000000";
  // We won't actually insert, we just query profiles schema details.
  // Or we can try to do a select of specific suspected columns:
  const suspectedCols = ['bio', 'avatar_url', 'profile_picture_url', 'created_at', 'updated_at', 'join_date'];
  for (const col of suspectedCols) {
    const { error } = await supabase.from('profiles').select(col).limit(1);
    if (error) {
      log += `  profiles.${col} column: NOT supported (Error: ${error.message})\n`;
    } else {
      log += `  profiles.${col} column: SUPPORTED!\n`;
    }
  }

  fs.writeFileSync(path.join(__dirname, 'db_schema.log'), log);
  console.log("Wrote schema log successfully!");
}

check();
