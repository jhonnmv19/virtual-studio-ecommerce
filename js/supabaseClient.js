// js/supabaseClient.js
const SUPABASE_URL = 'https://ujvcuuodacbtlvdnwafj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdmN1dW9kYWNidGx2ZG53YWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMTQ4MDYsImV4cCI6MjA3MzY5MDgwNn0.voYziriyh2ROHnekjhCnen0R6b3AGKdtNzqCa4llfBk';

// Creamos el cliente usando el objeto global de Supabase del CDN
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);