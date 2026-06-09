-- =============================================================================
-- Disparo diário de intimações por e-mail.
-- ADIÇÃO ao schema — não altera nada do que já existe (0001/0002).
-- =============================================================================

-- intimacoes: marca quando a intimação entrou num disparo (idempotência por linha).
-- NULL = ainda não notificada; o disparo só seleciona as NULL.
alter table intimacoes add column if not exists notificada_em timestamptz;

-- processos: nomes das partes em cada polo. Preenchidos À MÃO no cadastro/edição
-- (editáveis, como classe/órgão). NÃO vêm do DJEn nem do Datajud.
-- Usados no cabeçalho do cartão do e-mail: "[polo ativo] v. [polo passivo]".
alter table processos add column if not exists polo_ativo   text;
alter table processos add column if not exists polo_passivo text;

-- destinatarios_disparo — e-mails que recebem o disparo, por área.
-- Reusa o enum perfil_area (civel | trabalhista). Roteamento estrito por área.
create table if not exists destinatarios_disparo (
  id         uuid primary key default gen_random_uuid(),
  area       perfil_area not null,
  email      text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_destinatarios_area on destinatarios_disparo(area);

-- app_config — chaves do disparo (com defaults). Editáveis em Configurações.
--   disparo_hora        : hora do disparo no fuso (0–23). Default 8.
--   disparo_timezone    : fuso para calcular a hora. Default America/Sao_Paulo.
--   disparo_remetente   : e-mail remetente (verificado no provedor de envio).
--   disparo_ultima_data : última data (YYYY-MM-DD no fuso) em que disparou — idempotência.
insert into app_config (chave, valor) values
  ('disparo_hora',        '8'),
  ('disparo_timezone',    'America/Sao_Paulo'),
  ('disparo_remetente',   ''),
  ('disparo_ultima_data', '')
on conflict (chave) do nothing;

-- ----------------------------------------------------------------------------
-- RLS — mesma política PROVISÓRIA do MVP (anon liberado) da tabela nova.
-- Ver a nota de Segurança em 0001_init.sql / README. A endurecer com Supabase Auth.
-- (As Edge Functions usam a service_role key e ignoram o RLS de qualquer forma.)
-- ----------------------------------------------------------------------------
alter table destinatarios_disparo enable row level security;
drop policy if exists anon_all_destinatarios_disparo on destinatarios_disparo;
create policy anon_all_destinatarios_disparo on destinatarios_disparo
  for all to anon, authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Agendamento (pg_cron + pg_net): NÃO fica aqui.
-- O job de hora em hora embute a URL do projeto + uma key, então é um passo
-- único de implantação documentado no README ("Disparo diário por e-mail").
-- ----------------------------------------------------------------------------
