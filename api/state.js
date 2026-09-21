import { cors, requireUser, parseBody } from '../lib/auth.js';
import { listarUserStories, salvarUserStories, listarOpcoes, salvarOpcoes } from '../lib/db.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const isWrite = req.method === 'PUT' || req.method === 'POST';
    const body = isWrite ? parseBody(req) : {};
    const squad = String(isWrite ? (body.squad || req.query.squad) : req.query.squad || '').trim();
    if (!squad) { res.status(400).json({ error: 'Informe o squad.' }); return; }
    if (!(user.squads || []).includes(squad)) { res.status(403).json({ error: 'Sem acesso a este squad.' }); return; }

    // GET /api/state?squad=... → busca (SELECT) as user stories e opções do squad.
    if (req.method === 'GET') {
      const items = await listarUserStories(squad);
      const options = await listarOpcoes(squad);
      res.status(200).json({ items: items.length ? items : null, options });
      return;
    }

    // PUT / POST /api/state → salva (INSERT) o backlog completo do squad.
    if (isWrite) {
      await salvarUserStories(squad, body.items || []);
      if (body.options) await salvarOpcoes(squad, body.options);
      res.status(200).json({ ok: true, salvas: (body.items || []).length });
      return;
    }

    res.setHeader('Allow', ['GET', 'PUT', 'POST']);
    res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    var msg = /does not exist/.test(err.message || '')
      ? 'Banco não configurado — rode o schema.sql no SQL Editor do Supabase.'
      : err.message;
    res.status(500).json({ error: msg });
  }
}