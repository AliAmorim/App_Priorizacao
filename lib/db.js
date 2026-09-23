import { createClient } from '@supabase/supabase-js';

// URL do projeto Supabase (aceita o prefixo NEXT_PUBLIC_ da integração ou o formato padrão).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';

// Chave de serviço (service_role) — usada NO SERVIDOR para ignorar os bloqueios de RLS.
// É a chave injetada pela integração oficial Vercel → Supabase. NUNCA exponha no navegador.
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Fallback apenas para desenvolvimento local (sem a chave de serviço no ambiente).
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

let client = null;

function requireConfig() {
  if (!SUPABASE_URL || (!SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_ANON_KEY)) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  }
}

export function getDb() {
  requireConfig();
  if (!client) {
    const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    client = createClient(SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    if (console && console.log) {
      console.log('[db] cliente Supabase criado com', SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE (ignora RLS)' : 'ANON KEY (dev; RLS pode bloquear)');
    }
  }
  return client;
}

/* ------------------------------------------------------------------ */
/* User stories — tabela "items"                                       */
/* ------------------------------------------------------------------ */

// Lista (SELECT) as user stories de um squad, na ordem de execução.
export async function listarUserStories(squad) {
  const { data, error } = await getDb()
    .from('items')
    .select('numero, nome, po, pri, status, area, prazo, ordem, tipo')
    .eq('squad', squad)
    .order('ordem');
  if (error) throw new Error(error.message);
  return data || [];
}

// Salva (INSERT) o backlog completo de um squad (substitui os itens existentes).
export async function salvarUserStories(squad, items) {
  const rows = (items || []).map((r) => ({
    squad,
    numero: r.numero,
    nome: r.nome,
    po: r.po,
    pri: r.pri,
    status: r.status,
    area: r.area,
    prazo: r.prazo || '',
    ordem: r.ordem,
    tipo: r.tipo || 'User Story'
  }));

  const { error: delErr } = await getDb().from('items').delete().eq('squad', squad);
  if (delErr) throw new Error(delErr.message);

  if (rows.length) {
    const { error: insErr } = await getDb().from('items').insert(rows);
    if (insErr) throw new Error(insErr.message);
  }
  return { ok: true, total: rows.length };
}

// Limpeza de espaço (plano gratuito): remove as User Stories com status "Concluído"
// que estejam há mais de 30 dias (coluna created_at). Retorna as linhas removidas.
export async function limparConcluidasAntigas() {
  const corte = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await getDb()
    .from('items')
    .delete()
    .eq('status', 'Concluído')
    .lt('created_at', corte);
  if (error) throw new Error(error.message);
  return data || [];
}

/* ------------------------------------------------------------------ */
/* Opções de filtro — tabela "app_options"                             */
/* ------------------------------------------------------------------ */

export async function listarOpcoes(squad) {
  const { data, error } = await getDb()
    .from('app_options')
    .select('data')
    .eq('squad', squad)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? data.data : null;
}

export async function salvarOpcoes(squad, options) {
  const { error } = await getDb()
    .from('app_options')
    .upsert({ squad, data: options }, { onConflict: 'squad' });
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Usuários — tabela "users"                                           */
/* ------------------------------------------------------------------ */

export async function buscarUsuario(username) {
  const { data, error } = await getDb()
    .from('users')
    .select('username, name, password, squads, can_edit')
    .eq('username', String(username || '').trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listarUsuarioPublico(username) {
  const { data, error } = await getDb()
    .from('users')
    .select('username, name, squads, can_edit')
    .eq('username', String(username || '').trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Lista todos os usuários (para a tela de gestão de permissões).
export async function listarUsuarios() {
  const { data, error } = await getDb()
    .from('users')
    .select('username, name, squads, can_edit')
    .order('name');
  if (error) throw new Error(error.message);
  return data || [];
}

// Define se um usuário pode editar/cadastrar (true) ou apenas visualizar (false).
export async function atualizarPermissao(username, canEdit) {
  const key = String(username || '').trim().toLowerCase();
  const { error } = await getDb()
    .from('users')
    .update({ can_edit: !!canEdit })
    .eq('username', key);
  if (error) throw new Error(error.message);
  return { ok: true, username: key, can_edit: !!canEdit };
}