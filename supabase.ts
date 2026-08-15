
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tpsddcoggmbdtnbwokvp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwc2RkY29nZ21iZHRuYndva3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2Mjc3NTcsImV4cCI6MjA4NDIwMzc1N30.EbJxomqxYijyN3LYy0sKa6vByrLDcmXsImeej6b8Uws';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
