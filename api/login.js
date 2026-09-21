import { getDb } from '../lib/db.js';
import { cors, hashPassword, sign, verify, ensureSeed, parseBody } from '../lib/auth.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    await ensureSeed();

    if (req.method === 'POST') {
      const body = parseBody(req);
      const { username, password } = body;
      if (!username || !password) {
        res.status(400).json({ error: 'Informe usuário e senha.' });
        return;
      }
      const { data: user, error } = await getDb()
        .from('users')
        .select('username, name, password, squads')
        .eq('username', String(username).trim().toLowerCase())
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!user) {
        // Diagnóstico: usuário não encontrado — em produção, quase sempre é RLS na tabela
        // "users" bloqueando a leitura com a chave anônima, ou SUPABASE_SERVICE_ROLE_KEY ausente.
        if (console && console.log) console.log('[login] usuário não encontrado:', username);
        res.status(401).json({ error: 'Usuário não encontrado.' });
        return;
      }
      if (hashPassword(password) !== user.password) {
        if (console && console.log) console.log('[login] senha incorreta para:', username);
        res.status(401).json({ error: 'Senha incorreta.' });
        return;
      }
      const payload = { u: user.username, exp: Date.now() + 7 * 24 * 3600 * 1000 };
      res.status(200).json({
        token: sign(payload),
        user: { username: user.username, name: user.name, squads: user.squads }
      });
      return;
    }

    if (req.method === 'GET') {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const payload = verify(token);
      if (!payload) { res.status(401).json({ error: 'Sessão inválida.' }); return; }
      const { data: user } = await getDb()
        .from('users')
        .select('username, name, squads')
        .eq('username', payload.u)
        .maybeSingle();
      if (!user) { res.status(401).json({ error: 'Sessão inválida.' }); return; }
      res.status(200).json({ user: { username: user.username, name: user.name, squads: user.squads } });
      return;
    }

    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    var msg = /does not exist/.test(err.message || '')
      ? 'Banco não configurado — rode o schema.sql no SQL Editor do Supabase.'
      : err.message;
    res.status(500).json({ error: msg });
  }
}