-- =============================================================================
-- Adiciona a data de ajuizamento ao processo.
-- Puxada automaticamente do Datajud (campo dataAjuizamento) no cadastro;
-- permanece editável na janela de detalhes, como classe e órgão julgador.
-- =============================================================================
alter table processos add column if not exists data_ajuizamento date;
