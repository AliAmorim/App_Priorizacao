import { getDb, listarUsuarios, atualizarPermissao } from '../lib/db.js';
import { cors, requireUser, hashPassword, parseBody } from '../lib/auth.js';

const ADMIN_USERNAME = 'aline';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const user = await requireUser(req, res);
    if (!user) return;
    if (user.username !== ADMIN_USERNAME) {
      res.status(403).json({ error: 'Apenas o administrador pode gerenciar usuários.' });
      return;
    }

    // GET /api/users → lista os usuários com a permissão atual (editor/visualizador).
    if (req.method === 'GET') {
      const users = await listarUsuarios();
      res.status(200).json({ users });
      return;
    }

    // POST /api/users → cadastra um usuário (canEdit opcional, padrão true).
    if (req.method === 'POST') {
      const body = parseBody(req);
      const username = String(body.username || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      const password = String(body.password || '');
      const squads = Array.isArray(body.squads) ? body.squads.filter(Boolean) : [];
      const canEdit = body.canEdit === undefined ? true : !!body.canEdit;

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
        .insert({ username, name, password: hashPassword(password), squads, can_edit: canEdit });
      if (insErr) throw new Error(insErr.message);

      res.status(200).json({ ok: true, username });
      return;
    }

    // PUT /api/users → altera a permissão de um usuário ({ username, canEdit }).
    if (req.method === 'PUT') {
      const body = parseBody(req);
      const username = String(body.username || '').trim().toLowerCase();
      if (!username) { res.status(400).json({ error: 'Informe o usuário.' }); return; }
      if (username === ADMIN_USERNAME) {
        res.status(400).json({ error: 'O administrador não pode perder a permissão de edição.' });
        return;
      }
      const result = await atualizarPermissao(username, !!body.canEdit);
      res.status(200).json(result);
      return;
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT']);
    res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    var msg = /does not exist/.test(err.message || '')
      ? 'Banco não configurado — rode o schema.sql no SQL Editor do Supabase.'
      : err.message;
    res.status(500).json({ error: msg });
  }
}
