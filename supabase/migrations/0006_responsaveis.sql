-- =============================================================================
-- responsaveis — lista de pessoas selecionáveis ao atribuir uma tarefa.
-- Cadastrada em Configurações; a tarefa guarda apenas o NOME escolhido (texto),
-- então remover alguém daqui não altera tarefas já atribuídas.
-- =============================================================================
create table if not exists responsaveis (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  created_at timestamptz not null default now()
);

-- RLS — PROVISÓRIO: acesso liberado a anon + authenticated, igual às demais tabelas
-- (MVP sem login; ver seção "Segurança" do README e o comentário na 0001).
alter table responsaveis enable row level security;
drop policy if exists anon_all_responsaveis on responsaveis;
create policy anon_all_responsaveis on responsaveis for all to anon, authenticated using (true) with check (true);
