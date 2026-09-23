import { getDb } from '../lib/db.js';
import { cors, requireUser, parseBody } from '../lib/auth.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const user = await requireUser(req, res);
    if (!user) return;

    // Lista os squads existentes e os usuários (para atribuição).
    if (req.method === 'GET') {
      const { data: users, error } = await getDb().from('users').select('username, name, squads').order('name');
      if (error) throw new Error(error.message);
      const squads = [];
      (users || []).forEach((u) => (u.squads || []).forEach((s) => {
        if (s && squads.indexOf(s) < 0) squads.push(s);
      }));
      squads.sort();
      res.status(200).json({ squads, users: users || [] });
      return;
    }

    // Cria um squad e atribui aos usuários informados.
    if (req.method === 'POST') {
      if (user.can_edit === false) { res.status(403).json({ error: 'Seu usuário é somente visualização — não pode gerenciar squads.' }); return; }
      const body = parseBody(req);
      const squad = String(body.squad || '').trim();
      const usernames = Array.isArray(body.usernames) ? body.usernames : [];
      if (!squad) { res.status(400).json({ error: 'Informe o nome do squad.' }); return; }

      for (const uname of usernames) {
        const key = String(uname || '').trim().toLowerCase();
        if (!key) continue;
        const { data: row } = await getDb().from('users').select('squads').eq('username', key).maybeSingle();
        if (!row) continue;
        const list = Array.isArray(row.squads) ? row.squads.slice() : [];
        if (list.indexOf(squad) < 0) list.push(squad);
        const { error } = await getDb().from('users').update({ squads: list }).eq('username', key);
        if (error) throw new Error(error.message);
      }
      res.status(200).json({ ok: true });
      return;
    }

    // Remove um squad de todos os usuários.
    if (req.method === 'DELETE') {
      if (user.can_edit === false) { res.status(403).json({ error: 'Seu usuário é somente visualização — não pode gerenciar squads.' }); return; }
      const squad = String(req.query.squad || '').trim();
      if (!squad) { res.status(400).json({ error: 'Informe o squad.' }); return; }
      const { data: users, error } = await getDb().from('users').select('username, squads');
      if (error) throw new Error(error.message);
      for (const u of users || []) {
        const list = Array.isArray(u.squads) ? u.squads.filter((s) => s !== squad) : [];
        const { error: updErr } = await getDb().from('users').update({ squads: list }).eq('username', u.username);
        if (updErr) throw new Error(updErr.message);
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    var msg = /does not exist/.test(err.message || '')
      ? 'Banco não configurado — rode o schema.sql no SQL Editor do Supabase.'
      : err.message;
    res.status(500).json({ error: msg });
  }
}