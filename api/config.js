import { cors } from '../lib/auth.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Aceita tanto o prefixo NEXT_PUBLIC_ (integração oficial) quanto SUPABASE_.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) {
    res.status(500).json({
      error: 'Configure SUPABASE_URL e SUPABASE_ANON_KEY (ou NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) no Vercel.'
    });
    return;
  }
  res.status(200).json({ url, anonKey });
}