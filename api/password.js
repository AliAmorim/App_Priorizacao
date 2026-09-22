import { getDb } from '../lib/db.js';
import { cors, hashPassword, parseBody } from '../lib/auth.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  try {
    const body = parseBody(req);
    const username = String(body.username || '').trim().toLowerCase();
    const current = String(body.currentPassword || '');
    const novo = String(body.newPassword || '');

    if (!username || !current || !novo) {
      res.status(400).json({ error: 'Informe usuário, senha atual e nova senha.' });
      return;
    }
    if (novo.length < 6) {
      res.status(400).json({ error: 'A nova senha deve ter ao menos 6 caracteres.' });
      return;
    }

    const { data: user, error } = await getDb()
      .from('users')
      .select('password')
      .eq('username', username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!user || hashPassword(current) !== user.password) {
      res.status(401).json({ error: 'Senha atual incorreta.' });
      return;
    }

    const { error: updErr } = await getDb()
      .from('users')
      .update({ password: hashPassword(novo) })
      .eq('username', username);
    if (updErr) throw new Error(updErr.message);

    res.status(200).json({ ok: true });
  } catch (err) {
    var msg = /does not exist/.test(err.message || '')
      ? 'Banco não configurado — rode o schema.sql no SQL Editor do Supabase.'
      : err.message;
    res.status(500).json({ error: msg });
  }
}