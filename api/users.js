import { getDb } from '../lib/db.js';
import { cors, requireUser, hashPassword, parseBody } from '../lib/auth.js';

const ADMIN_USERNAME = 'aline';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const user = await requireUser(req, res);
    if (!user) return;
    if (user.username !== ADMIN_USERNAME) {
      res.status(403).json({ error: 'Apenas o administrador pode cadastrar usuários.' });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const username = String(body.username || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      const password = String(body.password || '');
      const squads = Array.isArray(body.squads) ? body.squads.filter(Boolean) : [];

      if (!username || !name || !password) {
        res.status(400).json({ error: 'Informe nome, usuário e senha.' });
        return;
      }
      if (!/^[a-z0-9._-]+$/.test(username)) {
        res.status(400).json({ error: 'Usuário deve conter apenas letras minúsculas, números, ponto, hífen ou underline.' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });
        return;
      }

      const { data: exists } = await getDb().from('users').select('username').eq('username', username).maybeSingle();
      if (exists) {
        res.status(409).json({ error: 'Já existe um usuário com esse nome de login.' });
        return;
      }

      const { error: insErr } = await getDb()
        .from('users')
        .insert({ username, name, password: hashPassword(password), squads });
      if (insErr) throw new Error(insErr.message);

      res.status(200).json({ ok: true, username });
      return;
    }

    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    var msg = /does not exist/.test(err.message || '')
      ? 'Banco não configurado — rode o schema.sql no SQL Editor do Supabase.'
      : err.message;
    res.status(500).json({ error: msg });
  }
}