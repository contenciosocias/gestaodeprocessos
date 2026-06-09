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
    │   └── 0001_init.sql      # tabelas, enums, constraints, RLS, defaults
    └── functions/
        ├── _shared/cors.ts
        ├── sync-intimacoes/   # DJEn — puxa intimações por processo
        └── consulta-datajud/  # Datajud — classe + órgão julgador no cadastro
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
(o prazo fatal é digitado à mão), relatórios/gráficos/exportações, notificações, agendamento/cron
da sincronização, nem importação de movimentações do Datajud (são sempre manuais). Apenas **um
nível** de apensamento (sem apenso de apenso).
