-- =============================================================================
-- Remove polo_ativo / polo_passivo de processos (adicionados em 0003).
-- O cabeçalho "[ativo] v. [passivo]" do e-mail de disparo passa a ser DERIVADO
-- de posicao_cias + rotulo (parte contrária) — sem campos manuais redundantes:
--   posicao_cias = ativo   => CIAS v. [parte contrária]
--   posicao_cias = passivo => [parte contrária] v. CIAS
-- =============================================================================
alter table processos drop column if exists polo_ativo;
alter table processos drop column if exists polo_passivo;
