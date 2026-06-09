-- =============================================================================
-- Contencioso CIAS — schema inicial (MVP)
-- Controle de intimações (DJEn) por perfil Cível / Trabalhista.
-- =============================================================================

-- gen_random_uuid() vem da extensão pgcrypto (já habilitada por padrão no Supabase).
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type perfil_area as enum ('civel', 'trabalhista');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_intimacao as enum ('nova', 'lida', 'providenciada');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- oabs — registro GLOBAL de OABs a monitorar.
-- A área (cível/trabalhista) de uma intimação vem SEMPRE do processo, nunca da OAB.
-- Servem para filtrar o resultado do DJEn (manter só as intimações dirigidas a elas).
-- ----------------------------------------------------------------------------
create table if not exists oabs (
  id          uuid primary key default gen_random_uuid(),
  numero      text not null,
  uf          text not null check (char_length(uf) = 2),
  advogado    text not null,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- processos — principais e apensos.
-- processo_principal_id NULL  => é principal.
-- processo_principal_id != NULL => é apenso (herda o perfil do principal).
-- Apenas UM nível de apensamento (regra reforçada na camada de aplicação:
-- ao adicionar apenso, o alvo precisa ter processo_principal_id nulo).
-- ----------------------------------------------------------------------------
create table if not exists processos (
  id                    uuid primary key default gen_random_uuid(),
  numero_cnj            text not null,                 -- formatado (com máscara)
  numero_cnj_digits     text not null unique,          -- só dígitos (chave de unicidade)
  perfil                perfil_area not null,
  processo_principal_id uuid references processos(id) on delete cascade,
  classe                text,                          -- Datajud (editável)
  orgao_julgador        text,                          -- Datajud (editável)
  posicao_cias          text,                          -- manual (por processo)
  objeto                text,                          -- manual
  rotulo                text,                          -- manual (ex.: parte adversa)
  observacao            text,                          -- manual
  created_at            timestamptz not null default now()
);
create index if not exists idx_processos_principal on processos(processo_principal_id);
create index if not exists idx_processos_perfil on processos(perfil);

-- ----------------------------------------------------------------------------
-- intimacoes — conteúdo do DJEn (imutável para nós).
-- O upsert do sync usa ON CONFLICT (id_externo) DO NOTHING, então os campos
-- editados por nós (status, prazo_fatal, observacao) NUNCA são sobrescritos.
-- ----------------------------------------------------------------------------
create table if not exists intimacoes (
  id                    uuid primary key default gen_random_uuid(),
  id_externo            text not null unique,          -- hash/id da comunicação no DJEn
  processo_id           uuid not null references processos(id) on delete cascade,
  numero_processo       text,
  sigla_tribunal        text,
  nome_orgao            text,
  tipo_comunicacao      text,
  teor                  text,
  data_disponibilizacao date,
  destinatario_advogado text,
  link_certidao         text,
  status                status_intimacao not null default 'nova',
  prazo_fatal           date,
  observacao            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_intimacoes_processo on intimacoes(processo_id);
create index if not exists idx_intimacoes_data on intimacoes(data_disponibilizacao desc);

-- updated_at automático
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_intimacoes_updated_at on intimacoes;
create trigger trg_intimacoes_updated_at
  before update on intimacoes
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- movimentacoes — histórico MANUAL por processo (NÃO vem do Datajud).
-- Cada processo (principal ou apenso) tem o seu.
-- ----------------------------------------------------------------------------
create table if not exists movimentacoes (
  id          uuid primary key default gen_random_uuid(),
  processo_id uuid not null references processos(id) on delete cascade,
  data        date not null,
  descricao   text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_movimentacoes_processo
  on movimentacoes(processo_id, data desc, created_at desc);

-- ----------------------------------------------------------------------------
-- app_config — chave/valor editável em Configurações.
-- As Edge Functions leem daqui; se a chave faltar, usam o default embutido.
-- ----------------------------------------------------------------------------
create table if not exists app_config (
  chave      text primary key,
  valor      text,
  updated_at timestamptz not null default now()
);

insert into app_config (chave, valor) values
  ('djen_base_url',    'https://comunicaapi.pje.jus.br/api/v1'),
  ('datajud_base_url', 'https://api-publica.datajud.cnj.jus.br'),
  ('datajud_api_key',  'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==')
on conflict (chave) do nothing;

-- ----------------------------------------------------------------------------
-- sync_state — uma única linha (id fixo = 1).
-- ----------------------------------------------------------------------------
create table if not exists sync_state (
  id           int primary key default 1 check (id = 1),
  last_sync_at timestamptz
);
insert into sync_state (id, last_sync_at) values (1, null) on conflict (id) do nothing;

-- =============================================================================
-- RLS (Row Level Security)
--
-- PROVISÓRIO — MVP SEM LOGIN: o acesso anônimo (anon) está totalmente liberado
-- para leitura e escrita. Isso é intencional para o MVP interno; qualquer pessoa
-- com a URL e a anon key acessa/edita os dados e as configurações.
--
-- A SUBSTITUIR por políticas baseadas em Supabase Auth quando houver login
-- (ver README, seção "Segurança"). As Edge Functions usam a service_role key,
-- que ignora o RLS de qualquer forma.
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['oabs','processos','intimacoes','movimentacoes','app_config','sync_state']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I on %I;', 'anon_all_' || t, t);
    -- PROVISÓRIO: acesso liberado a anon + authenticated em todos os comandos.
    execute format(
      'create policy %I on %I for all to anon, authenticated using (true) with check (true);',
      'anon_all_' || t, t
    );
  end loop;
end $$;
