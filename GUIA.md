# Planejamento de Horas — guia do código

Guia para quem for alterar a ferramenta (inclusive o Claude numa conversa nova).
Leia isto antes de mexer: diz onde fica cada coisa, como os dados são guardados e
como testar.

## Duas versões, o mesmo código

- **claude.ai (Artifact):** usa o banco, os downloads e o conector do Google Agenda do claude.ai
  (`window.claude`). Ao publicar, o bloco entre `<!-- site:inicio -->` e `<!-- site:fim -->` do
  `index.html` é retirado.
- **Site próprio (GitHub Pages + Firebase):** o `index.html` completo. O `js/site.js` mostra a
  tela de login e cria um `window.claude` com o mesmo jeito de usar: `use("db")` grava no Firestore
  em `users/<uid>/...` (mesmos caminhos: `projects/…`, `templates/…`, `cadetapas/…`, `meta/…`),
  `use("downloads")` baixa pelo navegador e `use("mcp")`/`use("permissions")` falam direto com a
  API do Google Agenda (Google Identity Services, escopo `calendar.events`). Ao trocar de usuário
  no mesmo navegador, a cópia local (`phs2`, `phtpl`, `phcad3`…) é apagada. O resto da ferramenta
  não sabe em qual versão está (exceto os textos da agenda: `window.SITE_PROPRIO`).
- Passo a passo de instalação para o usuário: `LEIA-ME.md`.

## Estrutura

A página é publicada como Artifact no claude.ai, com as capacidades `db` (banco da
conta) e `downloads` (salvar arquivos). Os arquivos são carregados nesta ordem pelo
`index.html` e compartilham as mesmas variáveis globais (scripts comuns, sem módulos):

| Arquivo | Assunto |
|---|---|
| `app.css` | Visual: cores (tema claro e escuro), layout, tabelas, cores dos status |
| `js/nucleo.js` | Constantes, status, datas (`hoje`, `dataBR`, `somarDias`), horas (`fmtHoras`, `lerHoras`, `emDias`), `$`, `escaparHtml`, geradores de id |
| `js/acoes.js` | **Tabela de ações dos botões** (`acao`, `SALVA`, `SALVA_LINHA`) e o único ouvinte de cliques |
| `js/menus.js` | Menus suspensos (`.dd` / `[data-dd]` / `.ddm`): abrir, posicionar, fechar ao clicar fora, Esc |
| `js/agenda.js` | Vínculo com o Google Agenda (conector do claude.ai; no site, a API do Google via `site.js`) |
| `js/backup.js` | Backup de tudo (.json): baixar e restaurar (botão "💾 Backup ▾" da tela inicial) |
| `js/site.js` | **Só no site próprio**: login (Firebase Authentication), banco (Firestore), downloads e Google Agenda |
| `config.js`, `firestore.rules`, `LEIA-ME.md` | Configuração, regras do banco e passo a passo de instalação do site próprio |
| `js/estrutura.js` | Formatos dos dados (atual e antigos), conversão para o atual e funções de leitura que entendem todos (`percorrerAtividades`, `percorrerBlocos`, `listarPares`, `listarEtapas`) |
| `js/dados.js` | Estado do projeto aberto (`estado`, `projetos`), salvar/carregar, desfazer/refazer, totais |
| `js/modelos.js` | Modelo JBLUE, escopos, cópias, biblioteca de modelos próprios, replicar pavimento |
| `js/cadastros.js` | Gestor de Cadastros: etapas base e, em cada uma, as disciplinas com as atividades do bloco "Escopo + Geral" (janela "Cadastros") |
| `js/calendario.js` | Dias úteis, feriados (`pascoa`, `feriados`), previsão de término, cronograma (Gantt) |
| `js/projetos.js` | Tela inicial (cards de projetos), tela do projeto (etapas com as disciplinas) e novo projeto |
| `js/atividades.js` | Tela da disciplina (dentro de uma etapa): linhas das atividades, pavimentos, filtros, seleção em lote, arrastar, edição dos campos |
| `js/cronometro.js` | Play/pausa, barra do cronômetro, registro de horas por dia (`registrarHoras`, `registrarIntervalo`) |
| `js/horas.js` | Aba "Horas trabalhadas" (dia/semana/mês, lançamento manual, horas sem data) |
| `js/historico.js` | Histórico estimado × real (dica no campo Estimado; tabelas por etapa e por disciplina) |
| `js/importar.js` | Importação de Excel (planilha original e Excel exportado pela ferramenta) |
| `js/exportar.js` | Exportação do projeto em PDF e Excel |
| `js/janelas.js` | Janelas (status, calendário, atalhos, modelos, histórico), disciplinas, tema |
| `js/iniciar.js` | Conexão com o banco da conta, migração e carregamento dos projetos |
| `testes/` | Testes automáticos (não são carregados pela página) |

Ao criar um arquivo `.js` novo: incluir a tag `<script>` no `index.html` (depois de
`nucleo.js` e `acoes.js`) **e** incluí-lo na lista de arquivos ao publicar.

## Dados

### Onde ficam guardados
- **Banco da conta** (`claude.use("db")`): coleção `projects/{id}` com
  `{ name, etapa, j, upd }` (`j` = o estado do projeto em JSON) e coleção
  `templates/{id}` com `{ nome, tipo, j, upd }`; coleção `cadetapas/{id}` (uma **etapa** por
  documento) com `{ nome, ordem, disciplinas: [{ id, nome, sigla, atividades: ["nome", ...] }], upd }`;
  coleção `copias/{id}` com a cópia dos formatos 0/1 de cada projeto e `copias/{id}-v2` com a
  cópia da versão 2. A coleção `cadastros/{id}` (cadastros da versão anterior, por disciplina)
  fica guardada como estava: é lida uma vez para a conversão. Documentos `meta/migrated`,
  `meta/cadastros` (antigo) e `meta/cadetapas` marcam a migração inicial e o preenchimento
  inicial dos cadastros.
- **Navegador** (`localStorage`): `phs2` cópia local de todos os projetos (usada sem
  conta); `phtpl` modelos; `phcol` pavimentos recolhidos; `phsort` ordenação;
  `phhc` ocultar detalhes; `phfb` filtros dos pavimentos; `pht` tema; `phrg` resumo da etapa recolhido; `phcg` cronograma das etapas recolhido; `phcad3` cadastros; `phcad3-ini` cadastros já
  preenchidos (`phcad`/`phcad-ini` são os da versão anterior); `phcopias` cópias dos formatos antigos.

**Não renomeie os campos abaixo nem essas chaves**: os projetos já gravados dependem deles.

### Estado de um projeto (`estado`, gravado em `j`)
```
hd: horas produtivas por dia
run: { id da atividade, t0 (início, ms) } | null   — cronômetro rodando
pe: [nomes dos responsáveis]
status: [{ n: nome, r: comportamento, c: índice da cor }]
        comportamentos: pend (em aberto), and (em andamento), fp (falta publicar),
                        ok (concluído), sa (sem ação, fora dos totais)
cal: { dias: [0-6, dias úteis; 0 = domingo], ev: [{ id, nome, ini, fim }] }
versao: 3
etapas: [{ id, nome, cadastroId (etapa do cadastro), ini, fim,     ← datas só na etapa
  disciplinas: [{ id, nome (sigla, ex.: ELT), escopo (origem), cadastroDiscId,
    blocos: [{ n, tipo: "escopo", it: [...] },  ← "Escopo + Geral", sempre o primeiro
             { n: "Subsolo", it: [...] }, …,    ← pavimentos (atividades manuais)
             { n: "Apontamentos a atender", it: [...] }] }] }]
```

### Hierarquia: Projeto > Etapa > Disciplina > Escopo + Pavimentos > Atividades
- A tela do projeto lista as **etapas** (ex.: Estudo Preliminar, Projeto Básico), com início,
  fim, previsão, status e o botão **Abrir** (`abrirEtapa(ei)`). "+ Etapa" fica embaixo da
  lista (etapas do cadastro ou nome livre) e já abre a janela "+ Disciplina".
- **Layout da tela da disciplina** (out/2026): caminho clicável "Projetos › projeto › etapa ›
  disciplina" (`#bchome`, `#back`, `#bcet`, `#bcdi`); à direita ↶ ↷, **Exportar ▾** (PDF/Excel),
  Horas trabalhadas, Histórico e **⚙ Configurações ▾** (Horas por dia `#hd`, Responsáveis — janela
  `pe`, `janelaResponsaveis` —, Status, Calendário, Cadastros, Modelos, Google Agenda, Atalhos, Tema
  `data-thm`). Logo abaixo, os botões das disciplinas (`#tabs`) com "+ Disciplina" e ⋯ (Renomear,
  Excluir). "Resumo geral da etapa" destaca a disciplina aberta (`tr.cur`, nome clicável) e recolhe
  (`#tgger`). Uma barra só (`#plb`): Selecionar, Ordenar por prioridade, Puxar pendências,
  **Cadastro ▾** (`#scb`: disciplina do cadastro, Carregar as que faltam, Salvar no cadastro) e, à
  direita, Recolher/Expandir tudo e comentários. No pavimento, ⋯ junta Duplicar, Replicar, Salvar
  como modelo e Excluir. Não há mais os 4 cartões de totais nem a linha de responsáveis na tela.
  Itens de menu continuam sendo botões comuns com as mesmas ações (`acao`); para um item novo, basta
  colocar o botão dentro do `.ddm` certo (`data-ddkeep` deixa o menu aberto depois do clique).
- **Tela do projeto** (lista das etapas, `#etp`) no mesmo padrão: caminho "Projetos › projeto"
  (`#eback`, `#ebcp`), Exportar ▾ (`data-exp="pdf|xlsx"`), Horas trabalhadas, Histórico e
  ⚙ Configurações ▾ (Horas por dia `#ehd`, Responsáveis, Status, Calendário, Cadastros, Modelos,
  Google Agenda, Atalhos, Tema). "+ Etapa ▾" no título do quadro Etapas (`#enf`: `#ds`, `#dn2`,
  `#da`; avisos em `#enfm` e `#emsg`). Cada etapa tem "Abrir" e ⋯ (Abrir, Excluir). O cronograma
  vem depois da tabela e recolhe (`#tgcg`). Sem os 4 cartões de totais (o total está na tabela).
  O botão Tema do topo só aparece na tela inicial (`body[data-tela]`).
- **Abrir** leva à tela de atividades da etapa: "Resumo geral da etapa" (uma linha por
  disciplina e o total), os **botões das disciplinas** (a aberta fica destacada; clicar mostra
  as atividades dela — `data-tab`) e os botões "+ Disciplina", "Renomear" e "Excluir". A etapa
  reabre na última disciplina usada (`discLembrada`); etapa sem disciplinas pede a primeira.
- "+ Disciplina" é a janela `dadd` (`janelaNovaDisciplina`, `opcoesNovaDisciplina`,
  `adicionarDisciplina`): disciplinas do cadastro da etapa com as atividades, "Todas as que
  faltam", disciplinas de outras etapas sem atividades, ou nome livre. Adicionar uma disciplina
  que já existe completa só as atividades que faltam. "💾 Salvar no cadastro" (`#scsv`) fica na
  barra "Atividades do cadastro".
- "Puxar pendências de outra etapa" (`#pend`, janela `pend`, em `modelos.js`): escolhe outra
  etapa que tenha a mesma disciplina e copia as atividades não concluídas (nem "sem ação"; os
  apontamentos ficam de fora) para o bloco "Pendências da etapa <nome>", com estimado = o que
  restava e sem horas usadas; `po` guarda a origem para não puxar de novo. As originais não mudam.
- A tela de atividades é a de **uma disciplina dentro de uma etapa** (título "PP · ELT").
  `estado.ei`/`estado.di` = etapa e disciplina abertas; `estado.etapaAberta`,
  `estado.discAberta`; `estado.disc[estado.tab]` são os blocos da disciplina aberta.
  "← Projeto" volta para a lista das etapas.
- Totais: `totaisEtapa(x)` serve para a etapa (soma as disciplinas) e para a disciplina (soma
  os blocos). A previsão de término (`previsaoTermino`) é por etapa.
- O cadastro da etapa é achado por `cadastroDaEtapa` (pelo `cadastroId` ou pelo nome); a
  disciplina dentro dele por `acharDiscCadastro` (sigla ou nome). "Carregar as que faltam"
  (`carregarAtividadesDoCadastro`) e o 💾 (salvar o Escopo + Geral no cadastro) usam isso.
  O estimado vem da média real do histórico (`estimativaDoHistorico`), ou 0.
- Para percorrer atividades de qualquer projeto use `percorrerAtividades(dados, fn)` /
  `percorrerBlocos` (contexto `{ etapa, disc, disciplina, ei, di, bi, bloco }`). Projetos
  ainda em formato antigo são lidos numa cópia convertida; para **alterar** um projeto que não
  está aberto use `editarProjetoSalvo`, que converte antes.

### Formatos antigos e conversão
- Versão 2 (out/2026): Projeto > Disciplina > Etapa (`disciplinas: [{ etapas: [...] }]`).
  Formato 1: Projeto > Etapa com as disciplinas num objeto (`disc: { ELT: [...] }`).
  Formato 0: uma etapa só.
- Projetos antigos são convertidos **ao abrir** (`abrirProjeto`) ou ao serem alterados, com
  cópia de segurança (`guardarCopiaFormatoAntigo`). Da versão 2, as etapas de mesmo nome
  em disciplinas diferentes viram uma etapa só, com o início mais cedo e o fim mais tarde.
- Os cadastros antigos (disciplina > etapas) são convertidos uma vez para etapa >
  disciplinas (`converterCadastrosAntigos`).

### Novo projeto, relatórios e importação
- O botão "+ Novo projeto" abre a janela `#npf`. **Novo**: nome, etapa do cadastro (ou
  "Nenhuma") e as disciplinas da etapa marcadas (já entram com as atividades do cadastro);
  sem etapa fica só o nome (`dadosNovoProjeto("vazio")`). **Copiar projeto**
  (`dadosNovoProjeto("copy:<id>")`: zera usado, registro diário, datas e status; mantém
  estimado e responsáveis; descarta comentários e apontamentos) ou **Importar Excel**
  (`importarProjeto`). Os modelos JBLUE ficaram só para testes (`criarProjetoModelo`).
- Relatórios só em **PDF e Excel**, organizados por **Etapa · Disciplina**. Excel do projeto:
  abas `Resumo` (subtotal por etapa), `Etapas` (Etapa, Disciplina, Início, Fim, …, Origem;
  uma linha por disciplina), uma aba `"Etapa · Disciplina"` por disciplina e `Configurações`.
- A importação lê o Excel atual, o da versão 2 (abas `"Disciplina · Etapa"`; a ordem é
  reconhecida pela aba `Etapas`) e os mais antigos (abas `"Etapa - Disciplina"`).
- "Horas trabalhadas" mostra a **Agenda do período** (`desenharAgenda`, `blocosAgenda`): as
  sessões do cronômetro (`ss`) viram blocos "08:00–10:00 · Projeto" (só o projeto)
  (sessões seguidas do mesmo projeto se juntam). "Baixar para importar na agenda (.csv)"
  gera o arquivo no formato de importação do Google Agenda (eventos particulares).
- **Google Agenda em tempo real** (`js/agenda.js`): botão "📅 Vincular Google Agenda" na tela
  inicial (`#gcal`, janela `gcal`). Usa o conector "Google Calendar" do claude.ai pela
  capacidade `mcp` (ferramenta `create_event`); o login no Google é feito no próprio conector
  (claude.ai → Configurações → Conectores), a página nunca vê e-mail nem senha. O formato do
  evento é lido com `describeTool` e montado em `montarEvento`. Cada uso do cronômetro de 1 min
  ou mais (`agendaSessao`, chamado em `pararCronometro`/`encerrarCronometro`) vira um evento
  particular "⏱ <projeto>" na agenda principal. Estado só neste navegador (`phgcal`): fila
  `pendentes` (erros em que o pedido nem saiu: tenta de novo sozinha), `falhas` (resultado
  incerto: só reenvia com o botão Reenviar, para não duplicar) e `enviados` (últimos 50).
  Nos testes o conector é simulado em `testes/ambiente.js` (`__mcpmodo` = "nc" ou "falha").
- Horas trabalhadas exportam em Excel (abas `Horas`, `Por dia`, `Período`), com as colunas
  Projeto, Etapa, Disciplina, Bloco, Atividade, Horas.

### Atividade
```
id   identificador          d   descrição            r   responsável
s    nome do status         e   estimado (horas)     u   usado (horas)
c    data de conclusão      pr  prioridade "a"/"m"/"b"
cm   comentários [{ t: texto, d: data em ms }]
l    ações (checklist dos apontamentos) [{ t: texto, c: feita }]
h    link do Construflow (apontamentos)
lg   registro diário de horas [{ d: "aaaa-mm-dd", h: horas }]
ss   sessões do cronômetro [[início ms, fim ms], ...] — usadas na agenda (blocos de horário)
po   atividade de origem (id), quando foi puxada como pendência de outra etapa
```
Datas são texto `aaaa-mm-dd`; horas são números decimais (1,5 = 01:30).
Para mostrar: `fmtHoras(h)` e `dataBR(d)`. Para ler o que o usuário digitou: `lerHoras(texto)`.

## Como as coisas funcionam

- **Botões**: cada botão é ligado a uma ação pelo `id` ou por um atributo `data-*`.
  Registre no arquivo do assunto:
  ```js
  acao("#meu-botao", () => { ... });                 // pelo id
  acao("data-minha-acao", (valor) => { ... }, SALVA); // pelo atributo; SALVA = redesenha e salva
  acao("data-x", (id) => { ... }, SALVA_LINHA);      // salva e atualiza só a linha da atividade
  ```
  A ação pode devolver `false` para não redesenhar/salvar. Opção `{ janela: true }`:
  só roda com uma janela aberta.
- **Campos editáveis** (inputs e selects): o ouvinte `change` em `atividades.js` grava o
  valor; campos de uma atividade usam `data-f="campo"` e `data-i="id"`.
- **Salvar**: `salvar()` grava o projeto aberto (banco + navegador) e registra o passo
  para desfazer. Projetos que não estão abertos: `editarProjetoSalvo(id, (dados) => {...})`.
- **Redesenhar**:
  - `desenhar()` redesenha a tela atual inteira (início, etapas ou etapa);
  - `atualizarAtividade(id)` troca só a linha da atividade, o cabeçalho do pavimento e
    os totais — use depois de mudar **uma** atividade (é 15 a 40 vezes mais rápido);
  - `desenharTotais()` atualiza só os totais, o resumo e os alertas.
  - O HTML vem de funções `html...` (`htmlAtividade`, `htmlPavimentos`,
    `htmlCabecalhoPavimento`, `htmlDetalhes`, `htmlAlertas`).
- **Filtros**: não há filtro geral. Cada pavimento (e o Escopo + Geral) tem filtros nas
  colunas **Status**, **Conclusão** (data de entrega) e **Responsável**, como no Excel: o ▾ no título abre a lista de valores
  (`abrirFiltroBloco`, `#fpop`); `filtrosBloco[chaveRecolhido(bloco)] = { s, c, r }`,
  guardado no navegador ("phfb"); `passaNosFiltros(atividade, bloco)`. Com algum filtro ativo,
  arrastar fica desligado e as edições redesenham a tela.
- **Achar dados**: `acharAtividade(id)` (projeto aberto), `paraCadaAtividade(fn)` (todos
  os projetos), `atividadesDaDisciplina(d)`, `usadoAtual(i)` (inclui o cronômetro),
  `restante(i)`, `comportamentoDo(nomeStatus)`, `estaConcluido(nomeStatus)`.
- **Telas**: `telaAtual` é `"home"`, `"etapas"` (tela do projeto) ou `"etapa"` (tela de
  uma disciplina, aberta por `abrirDisciplina(ei, di)`); `idProjetoAberto` é o projeto
  aberto (ou `null`).

## Receita para uma melhoria

1. Ache o arquivo do assunto na tabela acima.
2. Para um botão novo: coloque o `<button id=...>` no HTML (no `index.html` ou na
   função `html...` que desenha aquela parte) e registre com `acao(...)`.
3. Para um campo novo na atividade: escolha uma letra/nome curto que ainda não exista,
   leia com `i.campo || valorPadrao` (projetos antigos não têm o campo) e, se for
   exportado, inclua em `exportar.js` **e** em `importar.js`.
4. Rode os testes (abaixo) e acrescente um teste para a novidade em `testes/funcoes.js`.

## Testes

Na pasta `testes/` (precisa de Node.js):
```
npm install          # playwright, xlsx e pdf-lib
npx playwright install chromium   # só na primeira vez, se não houver navegador
node funcoes.js      # 271 conferências de todas as funções (≈ 5 min)
node site.js         # site próprio: login, dados por usuário, sair, backup, agenda (Firebase simulado)
node parcial.js      # atualização parcial = redesenho completo
node cadastros.js    # gestor de cadastros e conversão dos cadastros antigos
REAL=projeto.json node estrutura.js   # conversão de formato (REAL é opcional: projetos exportados do banco, separados por vírgula)
node desempenho.js   # tempo de edição numa etapa com 284 atividades
```
Os testes abrem a ferramenta num navegador sem janela, com banco e downloads
simulados; nada é gravado na conta. Resultados ficam em `testes/saida/`.
Variáveis opcionais: `DIR` (pasta da ferramenta, padrão `..`) e `CHROME` (navegador).

## Histórico das reorganizações (outubro de 2026)
1. Código formatado (antes: 783 linhas compactadas).
2. Separado em arquivos por assunto.
3. Tabela de ações no lugar de 4 cadeias de condições.
4. Nomes descritivos (ex.: `S` → `estado`, `find` → `acharAtividade`, `hm` → `fmtHoras`).
5. Atualização parcial da tela ao editar atividades.
6. Testes e este guia guardados junto com a ferramenta.

## Cadastros e hierarquia (outubro de 2026)
1. Dados e conversão; 2. Gestor de Cadastros; 3. Telas; 4. Novo projeto (em branco, cópia,
   Excel); 5. Relatórios em PDF e Excel.
6. Hierarquia corrigida para **Projeto > Etapa > Disciplina > Escopo + Pavimentos >
   Atividades** (versão 3 dos dados): datas só na etapa, cadastros organizados por etapa,
   conversão automática dos projetos e cadastros da versão 2.
