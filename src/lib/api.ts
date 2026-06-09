// Camada de acesso a dados (Supabase) + orquestração das Edge Functions.
import { supabase } from './supabase'
import { formatCnj, onlyDigits } from './cnj'
import type {
  AppConfig,
  DestinatarioDisparo,
  Intimacao,
  IntimacaoComProcesso,
  Movimentacao,
  Oab,
  Perfil,
  Processo,
  StatusIntimacao,
} from '../types'

const DEZ_MINUTOS_MS = 10 * 60 * 1000
const JANELA_INTIMACOES_DIAS = 60 // a aba de Intimações mostra só os últimos 60 dias (por data de disponibilização)

export class CnjDuplicadoError extends Error {
  constructor() {
    super('Este número CNJ já está cadastrado.')
    this.name = 'CnjDuplicadoError'
  }
}

// ---------------------------------------------------------------------------
// OABs (Configurações)
// ---------------------------------------------------------------------------
export async function listOabs(): Promise<Oab[]> {
  const { data, error } = await supabase.from('oabs').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data as Oab[]
}

export async function createOab(input: { numero: string; uf: string; advogado: string }): Promise<Oab> {
  const { data, error } = await supabase
    .from('oabs')
    .insert({ numero: input.numero.trim(), uf: input.uf.trim().toUpperCase(), advogado: input.advogado.trim() })
    .select()
    .single()
  if (error) throw error
  return data as Oab
}

export async function updateOab(id: string, patch: Partial<Pick<Oab, 'numero' | 'uf' | 'advogado'>>): Promise<void> {
  const clean: Record<string, string> = {}
  if (patch.numero !== undefined) clean.numero = patch.numero.trim()
  if (patch.uf !== undefined) clean.uf = patch.uf.trim().toUpperCase()
  if (patch.advogado !== undefined) clean.advogado = patch.advogado.trim()
  const { error } = await supabase.from('oabs').update(clean).eq('id', id)
  if (error) throw error
}

export async function deleteOab(id: string): Promise<void> {
  const { error } = await supabase.from('oabs').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Processos
// ---------------------------------------------------------------------------
export async function listPrincipais(perfil: Perfil): Promise<Processo[]> {
  const { data, error } = await supabase
    .from('processos')
    .select('*')
    .eq('perfil', perfil)
    .is('processo_principal_id', null)
    .order('data_ajuizamento', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Processo[]
}

export async function listApensos(principalId: string): Promise<Processo[]> {
  const { data, error } = await supabase
    .from('processos')
    .select('*')
    .eq('processo_principal_id', principalId)
    .order('data_ajuizamento', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Processo[]
}

export async function getProcesso(id: string): Promise<Processo> {
  const { data, error } = await supabase.from('processos').select('*').eq('id', id).single()
  if (error) throw error
  return data as Processo
}

/** Consulta o Datajud (classe + órgão julgador). Nunca lança: devolve nulos em caso de falha. */
async function runDatajud(
  digits: string,
): Promise<{ classe: string | null; orgao_julgador: string | null; data_ajuizamento: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('consulta-datajud', {
      body: { numero_cnj_digits: digits },
    })
    if (error) return { classe: null, orgao_julgador: null, data_ajuizamento: null }
    return {
      classe: (data?.classe as string) ?? null,
      orgao_julgador: (data?.orgao_julgador as string) ?? null,
      data_ajuizamento: (data?.data_ajuizamento as string) ?? null,
    }
  } catch {
    return { classe: null, orgao_julgador: null, data_ajuizamento: null }
  }
}

/**
 * Cadastra um processo. `processoPrincipalId` nulo => principal; preenchido => apenso
 * (que herda o perfil do principal). Aciona o Datajud para preencher classe/órgão.
 */
async function createProcesso(args: {
  digits: string
  perfil: Perfil
  processoPrincipalId: string | null
}): Promise<Processo> {
  const numero_cnj = formatCnj(args.digits)
  const { data, error } = await supabase
    .from('processos')
    .insert({
      numero_cnj,
      numero_cnj_digits: args.digits,
      perfil: args.perfil,
      processo_principal_id: args.processoPrincipalId,
    })
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') throw new CnjDuplicadoError()
    throw error
  }

  const processo = data as Processo

  // Datajud (classe + órgão julgador). Não bloqueia o cadastro se falhar.
  const dj = await runDatajud(args.digits)
  if (dj.classe || dj.orgao_julgador || dj.data_ajuizamento) {
    const { data: upd } = await supabase
      .from('processos')
      .update({ classe: dj.classe, orgao_julgador: dj.orgao_julgador, data_ajuizamento: dj.data_ajuizamento })
      .eq('id', processo.id)
      .select()
      .single()
    if (upd) return upd as Processo
  }
  return processo
}

export async function createPrincipal(numeroCnj: string, perfil: Perfil): Promise<Processo> {
  const digits = onlyDigits(numeroCnj)
  if (digits.length !== 20) throw new Error('O número CNJ deve ter 20 dígitos.')
  return createProcesso({ digits, perfil, processoPrincipalId: null })
}

/** Adiciona um apenso a um principal. Valida o nível único e herda o perfil. */
export async function createApenso(principal: Processo, numeroCnj: string): Promise<Processo> {
  if (principal.processo_principal_id !== null) {
    throw new Error('Apenso não pode ter apensos (apenas um nível de apensamento).')
  }
  const digits = onlyDigits(numeroCnj)
  if (digits.length !== 20) throw new Error('O número CNJ deve ter 20 dígitos.')
  return createProcesso({ digits, perfil: principal.perfil, processoPrincipalId: principal.id })
}

export async function updateProcesso(
  id: string,
  patch: Partial<
    Pick<
      Processo,
      | 'classe'
      | 'orgao_julgador'
      | 'data_ajuizamento'
      | 'posicao_cias'
      | 'objeto'
      | 'rotulo'
      | 'observacao'
    >
  >,
): Promise<void> {
  const { error } = await supabase.from('processos').update(patch).eq('id', id)
  if (error) throw error
}

/**
 * Exclui um processo. Se for principal, o ON DELETE CASCADE do banco remove
 * também os apensos e, em todos eles, as intimações e movimentações vinculadas.
 */
export async function deleteProcesso(id: string): Promise<void> {
  const { error } = await supabase.from('processos').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Intimações
// ---------------------------------------------------------------------------
export async function listIntimacoesByPerfil(perfil: Perfil): Promise<IntimacaoComProcesso[]> {
  const desde = new Date(Date.now() - JANELA_INTIMACOES_DIAS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('intimacoes')
    .select('*, processo:processos!inner(numero_cnj, perfil, classe, posicao_cias, rotulo)')
    .eq('processo.perfil', perfil)
    .gte('data_disponibilizacao', desde)
    .order('data_disponibilizacao', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as IntimacaoComProcesso[]
}

export async function updateIntimacao(
  id: string,
  patch: Partial<Pick<Intimacao, 'status' | 'prazo_fatal' | 'observacao'>>,
): Promise<void> {
  const { error } = await supabase.from('intimacoes').update(patch).eq('id', id)
  if (error) throw error
}

/**
 * Prazos em aberto: intimações com prazo_fatal preenchido e status != 'providenciada',
 * para o conjunto de processos informado (no principal, passe principal + apensos).
 */
export async function listPrazosEmAberto(processoIds: string[]): Promise<Intimacao[]> {
  if (processoIds.length === 0) return []
  const { data, error } = await supabase
    .from('intimacoes')
    .select('*')
    .in('processo_id', processoIds)
    .not('prazo_fatal', 'is', null)
    .neq('status', 'providenciada')
    .order('prazo_fatal', { ascending: true })
  if (error) throw error
  return data as Intimacao[]
}

// ---------------------------------------------------------------------------
// Movimentações (histórico manual)
// ---------------------------------------------------------------------------
export async function listMovimentacoes(processoId: string): Promise<Movimentacao[]> {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('*')
    .eq('processo_id', processoId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Movimentacao[]
}

export async function createMovimentacao(input: { processo_id: string; data: string; descricao: string }): Promise<void> {
  const { error } = await supabase.from('movimentacoes').insert({
    processo_id: input.processo_id,
    data: input.data,
    descricao: input.descricao.trim(),
  })
  if (error) throw error
}

export async function updateMovimentacao(id: string, patch: { data?: string; descricao?: string }): Promise<void> {
  const { error } = await supabase.from('movimentacoes').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteMovimentacao(id: string): Promise<void> {
  const { error } = await supabase.from('movimentacoes').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// app_config (Configurações > APIs)
// ---------------------------------------------------------------------------
export async function getAppConfig(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('app_config').select('chave, valor')
  if (error) throw error
  const out: Record<string, string> = {}
  for (const row of (data as AppConfig[]) ?? []) out[row.chave] = row.valor ?? ''
  return out
}

export async function setAppConfig(chave: string, valor: string): Promise<void> {
  const { error } = await supabase
    .from('app_config')
    .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: 'chave' })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Destinatários do disparo diário (Configurações > Disparo de intimações)
// ---------------------------------------------------------------------------
export async function listDestinatarios(): Promise<DestinatarioDisparo[]> {
  const { data, error } = await supabase
    .from('destinatarios_disparo')
    .select('*')
    .order('area', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as DestinatarioDisparo[]
}

export async function createDestinatario(input: { area: Perfil; email: string }): Promise<DestinatarioDisparo> {
  const { data, error } = await supabase
    .from('destinatarios_disparo')
    .insert({ area: input.area, email: input.email.trim() })
    .select()
    .single()
  if (error) throw error
  return data as DestinatarioDisparo
}

export async function deleteDestinatario(id: string): Promise<void> {
  const { error } = await supabase.from('destinatarios_disparo').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------
export async function getLastSyncAt(): Promise<string | null> {
  const { data, error } = await supabase.from('sync_state').select('last_sync_at').eq('id', 1).maybeSingle()
  if (error) throw error
  return (data as { last_sync_at: string | null } | null)?.last_sync_at ?? null
}

async function runSync(): Promise<void> {
  const { error } = await supabase.functions.invoke('sync-intimacoes', { body: {} })
  if (error) throw error
}

/**
 * Sincroniza respeitando o throttle de ~10 min, salvo quando `force` é true.
 * Retorna true se a sincronização foi de fato disparada.
 */
export async function maybeSync(force: boolean): Promise<boolean> {
  if (!force) {
    const last = await getLastSyncAt().catch(() => null)
    if (last && Date.now() - new Date(last).getTime() < DEZ_MINUTOS_MS) return false
  }
  await runSync()
  return true
}

export type { StatusIntimacao }
