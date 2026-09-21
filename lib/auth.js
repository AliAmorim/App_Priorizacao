import crypto from 'crypto';
import { getDb } from './db.js';

const SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';

export function hashPassword(p) {
  return crypto.createHash('sha256').update(String(p)).digest('hex');
}

export function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}

export function verify(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    if (!sig || sig !== expect) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export async function requireUser(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const payload = verify(token);
  if (!payload) {
    res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
    return null;
  }
  const { data } = await getDb().from('users').select('username, name, squads').eq('username', payload.u).maybeSingle();
  if (!data) {
    res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
    return null;
  }
  return data;
}

const USERS = [
  ['aline', 'Aline Amorim', '123456', ['SED Pedagógico', 'SED Escola', 'SED Matrícula']],
  ['nairlla', 'Nairlla Hanna', '123456', ['SED Pedagógico', 'SED Escola', 'SED Matrícula']],
  ['louise', 'Louise Oliveira', '123456', ['SED Pedagógico', 'SED Escola', 'SED Matrícula']],
  ['juliana', 'Juliana Constancio', '123456', ['SED Pedagógico', 'SED Escola', 'SED Matrícula']],
  ['kathiane', 'Kathiane Marques', '123456', ['SED Pedagógico', 'SED Escola', 'SED Matrícula']]
];

const DEMO_USERNAMES = ['pedagogico', 'escola', 'matricula', 'admin'];

export async function ensureSeed() {
  for (const [username, name, password, squads] of USERS) {
    const { error } = await getDb()
      .from('users')
      .upsert({ username, name, password: hashPassword(password), squads }, { onConflict: 'username', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  const { error } = await getDb().from('users').delete().in('username', DEMO_USERNAMES);
  if (error) throw new Error(error.message);
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}
