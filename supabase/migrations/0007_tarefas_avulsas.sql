-- =============================================================================
-- Tarefas avulsas — desacopla a tarefa da intimação (e, opcionalmente, do processo).
--
-- Antes (0005): tarefa 1:1 OBRIGATÓRIA com uma intimação (intimacao_id NOT NULL).
-- Agora: a tarefa pode existir
--   - vinculada a uma intimação (fluxo original, status da intimação segue a tarefa);
--   - vinculada apenas a um processo escolhido (sem intimação);
--   - totalmente avulsa (sem intimação e sem processo), identificada por `referencia`.
--
-- Como o app é organizado por perfil (cível/trabalhista) e esse perfil vinha SEMPRE
-- do processo, tarefas sem processo precisam carregar o perfil em si mesmas — daí a
-- nova coluna `perfil` (NOT NULL). O UNIQUE de intimacao_id continua valendo: no
-- Postgres, valores NULL são considerados distintos, então várias tarefas avulsas
-- (intimacao_id NULL) convivem sem violar a unicidade.
-- =============================================================================

-- Vínculos passam a ser opcionais.
alter table tarefas alter column intimacao_id drop not null;
alter table tarefas alter column processo_id  drop not null;

-- Perfil próprio da tarefa (necessário quando não há processo para derivá-lo).
alter table tarefas add column if not exists perfil perfil_area;
-- Referência livre exibida quando a tarefa não está vinculada a um processo.
alter table tarefas add column if not exists referencia text;

-- Backfill do perfil a partir do processo nas tarefas já existentes (todas têm processo).
update tarefas t
   set perfil = p.perfil
  from processos p
 where t.processo_id = p.id
   and t.perfil is null;

-- A partir daqui o perfil é obrigatório.
alter table tarefas alter column perfil set not null;

-- Lista da aba Tarefas passa a filtrar por tarefas.perfil (não mais via join no processo).
create index if not exists idx_tarefas_perfil on tarefas(perfil);
