// Testes da conversão de formato para Projeto > Etapa > Disciplina (versão 3), a partir de
// todos os formatos anteriores (0, 1 e 2), e das funções de leitura que entendem todos eles.
//
// REAL = caminhos (separados por vírgula) de projetos reais exportados do banco (JSON com "j").
const fs = require("fs");
const { open } = require("./ambiente");
const R = [];
const ok = (nome, cond, det = "") => { R.push(!!cond); console.log((cond ? "PASS" : "FAIL") + " | " + nome + (!cond && det ? " | " + String(det).slice(0, 400) : "")); };

(async () => {
  const { page } = await open();
  const ev = (f, a) => page.evaluate(f, a), W = (ms) => page.waitForTimeout(ms || 250);

  // ---- monta os casos ----
  // 1) projeto completo no formato 1 (duas etapas, várias disciplinas, horas, comentários, links, cronômetro)
  const completo = await ev(() => {
    const m = criarModeloJblue().disc, pav = JSON.parse(JSON.stringify(m));
    for (const d in pav) pav[d].forEach((b) => (b.it = []));
    const e0 = { id: "e1", nome: "PP", escopo: "Modelo JBLUE", escopoId: "jblue", tab: "ELT", ini: "2026-10-01", fim: "2026-10-30", disc: m },
      e1 = { id: "e2", nome: "AP", escopo: "Modelo JBLUE: somente pavimentos", escopoId: "jblue-pav", tab: "ELT", ini: "2026-11-03", fim: "2026-12-10", disc: pav };
    const g = e0.disc.ELT[0].it[0]; g.u = 1.5; g.lg = [{ d: "2026-10-20", h: 1 }, { d: "2026-10-21", h: 0.5 }]; g.cm = [{ t: "comentário", d: 1793000000000 }]; g.pr = "a"; g.s = "Concluído"; g.c = "2026-10-21";
    const ap = e0.disc.ELT.find((b) => ehBlocoApontamentos(b.n)).it[0]; ap.h = "https://app.construflow.com.br/x?issueId=1"; ap.l = [{ t: "ação", c: true }];
    e1.disc.TEL[1].it.push({ id: "manual1", d: "Atividade manual no Subsolo", r: "Milene", s: "Pendente", e: 2, u: 0 });
    const st = statusPadrao(); st.push({ n: "Revisão", r: "and", c: 5 });
    const x = { hd: 7, pe: RESPONSAVEIS_PADRAO.slice(), status: st, cal: { dias: [1, 2, 3, 4, 5], ev: [{ id: "v1", nome: "Férias", ini: "2026-12-21", fim: "2026-12-31" }] }, run: { id: e0.disc.TEL[0].it[1].id, t0: 1793220000000 }, etapas: [e0, e1] };
    // guarda como projeto salvo no formato antigo (sem abrir), como os projetos de antes da mudança
    projetos.pAntigo = { id: "pAntigo", name: "Completo", etapa: "PP, AP", j: JSON.stringify(x), upd: Date.now() };
    gravarProjeto("pAntigo");
    return x;
  });
  // 2) versão 2 (Projeto > Disciplina > Etapa) com datas diferentes por disciplina na mesma etapa
  const v2 = {
    versao: 2, hd: 7, run: null, pe: ["Ana"],
    disciplinas: [
      { id: "d1", nome: "ELT", cadastroId: "c-elt", etapas: [
        { id: "e1-d1", nome: "PP", escopo: "Cadastro: Elétrica · PP", ini: "2026-10-01", fim: "2026-10-20", blocos: [{ n: "Escopo + Geral", tipo: "escopo", it: [{ id: "q1", d: "A", r: "", s: "Pendente", e: 1, u: 0 }] }, { n: "Térreo", it: [{ id: "q2", d: "B", r: "Ana", s: "Pendente", e: 2, u: 1, lg: [{ d: "2026-10-05", h: 1 }] }] }, { n: "Apontamentos a atender", it: [] }] },
        { id: "e2-d1", nome: "EP", escopo: "Em branco", ini: "2026-11-01", fim: "", blocos: [{ n: "Escopo + Geral", tipo: "escopo", it: [] }] }] },
      { id: "d2", nome: "TEL", cadastroId: "c-tel", etapas: [
        { id: "e1-d2", nome: "pp", escopo: "Cadastro: Telecomunicações · PP", ini: "2026-10-05", fim: "2026-10-30", blocos: [{ n: "Meu escopo", tipo: "escopo", it: [{ id: "q3", d: "C", r: "", s: "Pendente", e: 3, u: 0 }] }, { n: "Subsolo", it: [] }] }] },
      { id: "d3", nome: "SPDA", etapas: [] },
    ],
  };
  // 3) projetos reais, se informados
  const reais = (process.env.REAL || "").split(",").filter((f) => f && fs.existsSync(f)).map((f) => { const r = JSON.parse(fs.readFileSync(f, "utf8")), d = r.data || r; return [d.name || f, JSON.parse(d.j)]; });
  // 4) formato 0 (uma etapa só) 5) sem bloco "Geral" e com "geral" minúsculo 6) etapa vazia
  const f0 = { hd: 7, run: null, tab: "ELT", disc: { ELT: [{ n: "Geral", it: [{ id: "z1", d: "A", r: "", s: "Pendente", e: 1, u: 0 }] }, { n: "Térreo", it: [{ id: "z2", d: "B", r: "", s: "Pendente", e: 2, u: 1 }] }] } };
  const semGeral = { hd: 7, run: null, etapas: [{ id: "e1", nome: "PP", disc: { ELT: [{ n: "Subsolo", it: [{ id: "y1", d: "C", r: "", s: "Pendente", e: 1, u: 0 }] }], TEL: [{ n: "Térreo", it: [] }, { n: "geral", it: [{ id: "y2", d: "D", r: "", s: "Pendente", e: 1, u: 0 }] }] } }] };
  const vazio = { hd: 7, run: null, etapas: [{ id: "e1", nome: "Vazia", disc: {} }, { id: "e2", nome: "X", disc: { ELT: [] } }] };

  const casos = [["projeto completo (formato 1)", completo], ["versão 2", v2], ["formato 0", f0], ["sem bloco Geral", semGeral], ["etapa vazia", vazio], ...reais.map(([n, x]) => ["projeto real " + n, x])];
  if (!reais.length) console.log("(projeto real não informado — defina REAL=caminho do JSON)");

  for (const [nome, dados] of casos) {
    const r = await ev((d) => {
      const antes = JSON.stringify(d), novo = converterParaNovo(d, "Etapa 1"), out = {};
      // pares disciplina/etapa do original, em qualquer formato: { "disc|etapa": { blocos, ini, fim } }
      const original = {};
      if (ehFormato2(d)) d.disciplinas.forEach((di) => di.etapas.forEach((e) => (original[di.nome + "|" + normalizar(e.nome)] = { blocos: e.blocos, ini: e.ini || "", fim: e.fim || "", nome: e.nome })));
      else etapasFormato1(d, "Etapa 1").forEach((e) => Object.keys(e.disc || {}).forEach((dn) => (original[dn + "|" + normalizar(e.nome || "Etapa 1")] = { blocos: e.disc[dn], ini: e.ini || "", fim: e.fim || "", nome: e.nome || "Etapa 1" })));
      const lista = (x) => { const a = []; percorrerAtividades(x, (i, c) => void a.push([c.disciplina, normalizar(c.etapa.nome), ehBlocoEscopo(c.bloco) || normalizar(c.bloco.n) === "geral" ? "ESCOPO" : c.bloco.n, JSON.stringify(i)]), "Etapa 1"); return a.map((x) => x.join("¦")).sort(); };
      const listaOriginal = () => Object.entries(original).flatMap(([k, o]) => o.blocos.flatMap((b) => b.it.map((i) => [k.split("|")[0], k.split("|")[1], ehBlocoEscopo(b) || normalizar(b.n) === "geral" ? "ESCOPO" : b.n, JSON.stringify(i)].join("¦")))).sort();
      out.naoAlterouOriginal = JSON.stringify(d) === antes;
      out.formatoNovo = ehFormatoNovo(novo) && novo.versao === 3 && !("disciplinas" in novo) && !("disc" in novo) && novo.etapas.every((e) => !("disc" in e) && !("blocos" in e));
      out.mesmasAtividades = JSON.stringify(lista(novo)) === JSON.stringify(listaOriginal());
      out.nAtiv = lista(novo).length;
      out.escopoPrimeiro = novo.etapas.every((e) => e.disciplinas.every((di) => di.blocos.length && di.blocos[0].tipo === "escopo" && di.blocos.filter(ehBlocoEscopo).length === 1));
      out.escopoRenomeadoMantido = !ehFormato2(d) || novo.etapas.some((e) => e.disciplinas.some((di) => di.blocos[0].n === "Meu escopo")) || !JSON.stringify(d).includes("Meu escopo");
      // cada par disciplina/etapa do original vira uma disciplina dentro da etapa, com os blocos na mesma ordem
      out.paresEOrdemBlocos = Object.entries(original).every(([k, o]) => {
        const [dn, en] = k.split("|"), e = novo.etapas.find((x) => normalizar(x.nome) === en), di = e && e.disciplinas.find((x) => x.nome === dn);
        if (!di) return false;
        const a = o.blocos.filter((b) => !ehBlocoEscopo(b) && normalizar(b.n) !== "geral").map((b) => b.n), b2 = di.blocos.slice(1).map((b) => b.n);
        return JSON.stringify(a) === JSON.stringify(b2);
      }) && novo.etapas.reduce((a, e) => a + e.disciplinas.length, 0) === Object.keys(original).length;
      // etapas de mesmo nome se juntam; datas = início mais cedo e fim mais tarde
      out.etapasSemRepetir = new Set(novo.etapas.map((e) => normalizar(e.nome))).size === novo.etapas.length;
      out.datas = novo.etapas.every((e) => {
        const os = Object.entries(original).filter(([k]) => k.split("|")[1] === normalizar(e.nome)).map(([, o]) => o);
        if (!os.length) return true;
        const ini = os.map((o) => o.ini).filter(Boolean).sort()[0] || "", fim = os.map((o) => o.fim).filter(Boolean).sort().at(-1) || "";
        return e.ini === ini && e.fim === fim;
      });
      out.config = ["hd", "run", "pe", "status", "cal"].every((k) => JSON.stringify(d[k]) === JSON.stringify(novo[k]));
      out.idsUnicos = new Set(novo.etapas.map((e) => e.id)).size === novo.etapas.length && new Set(novo.etapas.flatMap((e) => e.disciplinas.map((x) => x.id))).size === novo.etapas.reduce((a, e) => a + e.disciplinas.length, 0);
      out.idempotente = converterParaNovo(novo) === novo;
      if (!ehFormato2(d)) {
        const volta = converterParaFormato1(novo);
        out.voltaMesmasAtividades = JSON.stringify(lista(volta)) === JSON.stringify(lista(d));
      }
      const t1 = resumoProjeto(JSON.stringify(d)), t2 = resumoProjeto(JSON.stringify(novo));
      out.totais = ["E", "U", "R", "D"].every((k) => Math.abs(t1[k] - t2[k]) < 1e-9) && t1.n === novo.etapas.length;
      const algum = listaOriginal()[0];
      out.acharNoNovo = !algum || !!acharAtividadeEm(novo, JSON.parse(algum.split("¦")[3]).id);
      out.leituraDoAntigo = JSON.stringify(lista(d)) === JSON.stringify(lista(novo));
      return out;
    }, dados);
    const { nAtiv, ...checks } = r;
    for (const [k, v] of Object.entries(checks)) ok(`${nome} (${nAtiv} atividades): ${k}`, v);
  }

  // ---- leitura integrada: um projeto salvo no formato novo aparece igual nas telas que leem todos os projetos ----
  const integ = await ev(async () => {
    const pid = "pAntigo";
    const v1 = projetos[pid].j, card1 = resumoProjeto(v1);
    historicoDesatualizado = true; const h1 = obterHistorico();
    dataHoras = "2026-10-20"; periodoHoras = "m"; const d1 = dadosHoras();
    const lat1 = (() => { $("lpj").innerHTML = `<option value="${pid}">x</option>`; $("lpj").value = pid; preencherAtividadesLancamento(); return $("lat").options.length; })();
    const desc1 = descreverAtividade(pid, JSON.parse(v1).run.id);
    projetos[pid].j = JSON.stringify(converterParaNovo(JSON.parse(v1)));
    const card2 = resumoProjeto(projetos[pid].j);
    historicoDesatualizado = true; const h2 = obterHistorico();
    const d2 = dadosHoras();
    const lat2 = (() => { preencherAtividadesLancamento(); return $("lat").options.length; })();
    const desc2 = descreverAtividade(pid, JSON.parse(v1).run.id);
    let n = 0; paraCadaAtividade(() => n++);
    projetos[pid].j = v1; // volta, para não afetar o resto
    const soma = (d) => [...d.G.values()].reduce((a, g) => a + g.tot, 0);
    return {
      card: JSON.stringify([card1.E, card1.U, card1.R, card1.D]) === JSON.stringify([card2.E, card2.U, card2.R, card2.D]),
      historico: h1.tot.n === h2.tot.n && Math.abs(h1.tot.U - h2.tot.U) < 1e-9 && h1.A.size === h2.A.size && h2.ET.size > 0,
      horasTrabalhadas: Math.abs(soma(d1) - soma(d2)) < 1e-3 && soma(d1) > 0,
      listaLancamento: lat1 === lat2 && lat1 > 0,
      cronometroAchaAtividade: !!desc2 && desc1.a === desc2.a && desc1.p === desc2.p && desc2.e === "PP" && desc2.d === "TEL",
      paraCadaAtividade: n > 0,
    };
  });
  for (const [k, v] of Object.entries(integ)) ok("leitura no formato novo: " + k, v);

  // editar um projeto salvo no formato antigo (ex.: parar o cronômetro de outro projeto) converte antes de alterar
  const edit = await ev(async (x) => {
    projetos.pV2 = { id: "pV2", name: "V2", etapa: "PP, EP", j: JSON.stringify(x), upd: Date.now() };
    const okEd = editarProjetoSalvo("pV2", (y) => { acharAtividadeEm(y, "q2").u = 5; });
    await new Promise((r) => setTimeout(r, 100));
    const y = JSON.parse(projetos.pV2.j), cop = await banco.doc("copias/pV2-v2").get();
    return okEd && ehFormatoNovo(y) && acharAtividadeEm(y, "q2").u === 5 && cop.exists;
  }, v2);
  ok("editar projeto salvo na versão 2 converte (com cópia) e guarda a alteração", edit);

  // ---- cópia de segurança ----
  const cop = await ev(async () => {
    await guardarCopiaFormatoAntigo("pX", "Teste", '{"a":1}');
    await guardarCopiaFormatoAntigo("pX", "Teste", '{"a":2}'); // a segunda não sobrescreve
    await guardarCopiaFormatoAntigo("pX", "Teste", '{"versao":2,"disciplinas":[]}'); // versão 2: cópia à parte
    const g = await banco.doc("copias/pX").get(), g2 = await banco.doc("copias/pX-v2").get(), l = JSON.parse(localStorage.getItem("phcopias"));
    return g.exists && g.data().j === '{"a":1}' && l.pX.j === '{"a":1}' && g2.exists && l["pX-v2"];
  });
  ok("cópia de segurança gravada uma única vez por formato (banco e navegador)", cop);

  // ---- conversão de verdade: abrir um projeto antigo pela tela ----
  const antes = await ev(() => { const a = []; percorrerAtividades(JSON.parse(projetos.pAntigo.j), (i) => void a.push(JSON.stringify(i))); return a.sort(); });
  await page.evaluate(() => desenharInicio()); await W(300);
  ok("projeto antigo aparece no início com o cronômetro rodando", (await page.textContent("#pgrid")).includes("Completo") && (await page.isVisible("#runbar")));
  await page.click('[data-open="pAntigo"]'); await W(400);
  const conv = await ev(async () => {
    const x = JSON.parse(projetos.pAntigo.j), a = [];
    percorrerAtividades(x, (i) => void a.push(JSON.stringify(i)));
    const cop = await banco.doc("copias/pAntigo").get();
    return { novo: ehFormatoNovo(x), ativ: a.sort(), copia: cop.exists && !ehFormatoNovo(JSON.parse(cop.data().j)), tela: telaAtual, ets: x.etapas.map((e) => e.nome + "[" + e.ini + "→" + e.fim + "]:" + e.disciplinas.map((d) => d.nome).join("/")).join(" ") };
  });
  ok("abrir projeto antigo converte e grava no formato novo", conv.novo && conv.tela === "etapas", conv.ets);
  ok("conversão preserva todas as atividades sem alteração", JSON.stringify(conv.ativ) === JSON.stringify(antes));
  ok("cópia de segurança do formato antigo guardada na conta", conv.copia);
  ok("etapas com as disciplinas dentro e as datas da etapa", conv.ets === "PP[2026-10-01→2026-10-30]:ELT/TEL AP[2026-11-03→2026-12-10]:ELT/TEL", conv.ets);
  await page.click("#rgo"); await W(500);
  ok("'Ir para a atividade' do cronômetro abre a etapa e a disciplina certas", await ev(() => telaAtual === "etapa" && estado.tab === "TEL" && estado.etapaAberta.nome === "PP" && !!document.querySelector(`tr[data-rid="${estado.run.id}"]`)));

  // projeto na versão 2 aberto pela tela
  await ev(async (x) => { projetos.pV2b = { id: "pV2b", name: "V2 tela", etapa: "PP, EP", j: JSON.stringify(x), upd: Date.now() }; await gravarProjeto("pV2b"); }, v2);
  await ev(() => irParaInicio()); await W(300);
  await page.click('[data-open="pV2b"]'); await W(400);
  const t2 = await ev(async () => { const x = JSON.parse(projetos.pV2b.j), cop = await banco.doc("copias/pV2b-v2").get(); return { novo: ehFormatoNovo(x), copia: cop.exists && ehFormato2(JSON.parse(cop.data().j)), ets: x.etapas.map((e) => e.nome + "[" + e.ini + "→" + e.fim + "]:" + e.disciplinas.map((d) => d.nome + "(" + d.escopo + ")").join("/")).join(" "), linhas: document.querySelectorAll("#et tr.grp").length }; });
  ok("versão 2 aberta pela tela: etapas juntas, datas da etapa e origem por disciplina", t2.novo && t2.copia && t2.linhas === 2 && t2.ets === "PP[2026-10-01→2026-10-30]:ELT(Cadastro: Elétrica · PP)/TEL(Cadastro: Telecomunicações · PP) EP[2026-11-01→]:ELT(Em branco)", JSON.stringify(t2));

  for (const [n, x] of reais) {
    await ev(async ([n, j]) => { projetos.pReal = { id: "pReal", name: n, etapa: "", j, upd: Date.now() }; await gravarProjeto("pReal"); }, [n, JSON.stringify(x)]);
    await ev(() => irParaInicio()); await W(300);
    await page.click('[data-open="pReal"]'); await W(400);
    const r = await ev(() => { const x = JSON.parse(projetos.pReal.j); return { novo: ehFormatoNovo(x), d: x.etapas.map((e) => e.nome + "=" + e.disciplinas.map((d) => d.nome + "(" + d.blocos.map((b) => b.n + ":" + b.it.length).join(",") + ")").join(" ")).join(" | ") }; });
    ok("projeto real abre convertido: " + n + " → " + r.d, r.novo && !(page.__perr || []).length, r.d);
  }

  const errs = await ev(() => window.__errs);
  ok("nenhum erro de JavaScript", !errs.length && !(page.__perr || []).length, JSON.stringify([...errs, ...(page.__perr || [])]));
  console.log(`\n${R.filter(Boolean).length}/${R.length} passaram`);
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
