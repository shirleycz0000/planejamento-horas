// Testes do Gestor de Cadastros (etapas base com as disciplinas e as atividades)
// e da conversão dos cadastros da versão anterior (disciplina > etapas).
const { open } = require("./ambiente");
const R = [];
const ok = (nome, cond, det = "") => { R.push(!!cond); console.log((cond ? "PASS" : "FAIL") + " | " + nome + (!cond && det ? " | " + String(det).slice(0, 300) : "")); };

(async () => {
  let { page } = await open();
  const ev = (f, a) => page.evaluate(f, a), W = (ms) => page.waitForTimeout(ms || 200);
  const c = async (s) => { await page.locator(s).first().click(); await W(); };
  const sv = async (s, v) => { const l = page.locator(s).first(); await l.fill(v); await l.dispatchEvent("change"); await W(); };
  const db = () => ev(() => JSON.parse(localStorage.getItem("__fakedb") || "{}"));
  const msg = () => page.textContent("#cadmsg");
  const etapa = (nome) => ev((s) => JSON.parse(JSON.stringify(cadastros.find((d) => d.nome === s) || null)), nome);

  // ---- preenchimento inicial ----
  await W(400);
  let d = await db();
  ok("preenche com o Modelo JBLUE na primeira vez (etapa PP com ELT e TEL)", await ev(() => cadastros.length === 1 && cadastros[0].nome === "PP" && cadastros[0].disciplinas.map((x) => x.nome + "/" + x.sigla).join() === "Elétrica/ELT,Telecomunicações/TEL"));
  ok("atividades do bloco Geral (13 ELT, 7 TEL)", await ev(() => cadastros[0].disciplinas[0].atividades.length === 13 && cadastros[0].disciplinas[1].atividades.length === 7));
  ok("cadastro guarda só o nome das atividades", await ev(() => cadastros.every((x) => x.disciplinas.every((e) => e.atividades.every((a) => typeof a === "string")))));
  ok("gravado na conta (um documento por etapa) e marcado como preenchido", !!d["cadetapas/t-pp"] && !!d["meta/cadetapas"] && !Object.keys(d).some((k) => k.startsWith("cadastros/")));
  await page.reload(); await W(500);
  ok("recarregar não duplica", await ev(() => cadastros.length === 1));

  // ---- janela ----
  await c('#home [data-dlg="cad"]');
  ok("botão Cadastros abre a janela", await ev(() => $("wd").open && $("wdt").textContent.startsWith("Cadastros: etapas e disciplinas")));
  ok("mostra as etapas e a primeira selecionada", (await page.locator("#cadlista button").count()) === 1 && (await page.inputValue("[data-cadn]")) === "PP");
  ok("mostra as disciplinas da etapa com as atividades", (await page.locator("[data-caddn]").count()) === 2 && (await page.locator('[data-cadat^="0:"]').count()) === 13 && (await page.locator('[data-cadat^="1:"]').count()) === 7);

  // etapas
  await page.fill("#cadnn", "Projeto Básico"); await page.press("#cadnn", "Enter"); await W();
  ok("cadastrar etapa (Enter) e selecioná-la", !!(await etapa("Projeto Básico")) && (await page.inputValue("[data-cadn]")) === "Projeto Básico");
  ok("cursor vai para o campo da nova disciplina", await ev(() => document.activeElement.id === "caddnova"));
  await page.fill("#cadnn", "projeto basico"); await c("[data-cadadde]");
  ok("recusa etapa repetida (sem diferenciar acentos)", (await msg()).includes("Já existe") && (await ev(() => cadastros.length)) === 2);
  await page.fill("#cadnn", ""); await c("[data-cadadde]");
  ok("recusa etapa sem nome", (await msg()).includes("Informe"));

  // disciplinas dentro da etapa
  await page.fill("#caddnova", "Luminotécnica"); await page.fill("#caddsnova", "lum"); await page.press("#caddsnova", "Enter"); await W();
  ok("cadastrar disciplina na etapa (sigla em maiúsculas)", (await etapa("Projeto Básico")).disciplinas.map((x) => x.nome + "/" + x.sigla).join() === "Luminotécnica/LUM");
  ok("cursor vai para a nova atividade da disciplina", await ev(() => document.activeElement.dataset.cadatn === "0"));
  await page.fill("#caddnova", "Elétrica"); await c("[data-caddadd]");
  ok("disciplina já cadastrada em outra etapa reaproveita nome e sigla", (await etapa("Projeto Básico")).disciplinas[1].sigla === "ELT");
  ok("sugere disciplinas de outras etapas ao digitar", await ev(() => [...document.querySelectorAll("#caddlista option")].map((o) => o.value).join() === "Telecomunicações"));
  await page.fill("#caddnova", "ELT"); await c("[data-caddadd]");
  ok("recusa disciplina repetida na etapa", (await msg()).includes("já está em Projeto Básico") && (await etapa("Projeto Básico")).disciplinas.length === 2);
  await page.fill("#caddnova", ""); await c("[data-caddadd]");
  ok("recusa disciplina sem nome", (await msg()).includes("Informe"));

  // atividades
  await page.click('[data-cadatn="0"]');
  for (const a of ["Cálculo luminotécnico", "Layout de luminárias", "Memorial"]) { await page.keyboard.type(a); await page.keyboard.press("Enter"); await W(150); }
  ok("adicionar atividades em sequência com Enter (o cursor continua no campo)", (await etapa("Projeto Básico")).disciplinas[0].atividades.length === 3 && await ev(() => document.activeElement.dataset.cadatn === "0"));
  await page.fill('[data-cadatn="0"]', "Revisão final"); await c('[data-cadatadd="0"]');
  ok("adicionar pelo botão", (await etapa("Projeto Básico")).disciplinas[0].atividades.at(-1) === "Revisão final");
  await page.locator(".cadet details summary").first().click();
  await page.fill('[data-cadcola="0"]', "Detalhes\n\nmemorial\nLegenda  de   símbolos\n"); await c('[data-cadcolar="0"]');
  let L = (await etapa("Projeto Básico")).disciplinas[0];
  ok("colar lista: ignora linhas vazias e repetidas, limpa espaços", L.atividades.length === 6 && L.atividades.includes("Legenda de símbolos") && (await msg()).includes("2 atividade(s) adicionada(s)") && (await msg()).includes("1 atividade(s) já existiam"), JSON.stringify(L.atividades) + " | " + (await msg()));
  await sv('[data-cadat="0:0"]', "Cálculo luminotécnico (Dialux)");
  ok("renomear atividade", (await etapa("Projeto Básico")).disciplinas[0].atividades[0] === "Cálculo luminotécnico (Dialux)");
  await sv('[data-cadat="0:0"]', "  ");
  ok("nome vazio é recusado (mantém o anterior)", (await etapa("Projeto Básico")).disciplinas[0].atividades[0] === "Cálculo luminotécnico (Dialux)" && (await page.inputValue('[data-cadat="0:0"]')) === "Cálculo luminotécnico (Dialux)");
  await c('[data-cadatdn="0:0"]');
  ok("descer atividade", (await etapa("Projeto Básico")).disciplinas[0].atividades[1] === "Cálculo luminotécnico (Dialux)");
  await c('[data-cadatup="0:1"]');
  ok("subir atividade", (await etapa("Projeto Básico")).disciplinas[0].atividades[0] === "Cálculo luminotécnico (Dialux)");
  ok("primeira não sobe, última não desce", await ev(() => document.querySelector('[data-cadatup="0:0"]').disabled && document.querySelector('[data-cadatdn="0:5"]').disabled));
  await c('[data-cadatdel="0:5"]');
  ok("excluir atividade", (await etapa("Projeto Básico")).disciplinas[0].atividades.length === 5);
  await c('[data-caddup="1"]');
  ok("reordenar disciplinas", (await etapa("Projeto Básico")).disciplinas.map((x) => x.sigla).join() === "ELT,LUM");
  await sv('[data-caddn="1"]', "Luminotécnica e Automação");
  ok("renomear disciplina", (await etapa("Projeto Básico")).disciplinas[1].nome === "Luminotécnica e Automação");
  await sv('[data-caddn="1"]', "Elétrica");
  ok("renomear disciplina para nome repetido na etapa é recusado", (await etapa("Projeto Básico")).disciplinas[1].nome === "Luminotécnica e Automação");
  await sv('[data-cadds="1"]', "lmt");
  ok("alterar sigla (maiúsculas)", (await etapa("Projeto Básico")).disciplinas[1].sigla === "LMT");
  await sv('[data-cadds="1"]', "ELT");
  ok("sigla repetida na etapa é recusada", (await etapa("Projeto Básico")).disciplinas[1].sigla === "LMT" && (await msg()).includes("sigla"));
  await c('[data-cadddel="0"]'); await c("#dy"); await W();
  ok("excluir disciplina da etapa com confirmação (janela continua aberta)", (await etapa("Projeto Básico")).disciplinas.map((x) => x.sigla).join() === "LMT" && await ev(() => $("wd").open));
  await sv("[data-cadn]", "PB");
  ok("renomear etapa atualiza a lista ao lado", !!(await etapa("PB")) && (await page.textContent("#cadlista")).includes("PB"));
  await sv("[data-cadn]", "pp");
  ok("renomear etapa para nome repetido é recusado", !!(await etapa("PB")));
  d = await db();
  const pb = await etapa("PB");
  ok("alterações gravadas na conta", JSON.stringify(d["cadetapas/" + pb.id].disciplinas) === JSON.stringify(pb.disciplinas) && d["cadetapas/" + pb.id].nome === "PB");

  // trocar de etapa
  await c('#cadlista [data-cadsel="t-pp"]');
  ok("selecionar outra etapa", (await page.inputValue("[data-cadn]")) === "PP" && (await page.locator('[data-cadat^="1:"]').count()) === 7, (await page.inputValue("[data-cadn]")) + " " + (await page.locator('[data-cadat^="1:"]').count()) + " " + (await page.locator("[data-caddn]").count()));

  // ---- trazer de "Meus modelos" ----
  await c("[data-dclose]");
  await ev(() => criarModelo("etapa", "Modelo AP", { disc: { ELT: [{ n: "Geral", it: [{ d: "Ativ 1" }, { d: "Ativ 2" }] }, { n: "Térreo", it: [{ d: "Não entra" }] }], SPDA: [{ n: "Geral", it: [{ d: "Captação" }] }] } }));
  await c('#home [data-dlg="cad"]');
  await c("[data-cadimp]");
  ok("trazer de Meus modelos: o modelo vira etapa com as disciplinas (só o bloco Geral)", await ev(() => { const e = cadastros.find((x) => x.nome === "Modelo AP"); return e && e.disciplinas.map((x) => x.nome + "/" + x.sigla + ":" + x.atividades.join("+")).join() === "Elétrica/ELT:Ativ 1+Ativ 2,SPDA/SPDA:Captação"; }));
  await c("[data-cadimp]");
  ok("trazer de novo não duplica", (await msg()).includes("Nada novo"));

  // ---- excluir etapa ----
  await c('#cadlista [data-cadsel="' + pb.id + '"]');
  await c("[data-caddele]"); await c("#dy"); await W(300);
  d = await db();
  ok("excluir etapa com confirmação (some da conta)", !(await etapa("PB")) && !d["cadetapas/" + pb.id]);

  // ---- alteração vinda de outro dispositivo ----
  await ev(() => banco.doc("cadetapas/t-pp").set({ nome: "PP (outro PC)", ordem: 0, disciplinas: [{ id: "x", nome: "Elétrica", sigla: "ELT", atividades: ["X"] }], upd: Date.now() + 5000 }));
  await W(300);
  ok("recebe alteração de outro dispositivo e atualiza a janela", !!(await etapa("PP (outro PC)")) && (await page.textContent("#cadlista")).includes("outro PC"));
  await ev(() => banco.doc("cadetapas/t-pp").delete()); await W(300);
  ok("recebe exclusão de outro dispositivo", !(await etapa("PP (outro PC)")));

  // ---- apagar tudo não volta a preencher ----
  await ev(async () => { for (const x of [...cadastros]) await apagarCadastro(x.id); });
  await page.reload(); await W(600);
  ok("depois de apagar tudo, não preenche de novo", await ev(() => cadastros.length === 0));
  await c('#home [data-dlg="cad"]');
  ok("janela vazia orienta a cadastrar", (await page.textContent("#wdb")).includes("Cadastre a primeira etapa"));
  await c("[data-dclose]");

  // ---- conversão dos cadastros da versão anterior (na conta) ----
  const ANTIGOS = {
    "cadastros/c-elt": { nome: "Elétrica", sigla: "ELT", ordem: 0, etapas: [{ id: "pp", nome: "PP", atividades: ["A1", "A2", "A3"] }, { id: "t1", nome: "EP", atividades: ["B1", "B2"] }], upd: 1 },
    "cadastros/c-tel": { nome: "Telecomunicações", sigla: "TEL", ordem: 1, etapas: [{ id: "pp", nome: "pp", atividades: ["C1"] }], upd: 1 },
    "cadastros/c-sem": { nome: "Sem etapas", sigla: "SEM", ordem: 2, etapas: [], upd: 1 },
    "meta/cadastros": { t: 1 },
  };
  await ev((a) => { localStorage.clear(); localStorage.setItem("__fakedb", JSON.stringify(a)); localStorage.setItem("phcad", "[]"); }, ANTIGOS);
  await page.reload(); await W(700);
  d = await db();
  ok("converte os cadastros antigos: etapas com as disciplinas dentro", await ev(() => cadastros.map((e) => e.nome + "=" + e.disciplinas.map((x) => x.sigla + ":" + x.atividades.join("+")).join(",")).join(" | ") === "PP=ELT:A1+A2+A3,TEL:C1 | EP=ELT:B1+B2"), await ev(() => JSON.stringify(cadastros)));
  ok("cadastros convertidos gravados na conta; os antigos ficam guardados como estavam", Object.keys(d).filter((k) => k.startsWith("cadetapas/")).length === 2 && !!d["cadastros/c-elt"] && d["meta/cadetapas"] && d["meta/cadetapas"].convertidos === true);
  await page.reload(); await W(500);
  ok("conversão acontece uma vez só", await ev(() => cadastros.length === 2));

  // ---- conversão no navegador (sem conta) ----
  await ev(() => { localStorage.clear(); localStorage.setItem("__nodb", "1"); localStorage.setItem("phcad", JSON.stringify([{ id: "c1", nome: "SPDA", sigla: "SPDA", ordem: 0, etapas: [{ id: "x", nome: "EX", atividades: ["Captação"] }] }])); localStorage.setItem("phcad-ini", "1"); });
  await page.reload(); await W(600);
  ok("sem conta: converte os cadastros antigos do navegador", await ev(() => cadastros.length === 1 && cadastros[0].nome === "EX" && cadastros[0].disciplinas[0].sigla === "SPDA" && localStorage.getItem("phcad3-ini") === "1"));

  // ---- sem conta, do zero ----
  await ev(() => { localStorage.clear(); localStorage.setItem("__nodb", "1"); });
  await page.reload(); await W(600);
  ok("sem conta: preenche no navegador", await ev(() => cadastros.length === 1 && cadastros[0].disciplinas.length === 2 && localStorage.getItem("phcad3-ini") === "1"));

  const errs = await ev(() => window.__errs);
  ok("nenhum erro de JavaScript", !errs.length && !(page.__perr || []).length, JSON.stringify([...errs, ...(page.__perr || [])]));
  console.log(`\n${R.filter(Boolean).length}/${R.length} passaram`);
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
