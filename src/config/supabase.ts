// src/config/supabase.ts 
// Ensure this file is correctly loading environment variables

import { createClient } from '@supabase/supabase-js';

// Log the available environment variables (for debugging only, remove in production)
console.log('Env vars available:', {
  url: import.meta.env.VITE_SUPABASE_URL ? 'Yes' : 'No',
  key: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Yes' : 'No' 
});

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// This is temporary to help debugging - remove in production
console.log('Supabase client initialized with URL:', supabaseUrl.substring(0, 15) + '...');