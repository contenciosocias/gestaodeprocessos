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
  prazo_fatal: string | null
  observacao: string | null
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

// Linha (de intimacao) já com o número CNJ do processo embutido, para a lista.
export interface IntimacaoComProcesso extends Intimacao {
  processo?: { numero_cnj: string; perfil: Perfil } | null
}
