-- =============================================================================
-- Tarefas vinculadas às intimações (1:1) + remoção do controle de prazo solto.
--
-- Cada intimação pode ter UMA tarefa (intimacao_id UNIQUE). O status da intimação
-- passa a SEGUIR a tarefa (regras na camada de aplicação, ver src/lib/api.ts):
--   - sem tarefa OU tarefa em aberto (concluida_em IS NULL) => 'nova';
--   - tarefa concluída                                       => 'providenciada';
--   - 'lida' continua sendo a única marcação MANUAL ("sem ação").
-- "Em aberto" = concluida_em IS NULL.
-- =============================================================================

create table if not exists tarefas (
  id           uuid primary key default gen_random_uuid(),
  -- 1:1 com a intimação (UNIQUE garante uma tarefa por intimação).
  intimacao_id uuid not null unique references intimacoes(id) on delete cascade,
  -- derivado da intimação; agiliza filtros por processo (Detalhes/Processos).
  processo_id  uuid not null references processos(id) on delete cascade,
  prazo_fatal  date,
  responsavel  text,
  instrucoes   text,
  concluida_em timestamptz,                       -- nulo = em aberto
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_tarefas_processo on tarefas(processo_id);
-- Lista de abertas ordenada por prazo (aba Tarefas / Detalhes do processo).
create index if not exists idx_tarefas_abertas on tarefas(prazo_fatal) where concluida_em is null;

-- updated_at automático (reutiliza set_updated_at() criada na 0001).
drop trigger if exists trg_tarefas_updated_at on tarefas;
create trigger trg_tarefas_updated_at
  before update on tarefas
  for each row execute function set_updated_at();

-- RLS — PROVISÓRIO: acesso liberado a anon + authenticated, igual às demais tabelas
-- (MVP sem login; ver seção "Segurança" do README e o comentário na 0001).
alter table tarefas enable row level security;
drop policy if exists anon_all_tarefas on tarefas;
create policy anon_all_tarefas on tarefas for all to anon, authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Remove o controle de prazo/observação que ficava SOLTO dentro da intimação.
-- Esses dados passam a viver na tarefa vinculada. O disparo diário e o sync
-- nunca usaram estas colunas, então a remoção não os afeta.
-- ----------------------------------------------------------------------------
alter table intimacoes drop column if exists prazo_fatal;
alter table intimacoes drop column if exists observacao;
