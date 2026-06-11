// Tipos espelhando o schema do Supabase (ver supabase/migrations/0001_init.sql).

export type Perfil = 'civel' | 'trabalhista'
export type StatusIntimacao = 'nova' | 'lida' | 'providenciada'

export interface Oab {
  id: string
  numero: string
  uf: string
  advogado: string
  created_at: string
}

export interface Processo {
  id: string
  numero_cnj: string
  numero_cnj_digits: string
  perfil: Perfil
  processo_principal_id: string | null
  classe: string | null
  orgao_julgador: string | null
  data_ajuizamento: string | null
  posicao_cias: string | null
  objeto: string | null
  rotulo: string | null
  observacao: string | null
  created_at: string
}

export interface Intimacao {
  id: string
  id_externo: string
  processo_id: string
  numero_processo: string | null
  sigla_tribunal: string | null
  nome_orgao: string | null
  tipo_comunicacao: string | null
  teor: string | null
  data_disponibilizacao: string | null
  destinatario_advogado: string | null
  link_certidao: string | null
  status: StatusIntimacao
  // Quando entrou num disparo diário por e-mail (null = ainda não notificada).
  notificada_em: string | null
  created_at: string
  updated_at: string
}

// Tarefa vinculada 1:1 a uma intimação. "Em aberto" = concluida_em null.
export interface Tarefa {
  id: string
  intimacao_id: string
  processo_id: string
  prazo_fatal: string | null
  responsavel: string | null
  instrucoes: string | null
  concluida_em: string | null
  created_at: string
  updated_at: string
}

export interface Movimentacao {
  id: string
  processo_id: string
  data: string
  descricao: string
  created_at: string
}

export interface AppConfig {
  chave: string
  valor: string | null
  updated_at: string
}

// Destinatário do disparo diário, por área (roteamento estrito).
export interface DestinatarioDisparo {
  id: string
  area: Perfil
  email: string
  created_at: string
}

// Responsável selecionável ao atribuir uma tarefa (cadastrado em Configurações).
export interface Responsavel {
  id: string
  nome: string
  created_at: string
}

// Linha (de intimacao) já com dados do processo embutidos, para a lista.
export interface IntimacaoComProcesso extends Intimacao {
  processo?: {
    numero_cnj: string
    perfil: Perfil
    classe: string | null
    posicao_cias: string | null
    rotulo: string | null
  } | null
  // Tarefa vinculada (1:1), se houver. Só o necessário para decidir o indicador.
  tarefa?: { id: string; concluida_em: string | null } | null
}

// Tarefa já com dados do processo e da intimação embutidos, para a aba Tarefas.
export interface TarefaComContexto extends Tarefa {
  processo?: {
    numero_cnj: string
    perfil: Perfil
    posicao_cias: string | null
    rotulo: string | null
  } | null
  intimacao?: {
    tipo_comunicacao: string | null
    data_disponibilizacao: string | null
    nome_orgao: string | null
  } | null
}
