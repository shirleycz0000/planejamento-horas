// Testes do site próprio (login com Firebase e dados por usuário), com o Firebase,
// o login do Google e a API do Google Agenda simulados. Nada sai para a internet.
const fs = require("fs");
const { open, criarProjetoModelo } = require("./ambiente");
const SAIDA = require("path").join(__dirname, "saida");
fs.mkdirSync(SAIDA, { recursive: true });
const R = [];
const ok = (area, nome, cond, det = "") => {
  R.push({ area, nome, pass: !!cond });
  console.log((cond ? "PASS" : "FAIL") + " | " + area + " | " + nome + (det && !cond ? " | " + String(det).slice(0, 300) : ""));
};

(async () => {
  // 1) sem configuração
  {
    const { browser, page } = await open({ site: true, config: "window.CONFIG_SITE={firebase:{apiKey:'COLE_AQUI'}};" });
    await page.waitForTimeout(300);
    ok("Configuração", "sem config.js preenchido: avisa e não deixa entrar", (await page.textContent("#lgsub")).includes("Configuração pendente") && (await page.isDisabled("#lgentrar")));
    ok("Configuração", "a ferramenta fica escondida", !(await page.isVisible("#home")));
    await browser.close();
  }

  const eventos = [];
  let respostaAgenda = 200;
  const { browser, page } = await open({
    site: true,
    clienteGoogle: "123-teste.apps.googleusercontent.com",
    calendario: (r) => {
      const q = r.request();
      eventos.push({ url: q.url(), auth: q.headers()["authorization"], corpo: JSON.parse(q.postData() || "{}") });
      return r.fulfill({ status: respostaAgenda, contentType: "application/json", body: JSON.stringify(respostaAgenda === 200 ? { id: "ev" + eventos.length } : { error: { message: "x" } }) });
    },
  });
  const ev = (f, a) => page.evaluate(f, a);
  const W = (ms) => page.waitForTimeout(ms || 150);
  try {
    await W(300);
    // 2) tela de login
    ok("Login", "abre na tela de login", (await page.isVisible("#login")) && !(await page.isVisible("#home")));
    await page.fill("#lgemail", "ana@exemplo.com");
    await page.fill("#lgsenha", "123456");
    await page.click("#lgentrar"); await W();
    ok("Login", "senha errada / conta inexistente: mensagem clara", (await page.textContent("#lgmsg")).includes("incorretos"));
    await page.click("#lgmodo");
    ok("Login", "criar conta pede a senha duas vezes", await page.isVisible("#lgsenha2"));
    await page.fill("#lgsenha2", "654321"); await page.click("#lgentrar"); await W();
    ok("Login", "senhas diferentes: avisa", (await page.textContent("#lgmsg")).includes("não são iguais"));
    await page.fill("#lgsenha2", "123456"); await page.click("#lgentrar"); await W(700);
    ok("Login", "criar conta entra na ferramenta", (await page.isVisible("#home")) && !(await page.isVisible("#login")));
    ok("Login", "mostra o e-mail no canto de cima", (await page.textContent("#conta")).includes("ana@exemplo.com"));
    ok("Login", "status: salvo na conta", (await page.textContent("#cloud")).includes("Salvo na sua conta"));

    // 3) dados ficam em users/<uid>/
    const uid1 = await ev(() => JSON.parse(localStorage.getItem("__fakeauth")).uid);
    await criarProjetoModelo(page, "Projeto da Ana"); await W(300);
    const chaves = await ev(() => Object.keys(JSON.parse(localStorage.getItem("__fakefs"))));
    ok("Dados", "projeto gravado em users/<id>/projects", chaves.some((k) => k.startsWith("users/" + uid1 + "/projects/")) && chaves.every((k) => k.startsWith("users/" + uid1 + "/")), chaves.join(","));
    await ev(() => irParaInicio()); await W(300);
    await page.reload(); await W(900);
    ok("Dados", "depois de recarregar continua logado e com o projeto", !(await page.isVisible("#login")) && (await page.textContent("#pgrid")).includes("Projeto da Ana"));

    // 4) backup
    await page.click("text=💾 Backup ▾");
    const [down] = await Promise.all([page.waitForEvent("download"), page.click("#bkdown")]);
    const arq = SAIDA + "/backup-teste.json";
    await down.saveAs(arq);
    const bk = JSON.parse(fs.readFileSync(arq, "utf8"));
    ok("Backup", "baixar backup com projetos, modelos e cadastros", bk.formato === "planejamento-horas-backup" && bk.projetos.length === 1 && Array.isArray(bk.cadastros) && bk.cadastros.length > 0, JSON.stringify({ n: bk.projetos.length, c: (bk.cadastros || []).length }));

    // 5) sair
    await page.click("#conta [data-dd]"); await page.click("#sitesair"); await W(900);
    ok("Sair", "volta para a tela de login", await page.isVisible("#login"));
    ok("Sair", "apaga a cópia local dos projetos", await ev(() => !localStorage.getItem("phs2") && !localStorage.getItem("site-uid")));

    // 6) outro usuário não vê os dados do primeiro
    await page.click("#lggoogle"); await W(900);
    ok("Outro usuário", "entrar com Google", (await page.isVisible("#home")) && (await page.textContent("#conta")).includes("google@exemplo.com"));
    ok("Outro usuário", "não vê os projetos da Ana", !(await page.textContent("#pgrid")).includes("Projeto da Ana"));
    const temCad = await ev(() => cadastros.length);
    // 7) restaurar o backup no outro usuário
    await page.setInputFiles("#bkfile", arq); await W(300);
    ok("Backup", "restaurar pede confirmação", await ev(() => $("dlg").open && $("dm").textContent.includes("1 projeto")));
    await page.click("#dy"); await W(900);
    ok("Backup", "restaurar traz o projeto para a conta atual", (await page.textContent("#pgrid")).includes("Projeto da Ana") && (await ev(() => Object.keys(JSON.parse(localStorage.getItem("__fakefs"))).some((k) => k.startsWith("users/g1/projects/")))));
    ok("Backup", "cadastros da mesma etapa não ficam repetidos", await ev((n) => { const nomes = cadastros.map((c) => normalizar(c.nome)); return nomes.length === new Set(nomes).size && nomes.length >= 1; }, temCad));
    await page.setInputFiles("#bkfile", { name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"a":1}') }); await W(300);
    ok("Backup", "arquivo que não é backup: avisa e não restaura", (await page.textContent("#sv")).includes("não é um backup"));

    // 8) Google Agenda direto pela API do Google
    await page.click("#gcal"); await W(); await page.click("[data-gcon]"); await W(600);
    ok("Agenda", "vincular pede permissão ao Google e liga", await ev(() => agenda.ligado && (window.__gisPedidos || []).includes("consent")), JSON.stringify(await ev(() => [agenda.erro, window.__gisPedidos])));
    await page.keyboard.press("Escape");
    const pid = await ev(() => Object.keys(projetos)[0]);
    await ev((p) => agendaSessao(p, Date.now() - 2 * 36e5, Date.now()), pid); await W(600);
    const e1 = eventos[eventos.length - 1] || {};
    ok("Agenda", "cria evento particular na agenda principal com o token", eventos.length === 1 && e1.url.includes("/calendars/primary/events") && e1.auth === "Bearer tk-teste" && e1.corpo.summary === "⏱ Projeto da Ana" && e1.corpo.visibility === "private" && !("calendar_id" in e1.corpo), JSON.stringify(e1));
    respostaAgenda = 401;
    await ev((p) => agendaSessao(p, Date.now() - 6e5, Date.now()), pid); await W(600);
    ok("Agenda", "acesso expirado: o horário fica na fila (sem duplicar)", await ev(() => agenda.pendentes.length === 1 && !agenda.falhas.length));
    respostaAgenda = 200;
    await ev(() => enviarPendentesAgenda()); await W(600);
    ok("Agenda", "pede um novo acesso e envia a fila", await ev(() => !agenda.pendentes.length) && eventos.length === 3);
    respostaAgenda = 503;
    await ev((p) => agendaSessao(p, Date.now() - 6e5, Date.now()), pid); await W(600);
    ok("Agenda", "erro do Google: fica em “não confirmados” para reenviar", await ev(() => agenda.falhas.length === 1));
    ok("Agenda", "textos sem falar de claude.ai", await ev(() => { abrirJanela("gcal"); const t = $("wdb").textContent; fecharJanela(); return !/claude\.ai/.test(t); }));

    // 9) downloads pelo navegador (relatório Excel)
    await ev(() => abrirProjeto(Object.keys(projetos)[0])); await W(300);
    const [d2] = await Promise.all([page.waitForEvent("download"), ev(() => exportarExcel())]);
    ok("Downloads", "exportar Excel baixa o arquivo pelo navegador", /\.xlsx$/.test(d2.suggestedFilename()));

    const errs = await ev(() => window.__errs);
    ok("Geral", "nenhum erro de JavaScript", !errs.length && !(page.__perr || []).length, JSON.stringify([...errs, ...(page.__perr || [])]));
  } catch (e) {
    ok("Geral", "teste executou sem travar", false, e.message.split("\n")[0]);
    await page.screenshot({ path: SAIDA + "/falha-site.png" });
  }
  await browser.close();
  const f = R.filter((r) => !r.pass);
  console.log(`\n${R.length - f.length}/${R.length} passaram; ${f.length} falharam`);
})();
