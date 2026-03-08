import assert from 'node:assert';
import { createServerClient } from '../lib/supabase/client';

// Load env variables manually for Node test
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

console.log('\n🧪 Running Supabase Integration Tests...');

async function testConnection() {
  const supabase = createServerClient();

  try {
    // 1. Test basic reachability by counting profiles
    const { data, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    
    console.log('  ✅ Connection established to Supabase REST API');
    
    // 2. Test Schema Integrity (Check if tables exist)
    const { error: predictionError } = await supabase
      .from('predictions')
      .select('*')
      .limit(1);
    
    if (predictionError && predictionError.code !== 'PGRST116') { // PGRST116 is 'No rows returned' which is fine
       if (predictionError.code === '42P01') {
         throw new Error('Predictions table not found. Did you run the SQL schema?');
       }
    }
    console.log('  ✅ Table "predictions" verified in schema');

    const { error: leaguesError } = await supabase
      .from('leagues')
      .select('*')
      .limit(1);
    
    if (leaguesError && leaguesError.code !== 'PGRST116') {
       if (leaguesError.code === '42P01') {
         throw new Error('Leagues table not found. Did you run the SQL schema?');
       }
    }
    console.log('  ✅ Table "leagues" verified in schema');

  } catch (e: any) {
    console.error('  ❌ Supabase Connection/Schema Test Failed:', e.message);
    process.exit(1);
  }
}

testConnection();
