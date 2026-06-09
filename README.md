# Contencioso CIAS — Controle de Intimações

Painel interno do contencioso do **CIAS (Consórcio Intermunicipal Aliança para a Saúde)**,
dividido em **Cível** e **Trabalhista**. A função central é **capturar e controlar as
intimações via DJEn**, substituindo o acompanhamento manual.

É um **MVP** deliberadamente enxuto: sem login, sem cálculo de prazo, sem relatórios,
sem notificações. Front-end estático (GitHub Pages) + Supabase (Postgres + Edge Functions).

---

## Sumário

- [Como funciona](#como-funciona)
- [Stack](#stack)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Setup passo a passo](#setup-passo-a-passo)
  - [1. Criar o projeto no Supabase](#1-criar-o-projeto-no-supabase)
  - [2. Aplicar as migrations (banco)](#2-aplicar-as-migrations-banco)
  - [3. Publicar as Edge Functions](#3-publicar-as-edge-functions)
  - [4. Rodar o front localmente](#4-rodar-o-front-localmente)
  - [5. Publicar no GitHub Pages](#5-publicar-no-github-pages)
  - [6. Disparo diário por e-mail](#6-disparo-diário-por-e-mail)
- [Ordem de uso](#ordem-de-uso)
- [Integrações (DJEn e Datajud)](#integrações-djen-e-datajud)
- [Identidade visual](#identidade-visual)
- [Segurança](#segurança)
- [Limitações do MVP](#limitações-do-mvp)

---

## Como funciona

- O cabeçalho tem o **logo do CIAS** e um **seletor de perfil** (Cível / Trabalhista).
  Trocar de perfil é livre (não há autenticação). À direita: **Atualizar agora** e **Configurações**.
- Cada perfil mostra **só** os seus processos e intimações, em duas abas:
  - **Intimações** — caixa de entrada das intimações, da mais recente para a mais antiga.
    Edição inline de **status**, **prazo fatal** e **observação**.
  - **Processos** — cadastro dos processos do CIAS (um a um). Cada principal expande para
    seus **apensos**; cada processo abre uma **janela de detalhes** completa.
- **Configurações** é uma área global (fora de Cível/Trabalhista): cadastro das **OABs
  monitoradas** e da **configuração das APIs**.
- **Sincronização:** ao abrir/recarregar o app, se passaram ~10 min desde a última
  sincronização, o front chama a Edge Function `sync-intimacoes` (a busca é **por número de
  processo**, restrita aos processos cadastrados, e mantém só as intimações dirigidas às OABs
  monitoradas). O botão **Atualizar agora** força a sincronização, ignorando o throttle.

> A **área (cível/trabalhista)** de uma intimação vem **sempre do processo** em que ela casa,
> nunca da OAB e **nunca derivada do número CNJ** (há processo trabalhista na Justiça Estadual).

---

## Stack

- **Front-end:** Vite + React + TypeScript + Tailwind (SPA estática, sem roteador).
- **Back-end:** Supabase — Postgres + Edge Functions (Deno/TypeScript).
- **Integrações externas (DJEn e Datajud):** feitas **dentro das Edge Functions** (lado
  servidor) para evitar CORS e centralizar a lógica. O front chama via
  `supabase.functions.invoke(...)`.

---

## Estrutura do repositório

```
.
├── index.html
├── package.json
├── vite.config.ts            # base do GitHub Pages via VITE_BASE
├── tailwind.config.js        # tokens de cor da marca CIAS
├── .env.example              # variáveis do front (copie para .env)
├── public/
│   ├── favicon.svg
│   └── logo-cias.png         # << COLOQUE O LOGO AQUI (veja o .txt na pasta)
├── src/
│   ├── App.tsx               # navegação por estado (perfil/aba/config) + sync
│   ├── types.ts              # tipos espelhando o schema
│   ├── lib/
│   │   ├── supabase.ts       # cliente supabase-js
│   │   ├── api.ts            # acesso a dados + orquestração das Edge Functions
│   │   ├── cnj.ts            # número CNJ (dígitos, máscara)
│   │   └── format.ts         # datas e classificação de prazos
│   └── components/           # Header, abas, modais, Configurações
└── supabase/
    ├── config.toml           # verify_jwt = false nas funções (sem login)
    ├── migrations/
    │   ├── 0001_init.sql      # tabelas, enums, constraints, RLS, defaults
    │   ├── 0002_data_ajuizamento.sql
    │   ├── 0003_disparo_diario.sql  # notificada_em, destinatarios_disparo, config do disparo
    │   └── 0004_remove_polo.sql     # remove polo_ativo/passivo (cabeçalho do e-mail vira derivado)
    └── functions/
        ├── _shared/cors.ts
        ├── _shared/sync.ts    # sincronização DJEn (compartilhada pelas 2 funções abaixo)
        ├── _shared/email.ts   # envio de e-mail (provider isolado: Brevo)
        ├── sync-intimacoes/   # DJEn — puxa intimações por processo (chamada pelo front)
        ├── consulta-datajud/  # Datajud — classe + órgão julgador no cadastro
        └── disparo-diario/    # cron horário — e-mail diário de intimações por área
```

---

## Setup passo a passo

Pré-requisitos: **Node 18+**, conta no **Supabase** e (para deploy) repositório no **GitHub**.
Para publicar as funções/migrations, instale o **Supabase CLI**:
<https://supabase.com/docs/guides/cli>.

### 1. Criar o projeto no Supabase

1. Crie um projeto em <https://supabase.com>.
2. Anote, em **Project Settings → API**:
   - **Project URL** → vira `VITE_SUPABASE_URL`
   - **anon public key** → vira `VITE_SUPABASE_ANON_KEY`

### 2. Aplicar as migrations (banco)

**Opção A — SQL Editor (mais simples):** abra o **SQL Editor** no painel do Supabase, cole o
conteúdo de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) e execute.

**Opção B — Supabase CLI:**

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

Isso cria as tabelas (`oabs`, `processos`, `intimacoes`, `movimentacoes`, `app_config`,
`sync_state`), os enums, as constraints (inclusive a unicidade do CNJ e a FK de apensamento),
o RLS (liberado para anon — provisório) e já insere os **defaults** de configuração das APIs.

### 3. Publicar as Edge Functions

```bash
supabase functions deploy sync-intimacoes
supabase functions deploy consulta-datajud
supabase functions deploy disparo-diario   # e-mail diário — exige o secret do Brevo + cron (ver seção 6)
```

As funções usam automaticamente as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
do ambiente Supabase — **não é preciso configurar segredos manualmente**. O `verify_jwt = false`
(em `supabase/config.toml`) permite a invocação sem login de usuário (apenas com a anon key).

> As URLs base e a APIKey do Datajud ficam na tabela `app_config` (editáveis em **Configurações**).
> Se uma chave faltar, a função usa o **default embutido**.

### 4. Rodar o front localmente

```bash
cp .env.example .env       # edite com a URL e a anon key do passo 1
npm install
npm run dev
```

Abra o endereço que o Vite imprimir (ex.: <http://localhost:5173>).

### 5. Publicar no GitHub Pages

1. Suba o código para um repositório no GitHub.
2. Em **Settings → Pages**, defina **Source = GitHub Actions**.
3. Em **Settings → Secrets and variables → Actions → Variables**, crie:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (a anon key é pública por natureza — pode ficar em *Variables*.)
4. Faça push na branch `main`. O workflow [`deploy.yml`](.github/workflows/deploy.yml) builda
   e publica. O **`base`** do Vite é ajustado automaticamente para `/<nome-do-repo>/`.

> **Domínio próprio?** Configure o CNAME no Pages; nesse caso o `base` deve ser `/`
> (ajuste a env `VITE_BASE` no workflow, ou remova-a).

### 6. Disparo diário por e-mail

Envio diário, sem ninguém abrir a plataforma: a Edge Function `disparo-diario` busca as
intimações (rodando a mesma sincronização do `sync-intimacoes`) e manda **um e-mail por área**
aos responsáveis — com as novas intimações da área ou avisando que não há novidades. Roteamento
**estrito por área**: cíveis só para os e-mails cíveis; trabalhistas só para os trabalhistas.

**a) Provedor de e-mail (Brevo).** Sem domínio próprio, use o [Brevo](https://www.brevo.com)
(faixa gratuita permanente de ~300 e-mails/dia, API HTTP).

1. Crie a conta e **verifique um remetente** (Senders & IP → adicione e confirme um e-mail).
   Esse endereço é o que vai em **Configurações → Disparo de intimações → E-mail remetente**.
2. Gere uma **API key** (SMTP & API → API Keys) e grave como secret da função:

   ```bash
   supabase secrets set BREVO_API_KEY=xkeysib-xxxxxxxx
   ```

**b) Publique a função:**

```bash
supabase functions deploy disparo-diario
```

**c) Agende o cron (uma vez, no SQL Editor).** Habilita as extensões e cria um job que roda
**a cada 5 minutos**; a própria função decide se é a hora certa — hora **e minuto** (assim, mudar
o horário em Configurações **não** exige remexer no cron). Troque `SEU_PROJECT_REF` e `SUA_ANON_KEY`:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'disparo-diario',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/disparo-diario',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer SUA_ANON_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

> A **hora do disparo** é configurada em formato `HH:MM` (Configurações → Disparo de intimações);
> o job de 5 em 5 minutos dispara no primeiro tick dentro da janela do horário escolhido (uma vez ao dia).
> Para conferir/limpar: `select * from cron.job;` e `select cron.unschedule('disparo-diario');`.
> Para testar **fora da hora**, invoque a função com `{ "forcar": true }` no corpo (pula a guarda
> de horário; ainda envia de verdade e marca as intimações).

**d) Configure em Configurações → Disparo de intimações:** hora (0–23), fuso (default
`America/Sao_Paulo`), o e-mail remetente verificado e as listas de e-mails de cada área.

**e) Entregabilidade (sem domínio próprio).** A entrega é mais fraca: peça aos destinatários para
marcarem o **primeiro e-mail como "não é spam"** e adicionarem o remetente aos contatos confiáveis.
**Melhoria futura:** com um domínio próprio, autenticá-lo no Brevo (SPF/DKIM) resolve a entrega.

---

## Ordem de uso

1. **Configurações → Advogados monitorados (OABs):** cadastre as inscrições (número, UF, nome)
   cujas intimações devem ser puxadas — cíveis e trabalhistas na mesma lista.
2. **Processos:** cadastre os processos do CIAS (número CNJ). No cadastro, o sistema consulta o
   **Datajud** e preenche **classe** e **órgão julgador** (editáveis). Preencha os demais campos
   na janela de detalhes; adicione **apensos** por lá.
3. **Intimações:** aparecem automaticamente após a sincronização (ou clique em **Atualizar agora**).

---

## Integrações (DJEn e Datajud)

Ambas rodam **dentro de Edge Functions** (servidor), com CORS habilitado.

### DJEn — `sync-intimacoes`

- Base (default, editável em `app_config.djen_base_url`): `https://comunicaapi.pje.jus.br/api/v1`
- Consulta **pública** (sem auth): `GET /comunicacao?numeroProcesso=<20 dígitos>&pagina=&itensPorPagina=`
- Para **cada processo** cadastrado, pagina o resultado e **mantém só** as comunicações dirigidas
  a uma das **OABs monitoradas** (compara `numero_oab` + `uf_oab`, normalizados).
- Deduplica por `hash` da comunicação (`id_externo`), com **`ON CONFLICT (id_externo) DO NOTHING`**:
  o conteúdo do DJEn é imutável para nós e os campos editados (status, prazo fatal, observação)
  **nunca** são sobrescritos.

### Datajud — `consulta-datajud`

- Base (default, editável em `app_config.datajud_base_url`): `https://api-publica.datajud.cnj.jus.br`
- `POST /api_publica_<alias>/_search` com header `Authorization: APIKey <chave>`
  (chave pública em `app_config.datajud_api_key`).
- **Roteamento por tribunal** (escopo atual MG): Justiça Estadual de MG → `tjmg`; TRT 3ª Região → `trt3`.
  Tribunal fora do mapa → a consulta é **pulada** (o processo é salvo; classe/órgão ficam para
  preenchimento manual). Esse roteamento **só** escolhe o endpoint — **não** classifica cível/trabalhista.
- Preenche **apenas classe e órgão julgador**. **Não** importa movimentações (decisão do cliente;
  o histórico é mantido à mão). Falha/retorno vazio → retorna sem erro e o processo é salvo mesmo assim.

---

## Identidade visual

Paleta da marca (vermelho/laranja/branco) em `tailwind.config.js`, sob o namespace `cias`.
Layout sóbrio: fundo claro, bastante espaço em branco, tipografia Inter, cor forte só como **acento**.

> Ajuste os tons de `cias.vermelho`/`cias.laranja` aos **valores exatos do logo** e coloque o
> arquivo em **`public/logo-cias.png`** (veja a nota dentro de `public/`).

Status: **Nova** (laranja), **Lida** (cinza), **Providenciada** (verde discreto). Prazo fatal
vencido ou próximo (≤ 3 dias) aparece destacado em **vermelho**.

---

## Segurança

> ⚠️ **MVP sem login.** O RLS está **liberado para acesso anônimo** e as Edge Functions são
> invocadas apenas com a **anon key** (pública por natureza — vai no bundle estático).
> Na prática, **qualquer pessoa com a URL e a anon key acessa e edita os dados e as
> configurações** (incluindo a APIKey do Datajud). Isso é **aceitável para o MVP interno**.
>
> **A endurecer depois:** adicionar **Supabase Auth** (login), trocar as políticas de RLS
> `using(true)` por políticas baseadas em usuário, e exigir JWT de usuário nas funções
> (`verify_jwt = true`). Os pontos a alterar estão comentados no código
> (`migrations/0001_init.sql`, `supabase/config.toml`, `src/lib/supabase.ts`).

---

## Limitações do MVP

Por decisão de escopo, **não** há (ainda): login/autenticação, cálculo automático de prazo
(o prazo fatal é digitado à mão), relatórios/gráficos/exportações, nem importação de movimentações
do Datajud (são sempre manuais). Apenas **um nível** de apensamento (sem apenso de apenso).

Há **um** disparo automático: o e-mail diário de intimações (seção
[Disparo diário por e-mail](#6-disparo-diário-por-e-mail)), agendado por `pg_cron`. Fora dele, a
sincronização continua sob demanda (ao abrir o site / botão **Atualizar agora**).
