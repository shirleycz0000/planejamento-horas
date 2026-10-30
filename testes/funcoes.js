const fs = require("fs");
const { open, criarProjetoModelo } = require("./ambiente");
const SAIDA = require("path").join(__dirname, "saida");
fs.mkdirSync(SAIDA, { recursive: true });
const R = [];
let page;
const ok = (area, name, cond, det = "") => { R.push({ area, name, pass: !!cond, det: String(det).slice(0, 300) }); console.log((cond ? "PASS" : "FAIL") + " | " + area + " | " + name + (det && !cond ? " | " + det : "")); };
const ev = (f, a) => page.evaluate(f, a);
const W = ms => page.waitForTimeout(ms || 120);
// itens que ficam dentro de um menu (Exportar ▾, ⚙ Configurações ▾, ⋯): abre o menu antes
// (o mesmo item pode existir em mais de uma tela: usa o da tela que está aberta)
const abrirMenuDe = s => ev(q => { try { const el = [...document.querySelectorAll(q)].find(x => !x.parentElement.closest("[hidden]:not(.ddm)")), m = el && el.closest(".ddm"); if (m && m.hidden) { m.previousElementSibling.scrollIntoView({ block: "center" }); m.previousElementSibling.click(); } } catch (e) {} }, s);
const vis = s => page.locator(s + " >> visible=true").first();
const c = async s => { await abrirMenuDe(s); await vis(s).click(); await W(); };
const setv = async (s, v) => { await abrirMenuDe(s); const l = vis(s); await l.fill(v); await l.dispatchEvent("change"); await W(150); };
const sel = async (s, v) => { await abrirMenuDe(s); await vis(s).selectOption(v); await W(150); };
const yes = async () => { await c("#dy"); await W(200); };
const today = () => { const d = new Date(Date.now() - 3 * 3600e3); return d.toISOString().slice(0, 10); };
// volta à tela inicial a partir de qualquer tela (disciplina → etapa → projeto → início)
const inicio = async () => { for (let k = 0; k < 4; k++) { const t = await ev(() => telaAtual); if (t === "home") return; await c(t === "etapa" ? "#back" : "#eback"); await W(150); } };
// abre a disciplina "ei:di" (abre a etapa antes, se preciso)
const abrirDisc = async (k) => { const [ei, di] = k.split(":").map(Number), st = await ev(() => [telaAtual, estado.ei]); if (st[0] !== "etapa" || st[1] !== ei) { if (st[0] === "etapa") await c("#back"); await c(`[data-eabr="${ei}"]`); } if ((await ev(() => estado.di)) !== di) await c(`[data-tab="${di}"]`); await W(200); };
// recarrega a página e volta para a disciplina aberta
const reloadKeep = async () => { const st = await ev(() => [idProjetoAberto, estado.ei, estado.di]); await page.reload(); await W(800); await c(`[data-open="${st[0]}"]`); await abrirDisc(st[1] + ":" + st[2]); };
const firstIt = (bi = 0) => ev(b => estado.disc[estado.tab][b].it[0].id, bi);
const it = id => ev(i => JSON.parse(JSON.stringify(acharAtividade(i) || null)), id);
async function sec(nm, fn) { try { await fn(); } catch (e) { ok(nm, "seção executou sem travar", false, e.message.split("\n")[0]); try { await page.screenshot({ path: SAIDA + "/falha-" + nm + ".png" }); console.log("tela:", await ev(() => telaAtual + " / janela aberta: " + $("wd").open + " / confirmação: " + $("dlg").open)); } catch (x) {} } }

(async () => {
  ({ page } = await open());
  const T0 = today();

  // ================= PROJETOS =================
  await sec("Projetos", async () => {
    ok("Projetos", "tela inicial vazia", (await page.textContent("#pgrid")).includes("Nenhum projeto"));
    await c("#newp");
    ok("Projetos", "+ Novo projeto abre a janela em 'Novo' com etapa e disciplinas", await ev(() => $("npf").open) && (await page.isChecked('[name="pmodo"][value="branco"]')) && !(await page.isVisible("#pcp")) && !(await page.isVisible("#pf")) && (await page.isVisible("#pet")) && (await page.inputValue("#pet")) === "t-pp");
    ok("Projetos", "disciplinas da etapa escolhida vêm marcadas", await ev(() => [...document.querySelectorAll("#pdisc input")].map(x => x.value + ":" + x.checked).join() === "c-elt:true,c-tel:true"));
    await c("#pc"); ok("Projetos", "não cria sem nome (aviso na janela)", (await page.textContent("#pmsg")).includes("nome") && await ev(() => $("npf").open));
    await page.check('[name="pmodo"][value="copia"]'); await W(100);
    ok("Projetos", "'Copiar projeto' mostra a lista de projetos", (await page.isVisible("#pcp")) && !(await page.isVisible("#pf")));
    await page.check('[name="pmodo"][value="excel"]'); await W(100);
    ok("Projetos", "'Importar Excel' mostra o campo do arquivo", (await page.isVisible("#pf")) && !(await page.isVisible("#pcp")));
    await c("#pc"); ok("Projetos", "importar sem arquivo é recusado", (await page.textContent("#sv")).includes("Escolha o arquivo"));
    await page.check('[name="pmodo"][value="branco"]'); await sel("#pet", "");
    ok("Projetos", "etapa 'Nenhuma' esconde as disciplinas", (await page.textContent("#pdisc")).includes("começa vazio"));
    await page.fill("#pn", "Projeto Branco"); await page.press("#pn", "Enter"); await W(300);
    ok("Projetos", "criar projeto sem etapa, só com o nome (Enter)", await ev(() => telaAtual === "etapas" && !$("npf").open && ehFormatoNovo(JSON.parse(projetos[idProjetoAberto].j)) && estado.etapas.length === 0));
    ok("Projetos", "projeto em branco orienta a adicionar etapa", (await page.textContent("#et")).includes("Nenhuma etapa ainda"));
    await sel("#ds", "t-pp"); await c("#da"); await sel("#ddsel", "c-elt"); await c("[data-ddok]"); await W(200);
    ok("Projetos", "montar o projeto em branco pelos cadastros (PP · ELT com o escopo)", await ev(() => estado.etapas.length === 1 && estado.etapas[0].nome === "PP" && estado.etapas[0].disciplinas.length === 1 && estado.etapas[0].disciplinas[0].nome === "ELT" && estado.etapas[0].disciplinas[0].blocos[0].it.length === 13));
    await inicio(); await W(150);
    ok("Projetos", "voltar mostra o card do projeto", (await page.textContent("#pgrid")).includes("Projeto Branco"));
    await c("#newp"); await page.fill("#pn", "Novo com etapa"); await page.uncheck('#pdisc input[value="c-tel"]'); await c("#pc"); await W(300);
    ok("Projetos", "criar projeto com a etapa e as disciplinas marcadas (com as atividades)", await ev(() => estado.etapas.map(e => e.nome + ":" + e.disciplinas.map(d => d.nome + "(" + d.blocos[0].it.length + ")")).join() === "PP:ELT(13)") && (await page.textContent("#emsg")).includes("1 disciplina"));
    await ev(async (n) => { const id = Object.values(projetos).find(p => p.name === n).id; await irParaInicio(); await excluirProjeto(id); desenharInicio(); }, "Novo com etapa"); await W(300);
    await criarProjetoModelo(page, "JBLUE Teste", "jblue"); await W(300);
    const n = await ev(() => { let n = 0; percorrerAtividades(estado, () => void n++); return n });
    ok("Projetos", "criar com Modelo JBLUE carrega atividades", n > 40, n);
    await inicio();
    await criarProjetoModelo(page, "Só Pavimentos", "jblue-pav"); await W(300);
    ok("Projetos", "Modelo somente pavimentos (sem atividades)", await ev(() => { const b = estado.etapas[0].disciplinas[0].blocos; return b.length > 5 && b.every(x => !x.it.length) }));
    await inicio();
    const pid = await ev(() => Object.values(projetos).find(p => p.name === "Só Pavimentos").id);
    await c(`[data-pedit="${pid}"]`); await page.fill("#pn", "Só Pavimentos (renomeado)"); await c("#pc"); await W(200);
    ok("Projetos", "editar nome do projeto", await ev(i => projetos[i].name === "Só Pavimentos (renomeado)", pid));
    await c(`[data-pdel="${pid}"]`); await yes();
    ok("Projetos", "excluir projeto com confirmação", await ev(i => !projetos[i], pid));
    await c("#newp"); await c("#pc"); await W(100);
    ok("Projetos", "não cria projeto sem nome", await ev(() => Object.keys(projetos).length === 2));
    await c("#px");
    ok("Projetos", "resumo geral da tela inicial", (await page.textContent("#hsum")).includes("2 projetos"));
  });

  // ================= PROJETO: ETAPAS E DISCIPLINAS =================
  let JB;
  const dadd = async (valor, nome) => { await sel("#ddsel", valor); if (nome !== undefined) await page.fill("#ddnome", nome); await c("[data-ddok]"); await W(200); };
  await sec("Etapas", async () => {
    JB = await ev(() => Object.values(projetos).find(p => p.name === "JBLUE Teste").id);
    await c(`[data-open="${JB}"]`); await W(200);
    ok("Etapas", "tela do projeto lista as etapas com Abrir, sem a coluna Origem", (await page.locator("#et tr.grp").count()) === 1 && (await page.locator('#et .df > [data-eabr="0"]').count()) === 1 && !(await page.textContent("#et thead")).includes("Origem"));
    await c('[data-eabr="0"]');
    ok("Etapas", "Abrir a etapa mostra as atividades da primeira disciplina", (await ev(() => telaAtual)) === "etapa" && (await ev(() => $("bcet").textContent + " · " + $("bcdi").textContent)) === "PP · ELT" && (await page.locator("section.bl").count()) > 5);
    ok("Etapas", "resumo geral da etapa com uma linha por disciplina e o total", (await page.textContent("#gt")).includes("Disciplina") && (await page.textContent("#gt")).includes("TEL") && (await page.textContent("#gt")).includes("Total geral"));
    ok("Etapas", "botões das disciplinas com a aberta destacada", (await page.locator("#tabs [data-tab]").count()) === 2 && (await page.textContent("#tabs .on")) === "ELT");
    await c('[data-tab="1"]');
    ok("Etapas", "clicar na disciplina mostra as atividades dela", await ev(() => estado.tab === "TEL") && (await page.textContent("#tabs .on")) === "TEL" && (await ev(() => $("bcet").textContent + " · " + $("bcdi").textContent)) === "PP · TEL");
    await c("#back"); await c('[data-eabr="0"]');
    ok("Etapas", "abrir a etapa de novo volta na última disciplina usada", await ev(() => estado.tab === "TEL"));
    await c('[data-tab="0"]');
    // + Disciplina (janela)
    await c("[data-dadd]");
    ok("Disciplinas", "+ Disciplina abre a janela com o cadastro da etapa", await ev(() => $("wd").open && $("wdt").textContent === "Nova disciplina em PP") && (await page.textContent("#ddsel")).includes("completar a existente"));
    await dadd("", "");
    ok("Disciplinas", "disciplina 'outra' exige nome", (await page.textContent("#ddmsg")).includes("Informe"));
    await page.fill("#ddnome", "elt"); await c("[data-ddok]");
    ok("Disciplinas", "bloqueia disciplina repetida na etapa", (await page.textContent("#ddmsg")).includes("já está em PP"));
    await page.fill("#ddnome", "SPDA"); await page.press("#ddnome", "Enter"); await W(300);
    ok("Disciplinas", "adicionar disciplina em branco (Enter) e abrir nela", await ev(() => { const d = estado.etapas[0].disciplinas[2]; return !$("wd").open && estado.tab === "SPDA" && d.blocos[0].tipo === "escopo" && d.blocos[0].n === NOME_BLOCO_ESCOPO && ehBlocoApontamentos(d.blocos[1].n) && d.blocos.length === 2 && d.escopo === "Em branco" }));
    await ev(() => { const c = cadastros.find(x => x.nome === "PP"); c.disciplinas.push({ id: "c-lum", nome: "Luminotécnica", sigla: "LUM", atividades: ["Cálculo", "Layout", "Memorial"] }); gravarCadastro(c) });
    await c("[data-dadd]");
    ok("Disciplinas", "as que faltam aparecem primeiro na lista", await ev(() => $("ddsel").options[0].value === "c-lum"));
    await dadd("c-lum");
    ok("Disciplinas", "adicionar disciplina do cadastro (sigla, atividades no Escopo + Geral, sem responsável)", await ev(() => { const d = estado.etapas[0].disciplinas.find(x => x.nome === "LUM"); return estado.tab === "LUM" && d.blocos[0].it.map(i => i.d).join() === "Cálculo,Layout,Memorial" && d.blocos[0].it.every(i => i.r === "") && d.escopo === "Cadastro: PP · Luminotécnica" }));
    ok("Disciplinas", "estimado sugerido pelo histórico só quando há histórico", await ev(() => estado.etapas[0].disciplinas.find(x => x.nome === "LUM").blocos[0].it.every(i => i.e === 0)));
    ok("Disciplinas", "mensagem da inclusão aparece na tela", (await page.textContent("#scm")).includes("LUM"));
    await ev(() => { const d = estado.etapas[0].disciplinas.find(x => x.nome === "LUM"); d.blocos[0].it = d.blocos[0].it.filter(i => i.d === "Layout"); d.blocos.splice(1, 0, { n: "Térreo", it: [{ id: "man1", d: "Memorial", r: "", s: "Pendente", e: 1, u: 0 }] }); salvar(); desenhar() });
    await c("[data-dadd]"); await dadd("c-lum");
    ok("Disciplinas", "adicionar disciplina que já existe completa só as atividades que faltam", (await page.textContent("#scm")).includes("1 atividade(s) do cadastro acrescentada(s); 2 já estavam") && await ev(() => estado.etapas[0].disciplinas.filter(x => x.nome === "LUM").length === 1), await page.textContent("#scm"));
    await c('[data-tab="2"]'); await c("[data-dren]"); await page.fill("#indv", "SPDA2"); await c("[data-indok]"); await W(200);
    ok("Disciplinas", "renomear disciplina", await ev(() => estado.etapas[0].disciplinas[2].nome === "SPDA2") && (await page.textContent("#tabs .on")) === "SPDA2");
    await c("[data-dren]"); await page.fill("#indv", "ELT"); await c("[data-indok]"); await W(200);
    ok("Disciplinas", "renomear para nome repetido na etapa é recusado", (await page.textContent("#wdb")).includes("Já existe") && await ev(() => estado.etapas[0].disciplinas[2].nome === "SPDA2"));
    await c("[data-dclose]");
    // 💾 salvar no cadastro (pela barra da disciplina)
    await ev(() => { estado.disc[estado.tab][0].it.push({ id: "z9", d: "Atividade nova do SPDA", r: "", s: "Pendente", e: 2, u: 0 }); salvar(); desenhar() });
    await c("#scsv");
    ok("Disciplinas", "💾 salva o Escopo + Geral no cadastro da etapa", await ev(() => { const cd = cadastros.find(x => x.nome === "PP").disciplinas.find(x => x.sigla === "SPDA2"); return cd && cd.atividades.join() === "Atividade nova do SPDA" }) && (await page.textContent("#scm")).includes("1 atividade(s) acrescentada(s)"));
    // excluir disciplinas (SPDA2 e LUM)
    for (const nome of ["SPDA2", "LUM"]) { const k = await ev(n => estado.etapas[0].disciplinas.findIndex(d => d.nome === n), nome); await c(`[data-tab="${k}"]`); await c("[data-ddel]"); await yes(); }
    ok("Disciplinas", "excluir disciplina com confirmação", await ev(() => estado.etapas[0].disciplinas.map(d => d.nome).join() === "ELT,TEL" && telaAtual === "etapa"));
    // + Etapa do cadastro e "todas as que faltam"
    await c("#back");
    ok("Etapas", "← Projeto volta para a lista das etapas", (await ev(() => telaAtual)) === "etapas" && (await page.isVisible("#eadd")));
    await ev(() => { cadastros.push({ id: "t-exe", nome: "EXE", ordem: 1, disciplinas: [{ id: "x-elt", nome: "Elétrica", sigla: "ELT", atividades: ["Detalhamento", "Memorial"] }, { id: "x-tel", nome: "Telecomunicações", sigla: "TEL", atividades: ["Rede"] }] }); gravarCadastro(cadastros.at(-1)); desenharEtapas() });
    ok("Etapas", "+ Etapa lista as etapas do cadastro que o projeto ainda não tem", (await page.locator('#ds option[value="t-exe"]').count()) === 1 && !(await page.locator('#ds option[value="t-pp"]').count()));
    await sel("#ds", "t-exe"); await c("#da");
    ok("Etapas", "adicionar etapa do cadastro já pede as disciplinas", await ev(() => { const e = estado.etapas[1]; return e && e.nome === "EXE" && e.cadastroId === "t-exe" && !e.disciplinas.length && $("wd").open && janela.kind === "dadd" && $("ddsel").value === "*" }));
    await dadd("*");
    ok("Etapas", "todas as disciplinas que faltam do cadastro, e abre a etapa", await ev(() => telaAtual === "etapa" && estado.etapaAberta.nome === "EXE" && estado.etapas[1].disciplinas.map(d => d.nome + ":" + d.blocos[0].it.length).join() === "ELT:2,TEL:1"), await page.textContent("#scm"));
    // etapa em branco
    await c("#back"); await sel("#ds", ""); await c("#da");
    ok("Etapas", "etapa 'outra' exige nome", (await page.textContent("#emsg")).includes("Informe"));
    await abrirMenuDe("#dn2"); await page.fill("#dn2", "pp"); await c("#da");
    ok("Etapas", "bloqueia etapa repetida", (await page.textContent("#emsg")).includes("já está no projeto"));
    await abrirMenuDe("#dn2"); await page.fill("#dn2", "AP"); await page.press("#dn2", "Enter"); await W(300);
    ok("Etapas", "adicionar etapa em branco (Enter)", await ev(() => estado.etapas[2] && estado.etapas[2].nome === "AP" && !estado.etapas[2].cadastroId && $("wd").open));
    ok("Etapas", "etapa sem cadastro oferece as disciplinas de outras etapas (sem atividades)", (await page.textContent("#ddsel")).includes("sem atividades nesta etapa"));
    await c("[data-dclose]");
    ok("Etapas", "cancelar a janela deixa a etapa sem disciplinas", await ev(() => telaAtual === "etapas" && estado.etapas[2].disciplinas.length === 0));
    await c('[data-eabr="2"]');
    ok("Etapas", "abrir etapa sem disciplinas pede a primeira", await ev(() => $("wd").open && janela.kind === "dadd" && janela.arg === 2));
    await dadd("n:ELT");
    ok("Etapas", "disciplina de outra etapa entra em branco", await ev(() => { const d = estado.etapas[2].disciplinas[0]; return telaAtual === "etapa" && d && d.nome === "ELT" && d.blocos[0].it.length === 0 }));
    await c("#back");
    // nomes e datas (só na etapa)
    await setv('[data-en="2"]', "AP2"); ok("Etapas", "renomear etapa", await ev(() => estado.etapas[2].nome === "AP2"));
    await setv('[data-en="2"]', "PP"); ok("Etapas", "renomear para nome repetido no projeto é recusado", await ev(() => estado.etapas[2].nome === "AP2"));
    ok("Etapas", "datas só nas linhas das etapas", (await page.locator("#et [data-eini]").count()) === 3);
    await setv('[data-eini="0"]', "2026-10-01"); await setv('[data-efim="0"]', "2026-10-20");
    ok("Etapas", "datas de início e fim da etapa", await ev(() => estado.etapas[0].ini === "2026-10-01" && estado.etapas[0].fim === "2026-10-20" && !estado.etapas[1].ini));
    ok("Etapas", "aviso de fim ultrapassado identifica a etapa", (await page.textContent("#eal")).includes("PP: a data de fim"));
    ok("Etapas", "cronograma com uma linha por etapa", (await page.locator("#eg .gantt .gb").count()) > 0 && (await page.textContent("#eg")).includes("PP") && !(await page.textContent("#eg")).includes("ELT"));
    ok("Etapas", "coluna de previsão preenchida na etapa", /\d{2}\/\d{2}\/\d{4}/.test(await page.locator("#et tr.grp").first().locator("td:nth-child(8)").textContent()));
    // excluir etapa
    await c('[data-edel="2"]'); await yes(); await c('[data-edel="1"]'); await yes();
    ok("Etapas", "excluir etapa com confirmação", await ev(() => estado.etapas.map(e => e.nome).join() === "PP"));
    // última disciplina excluída volta para a lista
    await ev(() => { estado.etapas.push({ id: "eX", nome: "Temp", cadastroId: "", ini: "", fim: "", disciplinas: [novaDisciplina("X", null, null)] }); salvar(); desenharEtapas() });
    await c('[data-eabr="1"]'); await c("[data-ddel]"); await yes(); await W(300);
    ok("Etapas", "excluir a última disciplina volta para a lista das etapas", await ev(() => telaAtual === "etapas" && estado.etapas[1].disciplinas.length === 0) && (await page.textContent("#emsg")).includes("ficou sem disciplinas"));
    await c('[data-edel="1"]'); await yes();
  });

  // ================= ATIVIDADES =================
  await sec("Atividades", async () => {
    await abrirDisc("0:0"); await W(300);
    ok("Atividades", "abrir etapa mostra pavimentos", await page.locator("section.bl").count() > 5);
    ok("Atividades", "disciplina abre com Etapa › Disciplina no caminho", (await ev(() => $("bcet").textContent + " · " + $("bcdi").textContent)) === "PP · ELT" && (await page.textContent("#sub")) === "· Etapa PP");
    ok("Atividades", "primeiro bloco é o Escopo + Geral", (await page.inputValue('[data-bn="0"]')) === "Escopo + Geral");
    ok("Atividades", "resumo geral da etapa por disciplina", (await page.textContent("#gt")).includes("ELT") && (await page.textContent("#gt")).includes("Total geral"));
    const n0 = await ev(() => estado.disc.ELT[0].it.length);
    await c('[data-add="0"]'); await W(200);
    const id = await ev(() => estado.disc.ELT[0].it.at(-1).id);
    ok("Atividades", "+ Atividade cria linha", await ev(n => estado.disc.ELT[0].it.length === n + 1, n0));
    await setv(`[data-f="d"][data-i="${id}"]`, "Teste de descrição");
    ok("Atividades", "editar descrição", (await it(id)).d === "Teste de descrição");
    await setv(`[data-f="e"][data-i="${id}"]`, "1:30"); ok("Atividades", "estimado em hh:mm", (await it(id)).e === 1.5);
    await setv(`[data-f="e"][data-i="${id}"]`, "2,5"); ok("Atividades", "estimado em decimal com vírgula", (await it(id)).e === 2.5);
    await setv(`[data-f="u"][data-i="${id}"]`, "0:45"); let x = await it(id);
    ok("Atividades", "usado manual e registro no dia de hoje", x.u === 0.75 && x.lg && x.lg[0].d === T0 && Math.abs(x.lg[0].h - .75) < 1e-6, JSON.stringify(x.lg));
    ok("Atividades", "restante calculado", (await page.textContent(`[data-rest="${id}"]`)) === "01:45");
    await sel(`[data-f="s"][data-i="${id}"]`, "Concluído"); x = await it(id);
    ok("Atividades", "status Concluído preenche data de conclusão", x.s === "Concluído" && x.c === T0, x.c);
    await page.locator(`[data-done="${id}"]`).uncheck(); await W(200); x = await it(id);
    ok("Atividades", "desmarcar concluído volta para Em andamento e limpa a data", x.s === "Em andamento" && !x.c);
    await page.locator(`[data-done="${id}"]`).check(); await W(200);
    ok("Atividades", "marcar ✓ conclui", (await it(id)).s === "Concluído");
    await c(`[data-dup="${id}"]`); await W(200);
    const dup = await ev(i => { const b = estado.disc.ELT[0].it, k = b.findIndex(x => x.id === i); return b[k + 1] }, id);
    ok("Atividades", "duplicar atividade (zera tempo e status)", dup && dup.d.endsWith("(cópia)") && dup.u === 0 && dup.s === "Pendente");
    await c(`[data-del="${dup.id}"]`); ok("Atividades", "excluir atividade", !(await it(dup.id)));
    // Enter na última linha cria nova
    const last = await ev(() => estado.disc.ELT[1].it.at(-1).id), nb1 = await ev(() => estado.disc.ELT[1].it.length);
    await page.locator(`[data-f="d"][data-i="${last}"]`).focus(); await page.keyboard.press("Enter"); await W(300);
    ok("Atividades", "Enter na última atividade cria nova", await ev(n => estado.disc.ELT[1].it.length === n + 1, nb1));
    ok("Atividades", "nova atividade já fica com o cursor", await ev(() => document.activeElement && document.activeElement.dataset.i === estado.disc.ELT[1].it.at(-1).id));
    await page.keyboard.press("Alt+n"); await W(300);
    ok("Atividades", "Alt+N cria atividade no pavimento atual", await ev(n => estado.disc.ELT[1].it.length === n + 2, nb1));
    // prioridade + comentários
    ok("Atividades", "prioridade fica na linha da atividade, sem abrir os comentários", (await page.locator(`tr[data-rid="${id}"] select.prs[data-f="pr"]`).count()) === 1 && !(await page.locator(`tr.cmr [data-f="pr"]`).count()));
    await sel(`[data-f="pr"][data-i="${id}"]`, "a");
    ok("Atividades", "definir prioridade", (await it(id)).pr === "a" && await ev(i => (() => { const w = document.querySelector(`[data-f="pr"][data-i="${i}"]`).closest(".prw"); return w.classList.contains("pr-a") && w.querySelector(".prv").textContent === "▲" })(), id));
    await c(`[data-cm="${id}"]`);
    await page.fill(`[data-cmn="${id}"]`, "Primeiro comentário"); await page.press(`[data-cmn="${id}"]`, "Enter"); await W(200);
    ok("Atividades", "adicionar comentário (Enter)", (await it(id)).cm.length === 1);
    await setv(`[data-cmt="${id}:0"]`, "Comentário editado"); ok("Atividades", "editar comentário", (await it(id)).cm[0].t === "Comentário editado");
    await page.fill(`[data-cmn="${id}"]`, "Segundo"); await c(`[data-cmadd="${id}"]`);
    await c(`[data-cmdel="${id}:1"]`); ok("Atividades", "excluir comentário", (await it(id)).cm.length === 1);
    await c(`[data-cmclose="${id}"]`);
    ok("Atividades", "data de conclusão na última coluna da tarefa", await ev(i => { const r = document.querySelector(`tr[data-rid="${i}"]`), tds = [...r.children], k = tds.findIndex(td => td.querySelector('[data-f="c"]')), h = [...r.closest("table").querySelectorAll("thead th")]; return k === tds.length - 2 && h[k].textContent.startsWith("Conclusão") && tds[k - 1].querySelector('[data-f="r"]') }, id));
    ok("Atividades", "selo de comentários e prioridade na linha", await page.locator(`tr[data-rid="${id}"] .bdg`).count() === 1 && (await page.inputValue(`tr[data-rid="${id}"] select.prs`)) === "a");
  });

  // ================= APONTAMENTOS =================
  await sec("Apontamentos", async () => {
    const bi = await ev(() => estado.disc.ELT.findIndex(b => ehBlocoApontamentos(b.n)));
    await c(`[data-add="${bi}"]`); await W(200);
    const id = await ev(b => estado.disc.ELT[b].it.at(-1).id, bi);
    await setv(`[data-f="ap"][data-i="${id}"]`, "Erro na prumada https://app.construflow.com.br/workspace/project/1/issues?issueId=4492");
    let x = await it(id);
    ok("Apontamentos", "colar nome + link separa os dois", x.d === "Erro na prumada" && x.h.includes("issueId=4492"), JSON.stringify([x.d, x.h]));
    ok("Apontamentos", "mostra como link clicável", await page.locator(`tr[data-rid="${id}"] a.lk`).count() === 1);
    await c(`[data-ed="${id}"]`); const url0 = x.h; ok("Apontamentos", "campo de edição mostra nome + link", String(await ev(i => { const e = document.querySelector(`[data-f="ap"][data-i="${i}"]`); return e ? e.value : "(campo não abriu) " + document.querySelector(`tr[data-rid="${i}"] td.d`).innerHTML.slice(0, 120) }, id)).includes(url0), await ev(i => document.querySelector(`tr[data-rid="${i}"] td.d`).innerHTML.slice(0, 160), id));
    await setv(`[data-f="ap"][data-i="${id}"]`, "Só o nome novo " + url0);
    x = await it(id); ok("Apontamentos", "editar só o nome mantém o link", x.d === "Só o nome novo" && x.h === url0);
    await c(`[data-ed="${id}"]`); await setv(`[data-f="ap"][data-i="${id}"]`, "");
    x = await it(id); ok("Apontamentos", "apagar o texto remove o link (deveria)", !x.h, "link continua: " + x.h);
    if (await page.locator(`[data-ed="${id}"]`).count()) await c(`[data-ed="${id}"]`); await setv(`[data-f="ap"][data-i="${id}"]`, "X javascript:alert(1)");
    x = await it(id); ok("Apontamentos", "link javascript: é recusado", !String(x.h).startsWith("javascript"));
    await page.fill(`[data-cn="${id}"]`, "Mover quadro"); await page.press(`[data-cn="${id}"]`, "Enter"); await W(200);
    ok("Apontamentos", "adicionar ação", (await it(id)).l.length === 1);
    await page.locator(`[data-ck="${id}:0"]`).check(); await W(200); ok("Apontamentos", "marcar ação feita", (await it(id)).l[0].c === true);
    await setv(`[data-ct="${id}:0"]`, "Mover quadro QD1"); ok("Apontamentos", "editar ação", (await it(id)).l[0].t === "Mover quadro QD1");
    await c(`[data-cdel="${id}:0"]`); ok("Apontamentos", "excluir ação", (await it(id)).l.length === 0);
    await page.fill(`[data-cn="${id}"]`, "Ação final"); await c(`[data-cadd="${id}"]`);
  });

  // ================= RESPONSÁVEIS / FILTROS / VISUAL =================
  await sec("Filtros", async () => {
    await c('[data-dlg="pe"]'); ok("Responsáveis", "janela aberta pelo menu Configurações", await ev(() => $("wd").open && janela.kind === "pe"));
    await page.fill("#np", "Carlos"); await c("#addp"); ok("Responsáveis", "adicionar responsável", await ev(() => estado.pe.includes("Carlos")));
    await page.fill("#np", "carlos"); await c("#addp"); ok("Responsáveis", "não duplica (maiúsc./minúsc.)", await ev(() => estado.pe.filter(n => n.toLowerCase() === "carlos").length === 1));
    const k = await ev(() => estado.pe.indexOf("Carlos")); await c(`[data-delp="${k}"]`); ok("Responsáveis", "remover responsável", await ev(() => !estado.pe.includes("Carlos")));
    await page.fill("#np", "Bia"); await page.press("#np", "Enter"); await W(150); ok("Responsáveis", "Enter adiciona e a lista da janela atualiza", await ev(() => estado.pe.includes("Bia") && $("chips").textContent.includes("Bia")));
    await c(`[data-delp="${await ev(() => estado.pe.indexOf("Bia"))}"]`); await c("#wd [data-dclose]");
    const id = await firstIt(0); await sel(`[data-f="r"][data-i="${id}"]`, "Milene");
    ok("Responsáveis", "trocar responsável da atividade", (await it(id)).r === "Milene");
    ok("Filtros", "sem filtro geral na tela (só nos pavimentos)", !(await page.locator("#fr, #fs, #fpri, #fq, #fc").count()) && (await page.locator('section.bl[data-bi="0"] [data-fb="0:s"]').count()) === 1 && (await page.locator('section.bl[data-bi="0"] [data-fb="0:r"]').count()) === 1);
    const linhas0 = () => page.locator('section.bl[data-bi="0"] tr[data-rid]').count(), linhasTodas = () => page.locator("tr[data-rid]").count();
    const n0 = await ev(() => estado.disc.ELT[0].it.length), nt = await linhasTodas();
    await c('[data-fb="0:r"]');
    ok("Filtros", "título Responsável abre a lista de valores com contagem", await ev(() => !!$("fpop") && [...document.querySelectorAll("#fpop [data-fpv]")].some(x => x.dataset.fpv === "Milene")));
    await page.uncheck("#fpop [data-fpall]"); await page.check('#fpop [data-fpv="Milene"]'); await c("#fpop [data-fpok]");
    ok("Filtros", "filtro por responsável só no pavimento", (await linhas0()) === 1 && (await linhasTodas()) === nt - n0 + 1, (await linhas0()) + " / " + (await linhasTodas()));
    ok("Filtros", "pavimento filtrado mostra 'Filtro: X de Y' e o ícone destacado", (await page.textContent('section.bl[data-bi="0"] h2')).includes("Filtro: 1 de " + n0) && await ev(() => document.querySelector('[data-fb="0:r"]').classList.contains("on")));
    await c('[data-fbclr="0"]');
    ok("Filtros", "limpar o filtro do pavimento", (await linhas0()) === n0 && await ev(() => !Object.keys(filtrosBloco).length));
    await sel(`[data-f="s"][data-i="${id}"]`, "Concluído");
    await c('[data-fb="0:s"]'); await page.uncheck('#fpop [data-fpv="Concluído"]');
    ok("Filtros", "desmarcar um valor desmarca o '(Selecionar tudo)'", await ev(() => !document.querySelector("#fpop [data-fpall]").checked));
    await page.press('#fpop [data-fpv="Concluído"]', "Enter"); await W(200);
    const naoConc = await ev(() => estado.disc.ELT[0].it.filter(i => i.s !== "Concluído").length);
    ok("Filtros", "filtro por status (Enter aplica)", (await linhas0()) === naoConc && await ev(() => [...document.querySelectorAll('section.bl[data-bi="0"] tr[data-rid] select[data-f="s"]')].every(s => s.value !== "Concluído")));
    await reloadKeep();
    ok("Filtros", "filtros do pavimento continuam depois de recarregar", (await linhas0()) === naoConc);
    await c('[data-fb="0:s"]'); await c("#fpop [data-fpclr]");
    ok("Filtros", "Limpar na lista tira o filtro da coluna", (await linhas0()) === n0);
    await setv(`[data-f="c"][data-i="${id}"]`, "2026-10-15");
    await c('[data-fb="0:c"]');
    ok("Filtros", "título Conclusão (data de entrega) lista as datas e '(Sem data)'", await ev(() => { const l = [...document.querySelectorAll("#fpop label")].map(x => x.textContent); return l.some(t => t.includes("15/10/2026")) && l.some(t => t.includes("(Sem data)")) }));
    await page.uncheck("#fpop [data-fpall]"); await page.check('#fpop [data-fpv="2026-10-15"]'); await c("#fpop [data-fpok]");
    ok("Filtros", "filtro por data de entrega", (await linhas0()) === await ev(() => estado.disc.ELT[0].it.filter(i => i.c === "2026-10-15").length) && await ev(() => document.querySelector('[data-fb="0:c"]').classList.contains("on")));
    await c('[data-fbclr="0"]');
    await c('[data-fb="0:s"]'); await page.keyboard.press("Escape"); await W(100);
    ok("Filtros", "Esc fecha a lista sem mudar nada", await ev(() => !$("fpop")) && (await linhas0()) === n0);
    await sel(`[data-f="s"][data-i="${id}"]`, "Pendente");
    await c('[data-tg="0"]'); ok("Visual", "recolher um pavimento", await page.locator("section.bl.col").count() === 1);
    await c("#colall"); ok("Visual", "recolher tudo", await ev(() => document.querySelectorAll("section.bl").length === document.querySelectorAll("section.bl.col").length));
    await c("#expall"); ok("Visual", "expandir tudo", await page.locator("section.bl.col").count() === 0);
    await page.keyboard.press("Alt+["); await W(200); ok("Visual", "Alt+[ recolhe", await page.locator("section.bl.col").count() > 0);
    await page.keyboard.press("Alt+]"); await W(200); ok("Visual", "Alt+] expande", await page.locator("section.bl.col").count() === 0);
    const before = await page.locator("tr.cmr").count(); await c("#hidec");
    ok("Visual", "recolher comentários", before > 0 && await page.locator("tr.cmr").count() === 0);
    await c("#hidec");
    const th0 = await ev(() => document.documentElement.getAttribute("data-theme")); await c("[data-thm]"); const th1 = await ev(() => document.documentElement.getAttribute("data-theme")); await c("[data-thm]"); const th2 = await ev(() => document.documentElement.getAttribute("data-theme")); await c("[data-thm]");
    ok("Visual", "alternar tema (auto → claro → escuro)", th0 === null && th1 === "light" && th2 === "dark");
    await page.keyboard.press("Escape"); await W();
  });

  // ================= LAYOUT DA TELA DA DISCIPLINA =================
  await sec("Layout", async () => {
    await abrirDisc("0:0");
    ok("Layout", "caminho Projetos › projeto › etapa › disciplina", await ev(() => $("back").textContent === projetos[idProjetoAberto].name && $("bcet").textContent === estado.etapaAberta.nome && $("bcdi").textContent === estado.discAberta.nome));
    ok("Layout", "sem os cartões, a linha de responsáveis e as barras antigas", await ev(() => !$("sum") && !document.querySelector("#proj .team") && !document.querySelector("#proj .flt:not(#bar) b")));
    ok("Layout", "botão Tema do topo some na tela da disciplina", await ev(() => getComputedStyle($("thm")).display === "none"));
    ok("Layout", "disciplina aberta destacada no resumo", await ev(() => document.querySelector("#gt tr.cur button[data-tab]").dataset.tab === String(estado.di)));
    const menus = await page.locator("#proj [data-dd]").count();
    ok("Layout", "menus fechados ao abrir a tela", await ev(() => [...document.querySelectorAll("#proj .ddm")].every(m => m.hidden)) && menus >= 4, menus);
    await page.locator("#proj .dact [data-dd]").first().click(); await W();
    ok("Layout", "Exportar ▾ abre com PDF e Excel", await page.locator("#expp").isVisible() && await page.locator("#expx").isVisible());
    await page.mouse.click(700, 15); await W();
    ok("Layout", "clicar fora fecha o menu", await ev(() => !menuAberto) && !(await page.locator("#expp").isVisible()));
    await c("#expx"); await W(400);
    ok("Layout", "item do menu roda a ação e fecha o menu", await ev(() => window.__dl.length > 0 && !menuAberto));
    await page.click("#tabs [data-dd]"); await W();
    const box = await page.locator("#tabs .ddm").boundingBox();
    ok("Layout", "menu ⋯ da disciplina dentro da tela", box && box.x >= 0 && box.x + box.width <= 1500, JSON.stringify(box));
    await page.keyboard.press("Escape"); await W();
    ok("Layout", "Esc fecha o menu sem fechar a tela", await ev(() => !menuAberto && telaAtual === "etapa"));
    await c("#tgger"); ok("Layout", "recolher o resumo", await ev(() => $("gtw").hidden));
    await c("#tgger"); ok("Layout", "mostrar o resumo de novo", await ev(() => !$("gtw").hidden));
    await c('#gt button[data-tab="1"]'); ok("Layout", "clicar na disciplina do resumo abre ela", await ev(() => estado.di === 1 && $("bcdi").textContent === estado.discAberta.nome));
    await c('[data-tab="0"]');
    const pidL = await ev(() => idProjetoAberto);
    await c("#bchome"); ok("Layout", "“Projetos” no caminho volta para o início", await ev(() => telaAtual === "home"));
    await c(`[data-open="${pidL}"]`); await abrirDisc("0:0");
  });

  // ================= BACKUP =================
  await sec("Backup", async () => {
    const pidB = await ev(() => idProjetoAberto);
    await inicio();
    const n0 = await ev(() => window.__dl.length);
    await c("#bkdown"); await W(400);
    const bk = await ev((n) => { const d = window.__dl[n]; return d && { f: d.filename, j: JSON.parse(decodeURIComponent(escape(atob(d.b)))) }; }, n0);
    ok("Backup", "baixar backup de tudo (.json)", bk && /^backup-planejamento-.*\.json$/.test(bk.f) && bk.j.projetos.length === (await ev(() => Object.keys(projetos).length)), bk && bk.f);
    // restaura uma cópia com um projeto "novo" (outro id)
    const p0 = bk.j.projetos[0], novo = { ...p0, id: "pbk" + Date.now(), name: "Projeto do backup", upd: Date.now() };
    const arq = { ...bk.j, projetos: [novo] };
    await page.setInputFiles("#bkfile", { name: "b.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(arq)) }); await W(300);
    await yes(); await W(500);
    ok("Backup", "restaurar acrescenta o projeto do backup", await ev((id) => !!projetos[id] && projetos[id].name === "Projeto do backup", novo.id));
    await page.setInputFiles("#bkfile", { name: "x.json", mimeType: "application/json", buffer: Buffer.from("{nao é json") }); await W(300);
    ok("Backup", "arquivo inválido: avisa", (await page.textContent("#sv")).includes("não é um backup válido"));
    await ev((id) => excluirProjeto(id), novo.id); await W(300);
    await c(`[data-open="${pidB}"]`); await abrirDisc("0:0");
  });

  // ================= LAYOUT DA TELA DO PROJETO (etapas) =================
  await sec("Layout projeto", async () => {
    await c("#back"); await W(200);
    ok("Layout projeto", "caminho Projetos › projeto", await ev(() => telaAtual === "etapas" && $("ebcp").textContent === projetos[idProjetoAberto].name));
    ok("Layout projeto", "sem os cartões e sem o quadro separado de “Adicionar etapa”", await ev(() => !$("esum") && $("enf").closest(".ddm") === $("enf")));
    ok("Layout projeto", "botão Tema do topo some na tela do projeto", await ev(() => getComputedStyle($("thm")).display === "none"));
    ok("Layout projeto", "linha da etapa: Abrir e ⋯ (Excluir dentro do menu)", await ev(() => { const tr = document.querySelector("#et tbody tr.grp"); return !!tr.querySelector(".df > button[data-eabr]") && !!tr.querySelector(".ddm [data-edel]") && !tr.querySelector(".df > button[data-edel]"); }));
    await setv("#ehd", "6"); ok("Layout projeto", "Horas por dia no menu Configurações", await ev(() => estado.hd === 6)); await setv("#ehd", "7"); await page.keyboard.press("Escape");
    const n0 = await ev(() => window.__dl.length);
    await c('[data-exp="pdf"]'); await W(1500);
    ok("Layout projeto", "Exportar ▾ › PDF na tela do projeto", await ev((n) => window.__dl.length === n + 1 && window.__dl[n].filename.endsWith(".pdf"), n0));
    await c("#tgcg"); ok("Layout projeto", "recolher o cronograma", await ev(() => $("eg").hidden));
    await c("#tgcg"); ok("Layout projeto", "mostrar o cronograma", await ev(() => !$("eg").hidden));
    await sel("#ds", ""); await c("#da");
    ok("Layout projeto", "aviso aparece dentro do menu + Etapa", await ev(() => !$("enf").hidden && $("enfm").textContent.includes("Informe")));
    await page.keyboard.press("Escape");
    await abrirDisc("0:0");
  });

  // ================= SELEÇÃO EM LOTE / ORDENAÇÃO / ARRASTAR =================
  await sec("Lote", async () => {
    await c("#selm"); const ids = await ev(() => estado.disc.ELT[2].it.slice(0, 2).map(i => i.id));
    for (const i of ids) { await page.locator(`[data-sel="${i}"]`).check(); await W(150); }
    ok("Lote", "selecionar atividades", (await page.textContent("#barn")).startsWith("2"));
    await sel("#bst", "Falta publicar"); await c("#bstb"); ok("Lote", "aplicar status em lote", (await it(ids[0])).s === "Falta publicar" && (await it(ids[1])).s === "Falta publicar");
    await sel("#brs", "Thalles"); await c("#brsb"); ok("Lote", "aplicar responsável em lote", (await it(ids[1])).r === "Thalles");
    await sel("#bpr", "m"); await c("#bprb"); ok("Lote", "aplicar prioridade em lote", (await it(ids[0])).pr === "m");
    await page.fill("#bdc", "2026-10-15"); await c("#bdcb"); ok("Lote", "aplicar data de conclusão em lote", (await it(ids[0])).c === "2026-10-15");
    await c("#bdel"); await yes(); ok("Lote", "excluir selecionadas", !(await it(ids[0])) && !(await it(ids[1])));
    await c("#selall"); ok("Lote", "selecionar visíveis", parseInt(await page.textContent("#barn")) > 10);
    await c("#selnone"); ok("Lote", "limpar seleção", (await page.textContent("#barn")).startsWith("0"));
    await c("#selm");
    await c("#sortp"); const first = await page.locator("section.bl").first().locator("tr[data-rid]").first().getAttribute("data-rid");
    ok("Ordenação", "ordenar por prioridade (Alta primeiro)", (await it(first)).pr === "a");
    ok("Ordenação", "arrastar fica bloqueado com ordenação", await page.locator(".dh.off").count() > 0);
    await c("#sortp");
    const a = await ev(() => estado.disc.ELT[3].it.map(i => i.id));
    await page.locator(`[data-dh="${a[2]}"]`).dragTo(page.locator(`tr[data-rid="${a[0]}"]`)); await W(300);
    ok("Arrastar", "reordenar atividade arrastando", await ev(x => estado.disc.ELT[3].it[0].id === x, a[2]), JSON.stringify(await ev(() => estado.disc.ELT[3].it.map(i => i.id))));
    const n4 = await ev(() => estado.disc.ELT[4].n);
    await c("#colall"); await page.locator('[data-bh="4"]').dragTo(page.locator('section.bl[data-bi="1"] h2 > span:last-child')); await W(300); await c("#expall");
    ok("Arrastar", "reordenar pavimento arrastando", await ev(n => estado.disc.ELT[1].n === n, n4));
  });

  // ================= PAVIMENTOS / DISCIPLINAS / ESCOPO =================
  await sec("Pavimentos", async () => {
    const nb = await ev(() => estado.disc.ELT.length);
    await page.fill("#nb", "9º Pavimento"); await c("#addb");
    const np = await ev(() => estado.disc.ELT.findIndex(b => b.n === "9º Pavimento"));
    ok("Pavimentos", "adicionar pavimento (entra antes dos Apontamentos)", await ev(([n, k]) => estado.disc.ELT.length === n + 1 && k >= 0 && ehBlocoApontamentos(estado.disc.ELT[k + 1].n), [nb, np]));
    await setv(`[data-bn="${np}"]`, "10º Pavimento"); ok("Pavimentos", "renomear pavimento", await ev(n => estado.disc.ELT[n].n === "10º Pavimento", np));
    const src = await ev(() => estado.disc.ELT.findIndex(b => b.n === "Cobertura"));
    await c(`[data-dupb="${src}"]`); ok("Pavimentos", "duplicar pavimento", await ev(s => estado.disc.ELT[s + 1].n === "Cobertura (cópia)" && estado.disc.ELT[s + 1].it.length === estado.disc.ELT[s].it.length, src));
    await c(`[data-rpl="${src}"]`); const tgt = await ev(() => estado.disc.ELT.findIndex(b => b.n === "10º Pavimento"));
    await page.locator(`[data-rplc="${tgt}"]`).check(); await c("[data-rplrun]");
    ok("Pavimentos", "replicar atividades para outro pavimento", await ev(t => estado.disc.ELT[t].it.length === 3, tgt), await ev(t => estado.disc.ELT[t].it.length, tgt));
    await c("[data-rplrun]"); ok("Pavimentos", "replicar de novo não duplica", await ev(t => estado.disc.ELT[t].it.length === 3, tgt));
    await c("[data-dclose]");
    await c(`[data-svb="${src}"]`); await page.fill("#indv", "Modelo Cobertura"); await c("[data-indok]");
    const tp = await ev(() => Object.values(modelosSalvos).find(t => t.nome === "Modelo Cobertura"));
    ok("Pavimentos", "salvar pavimento como modelo", !!tp);
    await c(`[data-delb="${tgt}"]`); await yes(); ok("Pavimentos", "excluir pavimento com confirmação", await ev(() => !estado.disc.ELT.some(b => b.n === "10º Pavimento")));
    const n1 = await ev(() => estado.disc.ELT.length);
    await ev(() => { const k = estado.disc.ELT.findIndex(b => b.n === "Cobertura"); estado.disc.ELT[k].n = "Cobertura antiga"; desenhar() });
    await sel("#nbt", tp.id); await c("#addbt");
    ok("Pavimentos", "+ Pavimento do modelo", await ev(n => estado.disc.ELT.length === n + 1 && estado.disc.ELT.at(-1).n === "Cobertura" && estado.disc.ELT.at(-1).it.length === 3, n1));
    ok("Escopo", "barra do cadastro já vem com a disciplina desta etapa", (await page.inputValue("#scs")) === "t-pp:c-elt");
    await ev(() => { estado.disc.ELT[0].it = estado.disc.ELT[0].it.filter(i => i.d !== "Pegar o checklist"); desenhar() });
    await c("#scl");
    ok("Escopo", "carregar do cadastro acrescenta só as que faltam", (await page.textContent("#scm")).includes("1 atividade(s) do cadastro acrescentada(s)") && await ev(() => estado.disc.ELT[0].it.some(i => i.d === "Pegar o checklist")), await page.textContent("#scm"));
    await c('[data-delb="0"]');
    ok("Escopo", "bloco Escopo + Geral não pode ser excluído", (await page.textContent("#sv")).includes("não pode ser excluído") && (await page.inputValue('[data-bn="0"]')) === "Escopo + Geral");
    await setv("#hd", "8"); ok("Geral", "alterar horas por dia", await ev(() => estado.hd === 8 && emDias(16) === "2,0"));
    ok("Geral", "resumo geral da etapa", (await page.textContent("#gt")).includes("Total geral"));
  });

  // ================= DESFAZER / REFAZER =================
  await sec("Desfazer", async () => {
    const id = await firstIt(0); const d0 = (await it(id)).d;
    await page.click(`[data-f="d"][data-i="${id}"]`); await W(400); await page.click(`[data-f="d"][data-i="${id}"]`, { clickCount: 3 }); await page.keyboard.press("Control+a"); await page.keyboard.type("MUDANÇA PARA DESFAZER"); await page.keyboard.press("Tab"); await W(300);
    await c("#un"); ok("Desfazer", "botão Desfazer", (await it(id)).d === d0, (await it(id)).d);
    await c("#rd"); ok("Desfazer", "botão Refazer", (await it(id)).d === "MUDANÇA PARA DESFAZER");
    await page.locator("body").click({ position: { x: 5, y: 5 } }); await page.keyboard.press("Control+z"); await W(200);
    ok("Desfazer", "Ctrl+Z fora dos campos", (await it(id)).d === d0);
    await page.keyboard.press("Control+y"); await W(200); ok("Desfazer", "Ctrl+Y fora dos campos", (await it(id)).d === "MUDANÇA PARA DESFAZER");
  });

  // ================= CRONÔMETRO =================
  let RUNID;
  await sec("Cronômetro", async () => {
    const id = await ev(() => estado.disc.ELT.find(b => b.n === "Subsolo").it[1].id); RUNID = id;
    const u0 = (await it(id)).u;
    await c(`[data-run="${id}"]`);
    ok("Cronômetro", "play inicia e muda para Em andamento", await ev(i => estado.run && estado.run.id === i && acharAtividade(i).s === "Em andamento", id));
    await ev(() => { estado.run.t0 -= 3600e3 }); await W(1200);
    ok("Cronômetro", "contador ao vivo atualiza", /^01:00:0\d$/.test(await page.textContent(`[data-live="${id}"]`)));
    const other = await ev(() => estado.disc.ELT.find(b => b.n === "Subsolo").it[2].id);
    await c(`[data-run="${other}"]`); ok("Cronômetro", "bloqueia dois cronômetros ao mesmo tempo", await ev(() => $("dlg").open) && (await page.textContent("#dm")).includes("Já existe"));
    await c("#dn");
    await c(`[data-run="${id}"]`); const x = await it(id);
    ok("Cronômetro", "pausar soma ~1h ao usado e registra o dia", Math.abs(x.u - u0 - 1) < 0.01 && x.lg.some(l => l.d === T0), x.u);
    await c(`[data-run="${id}"]`); await ev(() => { estado.run.t0 -= 1800e3 });
    await inicio(); await W(150);
    ok("Cronômetro", "barra do cronômetro aparece fora da etapa", await page.isVisible("#runbar"));
    ok("Cronômetro", "card mostra '⏱ rodando'", (await page.textContent("#pgrid")).includes("rodando"));
    await c("#rgo"); await W(400);
    ok("Cronômetro", "'Ir para a atividade' abre a etapa certa", await ev(i => telaAtual === "etapa" && !!document.querySelector(`tr[data-rid="${i}"]`), id));
    await inicio(); await W(150);
    await c("#rpause"); await W(300);
    const j = await ev(p => { const x = JSON.parse(projetos[p].j); return { run: x.run, u: acharAtividadeEm(x, window.__rid).u } }, JB).catch(() => null);
    await ev(i => window.__rid = i, id);
    const j2 = await ev(p => { const x = JSON.parse(projetos[p].j); return { run: x.run, u: acharAtividadeEm(x, window.__rid).u } }, JB);
    ok("Cronômetro", "pausar pela barra (fora da etapa) soma o tempo", j2.run === null && Math.abs(j2.u - u0 - 1.5) < 0.01, JSON.stringify(j2));
  });

  // ================= DIÁLOGOS: STATUS / CALENDÁRIO / HISTÓRICO / ATALHOS =================
  await sec("Diálogos", async () => {
    await c(`[data-open="${JB}"]`); await abrirDisc("0:0"); await W(300);
    await c('#proj [data-dlg="std"]');
    await setv('[data-stn="0"]', "A fazer"); await c("[data-stadd]"); await setv('[data-stn="5"]', "Revisão"); await sel('[data-str="5"]', "and");
    await c("[data-stsave]"); await W(200);
    ok("Status", "renomear status atualiza as atividades", await ev(() => nomesStatus.includes("A fazer") && !nomesStatus.includes("Pendente") && Object.values(estado.disc).flat().flatMap(b => b.it).some(i => i.s === "A fazer")));
    ok("Status", "criar novo status", await ev(() => nomesStatus.includes("Revisão") && comportamentoDo("Revisão") === "and"));
    await c('#proj [data-dlg="std"]'); await c('[data-stdel="0"]');
    ok("Status", "não exclui status em uso", (await page.textContent("#wdb")).includes("está em uso"));
    await c("[data-dclose]");
    await c('#proj [data-dlg="cal"]'); await page.locator('[data-caldia="5"]').uncheck(); await W(150);
    ok("Calendário", "desmarcar sexta como dia útil", await ev(() => !estado.cal.dias.includes(5)));
    await page.locator('[data-caldia="5"]').check(); await W(150);
    await page.fill("#cevn", "Férias"); await page.fill("#cevi", "2026-12-21"); await page.fill("#cevf", "2026-12-31"); await c("[data-caladd]");
    ok("Calendário", "adicionar férias/folga", await ev(() => estado.cal.ev.some(e => e.nome === "Férias")));
    await page.fill("#cevn", "Ruim"); await page.fill("#cevi", "2026-12-21"); await page.fill("#cevf", "2026-12-01"); await c("[data-caladd]");
    ok("Calendário", "recusa fim antes do início", (await page.textContent("#wdb")).includes("não pode"));
    await page.fill("#cfy", "2026"); await c("[data-calfer]");
    ok("Calendário", "adicionar feriados nacionais (13)", await ev(() => estado.cal.ev.length === 14), await ev(() => estado.cal.ev.length));
    ok("Calendário", "Páscoa/Carnaval 2026 corretos", await ev(() => pascoa(2026) === "2026-04-05" && estado.cal.ev.some(e => e.ini === "2026-02-17")));
    await c("[data-calfer]"); ok("Calendário", "não repete feriados", await ev(() => estado.cal.ev.length === 14));
    ok("Calendário", "dia útil ignora feriado", await ev(() => !ehDiaUtil("2026-12-25") && ehDiaUtil("2026-12-18")));
    const id = await ev(() => estado.cal.ev[0].id); await c(`[data-calrm="${id}"]`); ok("Calendário", "remover evento", await ev(() => estado.cal.ev.length === 13));
    await c("[data-dclose]");
    await c('#proj [data-dlg="hist"]'); ok("Histórico", "abre estimado × real", (await page.textContent("#wdt")).includes("Histórico") && (await page.textContent("#wdb")).includes("concluídas"));
    await c("[data-dclose]");
    await c('#proj [data-dlg="kbd"]'); ok("Atalhos", "abre lista de atalhos", (await page.textContent("#wdb")).includes("Alt + N")); await c("[data-dclose]");
    await c('#proj [data-dlg="tpl"]'); ok("Modelos", "lista meus modelos", (await page.textContent("#wdb")).includes("Modelo Cobertura"));
    const tid = await ev(() => Object.values(modelosSalvos).find(t => t.nome === "Modelo Cobertura").id);
    await c(`[data-tpldel="${tid}"]`); await yes(); ok("Modelos", "excluir modelo", await ev(t => !modelosSalvos[t], tid));
    await c("[data-dclose]").catch(() => { });
  });

  // ================= ALERTAS =================
  await sec("Alertas", async () => {
    const [a, b] = await ev(() => estado.disc.ELT.find(b => !ehBlocoApontamentos(b.n) && b.it.filter(i => comportamentoDo(i.s) === "pend").length >= 2).it.filter(i => comportamentoDo(i.s) === "pend").map(i => i.id));
    await setv(`[data-f="e"][data-i="${a}"]`, "1:00"); await setv(`[data-f="u"][data-i="${a}"]`, "1:30");
    await setv(`[data-f="e"][data-i="${b}"]`, "1:00"); await setv(`[data-f="u"][data-i="${b}"]`, "0:50");
    const t = await page.textContent("#al");
    ok("Alertas", "alerta 'Estourou'", t.includes("Estourou")); ok("Alertas", "alerta 'Perto do limite'", t.includes("Perto do limite"));
    ok("Alertas", "restante negativo em vermelho", await page.locator(`[data-rest="${a}"].r`).count() === 1);
  });

  // ================= EXPORTAÇÕES =================
  await sec("Exportar", async () => {
    ok("Exportar", "etapa não tem mais o botão Exportar CSV", !(await page.locator("#exp").count()));
    await ev(() => window.__dl = []);
    await c("#expx"); await W(500); await c("#expp"); await W(2500);
    const d = await ev(() => window.__dl);
    const f = n => d.find(x => x.filename.endsWith(n));
    ok("Exportar", "Excel", !!f(".xlsx")); ok("Exportar", "PDF", !!f(".pdf"), await page.textContent("#sv"));
    ok("Exportar", "só PDF e Excel", d.every(x => /\.(xlsx|pdf)$/.test(x.filename)));
    for (const x of d) fs.writeFileSync(SAIDA + "/out_" + x.filename, Buffer.from(x.b, "base64"));
    const XLSX = require("xlsx"), wb = XLSX.read(Buffer.from(f(".xlsx").b, "base64"), { type: "buffer" });
    ok("Exportar", "Excel com abas Etapa · Disciplina, na ordem das etapas", wb.SheetNames.join("|").startsWith("Resumo|Etapas|PP · ELT|PP · TEL"), wb.SheetNames.join("|"));
    const res = XLSX.utils.sheet_to_json(wb.Sheets.Resumo, { header: 1 });
    ok("Exportar", "resumo por Etapa · Disciplina com subtotal da etapa e total", res[0][0] === "Etapa · Disciplina" && res.some(r => r[0] === "PP · ELT") && res.some(r => r[0] === "Subtotal PP") && res.at(-1)[0] === "Total do projeto", JSON.stringify(res.map(r => r[0])));
    const et = XLSX.utils.sheet_to_json(wb.Sheets.Etapas, { header: 1 });
    ok("Exportar", "aba Etapas começa pela etapa", et[0].slice(0, 4).join() === "Etapa,Disciplina,Início,Fim" && et[1][0] === "PP" && et[1][1] === "ELT", JSON.stringify(et.slice(0, 2)));
    const pdf = Buffer.from(f(".pdf").b, "base64");
    const paginas = (await require("pdf-lib").PDFDocument.load(pdf)).getPageCount();
    ok("Exportar", "PDF válido com várias páginas", pdf.slice(0, 4).toString() === "%PDF" && paginas > 1, paginas);
    try {
      const txt = require("child_process").execFileSync("pdftotext", ["-layout", SAIDA + "/" + "out_" + f(".pdf").filename, "-"]).toString();
      ok("Exportar", "PDF organizado por Etapa · Disciplina", txt.includes("Etapa · Disciplina") && txt.includes("PP · ELT") && txt.includes("PP · TEL") && txt.includes("Subtotal PP"));
    } catch (e) { console.log("(pdftotext indisponível: conferência do texto do PDF pulada)"); }
  });

  // ================= HORAS TRABALHADAS =================
  await sec("Horas", async () => {
    await c("#proj [data-hrs]"); await W(400);
    ok("Horas", "abre a aba Horas trabalhadas", await page.isVisible("#hhrs"));
    const tday = await page.textContent("#hsm div:first-child b");
    ok("Horas", "total do dia inclui o cronômetro e lançamentos", tday !== "00:00", tday);
    await c('[data-hp="w"]'); ok("Horas", "visão semana (seg a dom)", (await page.textContent("#hh2")).startsWith("Semana de"));
    ok("Horas", "chips por dia na semana", await page.locator("#hdc .hc").count() === 7);
    await c('[data-hp="m"]'); ok("Horas", "visão mês", /de 20\d\d/.test(await page.textContent("#hh2")));
    await c('[data-hnav="-1"]'); const prev = await page.textContent("#hh2"); await c('[data-hnav="0"]');
    ok("Horas", "navegar período anterior / Hoje", prev !== await page.textContent("#hh2"));
    await c('[data-hp="d"]');
    await c("#hcol"); ok("Horas", "recolher projetos", await page.locator("#htab tr.sub").count() === 0);
    await c("#hexp"); ok("Horas", "expandir projetos", await page.locator("#htab tr.sub").count() > 0);
    const tot0 = await ev(() => dadosHoras().G.size ? [...dadosHoras().G.values()].reduce((a, g) => a + g.tot, 0) : 0);
    await page.locator("#hlan summary").click();
    await sel("#lpj", JB); const aid = await page.locator("#lat option").nth(3).getAttribute("value");
    await sel("#lat", aid); await page.fill("#ldt", T0); await page.fill("#lh", "2:00"); await c("#lgo"); await W(200);
    const tot1 = await ev(() => [...dadosHoras().G.values()].reduce((a, g) => a + g.tot, 0));
    ok("Horas", "lançar horas manualmente", Math.abs(tot1 - tot0 - 2) < 0.01 && (await page.textContent("#lmsg")).includes("Lançado"), tot1 - tot0);
    await c("#lgo"); ok("Horas", "lançamento sem horas é recusado", (await page.textContent("#lmsg")).includes("Informe"));
    ok("Horas", "agenda do período com blocos de horário do cronômetro", await ev(() => { let n = 0; paraCadaAtividade((pj, e, d, bl, i) => { n += (i.ss || []).length }); return n > 0 }) && /\d{2}:\d{2}–\d{2}:\d{2}/.test(await page.textContent("#hag")));
    await ev(() => window.__dl = []); await c("#hagcsv"); await W(300);
    ok("Horas", "baixar a agenda em .csv no formato do Google Agenda", await ev(() => { const f = window.__dl.find(x => x.filename.endsWith(".csv")); if (!f) return false; const t = decodeURIComponent(escape(atob(f.b))); return t.startsWith('"Subject","Start Date","Start Time","End Date","End Time"') && t.includes('"True"') && t.includes("⏱ ") && !t.includes(" · ELT") }));
    ok("Horas", "tabela mostra Etapa · Disciplina e o bloco", (await page.textContent("#htab")).includes("Etapa · Disciplina") && (await page.textContent("#htab")).includes("PP · ELT"));
    await ev(() => window.__dl = []); await c("#hxls"); await W(400);
    const hx = await ev(() => window.__dl.find(x => x.filename.startsWith("horas-")));
    ok("Horas", "exportar horas em Excel (não mais CSV)", !!hx && hx.filename.endsWith(".xlsx") && !(await page.locator("#hcsv").count()), hx && hx.filename);
    if (hx) {
      const XLSX = require("xlsx"), wb = XLSX.read(Buffer.from(hx.b, "base64"), { type: "buffer" }), hs = XLSX.utils.sheet_to_json(wb.Sheets.Horas, { header: 1 });
      const tot = await ev(() => [...dadosHoras().G.values()].reduce((a, g) => a + g.tot, 0));
      ok("Horas", "Excel de horas: colunas Projeto, Etapa, Disciplina, Bloco, Atividade, Horas", hs[0].join() === "Projeto,Etapa,Disciplina,Bloco,Atividade,Horas" && hs[1][1] && hs[1][2], JSON.stringify(hs.slice(0, 2)));
      ok("Horas", "Excel de horas: total confere e tem as abas Por dia e Período", Math.abs(hs.at(-1)[5] * 24 - tot) < 0.01 && wb.SheetNames.join() === "Horas,Por dia,Período", hs.at(-1)[5] * 24 + " vs " + tot);
    }
    await sel("#hpj", JB); ok("Horas", "filtrar por projeto", await ev(p => [...dadosHoras().G.keys()].every(k => k === p), JB));
    await sel("#hpj", "");
  });

  // ================= IMPORTAR EXCEL (ida e volta) =================
  await sec("Importar", async () => {
    await c('[data-ht="proj"]');
    await c(`[data-open="${JB}"]`); await abrirDisc("0:0"); await W(300); await ev(() => window.__dl = []); await c("#expx"); await W(600);
    { const x = await ev(() => window.__dl.find(x => x.filename.endsWith(".xlsx"))); fs.writeFileSync(SAIDA + "/out_" + x.filename, Buffer.from(x.b, "base64")); }
    await inicio();
    const before = await ev(p => { const x = JSON.parse(projetos[p].j); let n = 0, cm = 0, pr = 0, l = 0, h = 0, nb = 0, lg = 0; const st = new Set(); percorrerBlocos(x, b => { nb++; b.it.forEach(i => { n++; cm += (i.cm || []).length; if (i.pr) pr++; l += (i.l || []).length; if (i.h) h++; st.add(i.s); lg += (i.lg || []).reduce((a, q) => a + q.h, 0) }) }); const pares = listarPares(x); return { n, cm, pr, l, h, nb, lg: Math.round(lg * 3600), ds: pares.map(q => q.disciplina + "/" + q.etapa.nome), st: [...st].sort(), et: pares.map(q => q.disciplina + "/" + q.etapa.nome + ":" + (q.etapa.ini || "") + ":" + (q.etapa.fim || "") + ":" + (q.disc.escopo || "")), hd: x.hd, cal: x.cal ? x.cal.ev.length + "|" + x.cal.dias.join("") : "", stat: x.status ? x.status.map(z => z.n + z.r + z.c).join(",") : null, pe: (x.pe || []).join(",") } }, JB);
    await c("#newp"); await page.fill("#pn", "Importado"); await page.check('[name="pmodo"][value="excel"]');
    await page.setInputFiles("#pf", fs.readdirSync(SAIDA).filter(f => f.startsWith("out_") && f.endsWith(".xlsx")).map(f => SAIDA + "/" + f)[0]);
    await c("#pc"); await W(800);
    const nid = await ev(() => Object.values(projetos).find(p => p.name === "Importado")?.id);
    ok("Importar", "importar Excel exportado pela ferramenta", !!nid, await page.textContent("#sv"));
    const after = await ev(p => { const x = JSON.parse(projetos[p].j); let n = 0, cm = 0, pr = 0, l = 0, h = 0, nb = 0, lg = 0; const st = new Set(); percorrerBlocos(x, b => { nb++; b.it.forEach(i => { n++; cm += (i.cm || []).length; if (i.pr) pr++; l += (i.l || []).length; if (i.h) h++; st.add(i.s); lg += (i.lg || []).reduce((a, q) => a + q.h, 0) }) }); const pares = listarPares(x); return { n, cm, pr, l, h, nb, lg: Math.round(lg * 3600), ds: pares.map(q => q.disciplina + "/" + q.etapa.nome), st: [...st].sort(), et: pares.map(q => q.disciplina + "/" + q.etapa.nome + ":" + (q.etapa.ini || "") + ":" + (q.etapa.fim || "") + ":" + (q.disc.escopo || "")), hd: x.hd, cal: x.cal ? x.cal.ev.length + "|" + x.cal.dias.join("") : "", stat: x.status ? x.status.map(z => z.n + z.r + z.c).join(",") : null, pe: (x.pe || []).join(",") } }, nid);
    const lgm = p => ev(q => { const x = JSON.parse(projetos[q].j), o = {}; percorrerAtividades(x, (i, c) => { const h = (i.lg || []).reduce((a, l) => a + l.h, 0); if (h) o[c.disciplina + "/" + c.etapa.nome + "/" + c.bloco.n + "/" + i.d] = [Math.round(h * 3600), Math.round(i.u * 3600), JSON.stringify(i.lg)] }); return o }, p);
    fs.writeFileSync(SAIDA + "/roundtrip.json", JSON.stringify({ before, after, lgA: await lgm(JB), lgB: await lgm(nid) }, null, 1));
    ok("Importar", "mesmo nº de atividades", before.n === after.n, before.n + " → " + after.n);
    ok("Importar", "comentários preservados", before.cm === after.cm, before.cm + " → " + after.cm);
    ok("Importar", "prioridades preservadas", before.pr === after.pr, before.pr + " → " + after.pr);
    ok("Importar", "ações e links preservados", before.l === after.l && before.h === after.h, `${before.l}/${before.h} → ${after.l}/${after.h}`);
    ok("Importar", "etapas e datas preservadas", JSON.stringify(before.et) === JSON.stringify(after.et), JSON.stringify(after.et));
    ok("Importar", "status personalizados preservados", JSON.stringify(before.st) === JSON.stringify(after.st), JSON.stringify(before.st) + " → " + JSON.stringify(after.st));
    ok("Importar", "pavimentos vazios e nomes das disciplinas preservados", before.nb === after.nb && JSON.stringify(before.ds) === JSON.stringify(after.ds), before.nb + "→" + after.nb + " " + JSON.stringify(after.ds));
    ok("Importar", "registro de horas por dia preservado", Math.abs(before.lg - after.lg) <= 2, before.lg + "s → " + after.lg + "s");
    ok("Importar", "cores e comportamento dos status preservados", before.stat === after.stat, before.stat + " → " + after.stat);
    ok("Importar", "lista de responsáveis preservada", before.pe === after.pe, before.pe + " → " + after.pe);
    ok("Importar", "horas/dia e calendário preservados", before.hd === after.hd && before.cal === after.cal, `hd ${before.hd}→${after.hd}, eventos ${before.cal}→${after.cal}`);
    await inicio(); await c('[data-ht="hrs"]'); await W(300);
    ok("Importar", "horas importadas não ficam 'sem data'", !(await page.textContent("#hun")).includes("Importado"));
    await ev(() => { const pid = Object.values(projetos).find(p => p.name === "Projeto Branco").id; editarProjetoSalvo(pid, x => { const b = x.etapas[0].disciplinas[0].blocos[0]; b.it.push({ id: "zz1", d: "Antiga", r: "", s: "Pendente", e: 2, u: 1.5, lg: [] }) }); desenharHoras() }); await W(300);
    const hasUn = await page.locator("#ugo").count();
    ok("Horas", "horas sem data aparecem para atribuir", hasUn === 1);
    if (hasUn) { await c("#ugo"); await W(300); ok("Horas", "atribuir horas sem data a um dia", await page.locator("#ugo").count() === 0); }
    await c('[data-ht="proj"]');
    if (fs.existsSync(require("path").join(__dirname, "exemplo-versao-antiga.xlsx"))) {
      await c("#newp"); await page.fill("#pn", "Excel antigo"); await page.check('[name="pmodo"][value="excel"]'); await page.setInputFiles("#pf", require("path").join(__dirname, "exemplo-versao-antiga.xlsx")); await c("#pc"); await W(800);
      ok("Importar", "Excel exportado pela versão anterior continua importando", await ev(() => { const p = Object.values(projetos).find(p => p.name === "Excel antigo"); if (!p) return false; const x = JSON.parse(p.j); return ehFormatoNovo(x) && x.etapas.length >= 1 && x.etapas.some(e => e.disciplinas.some(d => d.nome === "ELT" && d.blocos.some(b => b.it.length))) }));
      await inicio();
    }
    // ida e volta duas vezes: exportar o importado e importar de novo
    const nid2 = await ev(() => Object.values(projetos).find(p => p.name === "Importado").id);
    await c(`[data-open="${nid2}"]`); await abrirDisc("0:0"); await W(300); await ev(() => window.__dl = []); await c("#expx"); await W(600);
    const x2 = await ev(() => window.__dl.find(x => x.filename.endsWith(".xlsx"))); fs.writeFileSync(SAIDA + "/rt2.xlsx", Buffer.from(x2.b, "base64"));
    await inicio();
    await c("#newp"); await page.fill("#pn", "Importado 2"); await page.check('[name="pmodo"][value="excel"]'); await page.setInputFiles("#pf", SAIDA + "/rt2.xlsx"); await c("#pc"); await W(800);
    const a2 = await ev(p => { const x = JSON.parse(projetos[p].j); let n = 0, cm = 0, pr = 0, l = 0, h = 0, nb = 0, lg = 0; const st = new Set(); percorrerBlocos(x, b => { nb++; b.it.forEach(i => { n++; cm += (i.cm || []).length; if (i.pr) pr++; l += (i.l || []).length; if (i.h) h++; st.add(i.s); lg += (i.lg || []).reduce((a, q) => a + q.h, 0) }) }); const pares = listarPares(x); return { n, cm, pr, l, h, nb, lg: Math.round(lg * 3600), ds: pares.map(q => q.disciplina + "/" + q.etapa.nome), st: [...st].sort(), et: pares.map(q => q.disciplina + "/" + q.etapa.nome + ":" + (q.etapa.ini || "") + ":" + (q.etapa.fim || "") + ":" + (q.disc.escopo || "")), hd: x.hd, cal: x.cal ? x.cal.ev.length + "|" + x.cal.dias.join("") : "", stat: x.status ? x.status.map(z => z.n + z.r + z.c).join(",") : null, pe: (x.pe || []).join(",") } }, await ev(() => Object.values(projetos).find(p => p.name === "Importado 2").id));
    ok("Importar", "segunda ida e volta fica idêntica", JSON.stringify({ ...a2, lg: 0 }) === JSON.stringify({ ...after, lg: 0 }) && Math.abs(a2.lg - after.lg) <= 2, JSON.stringify(a2).slice(0, 200));
    await inicio();
  });

  // ================= CÓPIA DE PROJETO =================
  await sec("Projetos", async () => {
    await c("#newp"); await page.fill("#pn", "Cópia JB"); await page.check('[name="pmodo"][value="copia"]'); await sel("#pcp", JB); await c("#pc"); await W(300);
    ok("Projetos", "copiar projeto pelo formulário", await ev(() => projetos[idProjetoAberto].name === "Cópia JB" && JSON.stringify(estado.etapas.map(e => e.nome + ":" + e.disciplinas.map(d => d.nome))) === JSON.stringify(JSON.parse(Object.values(projetos).find(p => p.name === "JBLUE Teste").j).etapas.map(e => e.nome + ":" + e.disciplinas.map(d => d.nome)))));
    ok("Projetos", "copiar projeto zera tempos, status, datas e apontamentos", await ev(() => { let ok = true; percorrerBlocos(estado, b => { if (ehBlocoApontamentos(b.n) && b.it.length) ok = false; b.it.forEach(i => { if (i.u || (i.cm || []).length || comportamentoDo(i.s) !== "pend") ok = false }) }); estado.etapas.forEach(e => { if (e.ini || e.fim) ok = false }); return ok }));
    ok("Projetos", "copiar projeto mantém estimado e responsáveis", await ev(() => { let e = 0, r = 0; percorrerAtividades(estado, i => { e += i.e; if (i.r) r++ }); return e > 0 && r > 0 }));
    await inicio();
  });

  // ================= PENDÊNCIAS DE OUTRA ETAPA =================
  await sec("Pendências", async () => {
    await c(`[data-open="${JB}"]`); await W(200);
    await ev(() => { const e = novaEtapa("AP9", null); e.disciplinas.push(novaDisciplina("ELT", null, null)); estado.etapas.push(e); const b = estado.etapas[0].disciplinas[0].blocos[1]; b.it[0].s = "Concluído"; salvar(); desenharEtapas() });
    const ei = await ev(() => estado.etapas.length - 1);
    await c(`[data-eabr="${ei}"]`); await c("#pend");
    const tot = await ev(() => { const d = estado.etapas[0].disciplinas[0]; return d.blocos.filter(b => !ehBlocoApontamentos(b.n)).reduce((a, b) => a + b.it.filter(i => !estaConcluido(i.s) && !estaSemAcao(i.s)).length, 0) });
    ok("Pendências", "janela lista as pendências da mesma disciplina na outra etapa (sem as concluídas)", await ev(() => $("wd").open && $("pdet").selectedOptions[0].textContent.startsWith("PP · ELT")) && (await page.locator("[data-pdi]").count()) === tot, tot);
    await c('[data-pdtodas="0"]'); await c("[data-pdok]");
    ok("Pendências", "exige marcar ao menos uma", (await page.textContent("#pdmsg")).includes("Marque"));
    const ids = await ev(() => [...document.querySelectorAll("[data-pdi]")].slice(0, 2).map(x => x.dataset.pdi));
    for (const i of ids) await page.check(`[data-pdi="${i}"]`);
    await c("[data-pdok]"); await W(200);
    ok("Pendências", "cria o bloco 'Pendências da etapa PP' com as marcadas (estimado = restante, sem horas usadas)", await ev((ids) => { const b = estado.disc.ELT.find(x => x.n === "Pendências da etapa PP"); if (!b || b.it.length !== 2) return false; return b.it.every((c, k) => { const o = acharAtividade(ids[k]); return c.po === o.id && c.d === o.d && c.u === 0 && !(c.lg || []).length && Math.abs(c.e - Math.max(0, o.e - o.u)) < 1e-9 && comportamentoDo(c.s) === "pend" }) && ehBlocoApontamentos(estado.disc.ELT.at(-1).n) }, ids));
    ok("Pendências", "originais na outra etapa não mudam", await ev((ids) => ids.every(i => !!acharAtividade(i)), ids));
    await c("#pend");
    ok("Pendências", "as já puxadas não aparecem de novo", (await page.locator("[data-pdi]").count()) === tot - 2);
    await c("[data-dclose]");
    await c("#back"); await c(`[data-edel="${ei}"]`); await yes(); await inicio();
  });

  // ================= GOOGLE AGENDA (conector simulado) =================
  await sec("Agenda Google", async () => {
    await inicio();
    ok("Agenda Google", "botão na tela inicial", (await page.textContent("#gcal")).includes("Vincular Google Agenda"));
    await ev(() => localStorage.setItem("__mcpmodo", "nc"));
    await c("#gcal"); await c("[data-gcon]"); await page.waitForTimeout(250);
    ok("Agenda Google", "sem conector: explica como conectar e não vincula", await ev(() => !agenda.ligado && agenda.erro.includes("Conectores")));
    await ev(() => localStorage.setItem("__mcpmodo", ""));
    await c("[data-gcon]"); await page.waitForTimeout(250);
    ok("Agenda Google", "vincula com o conector", await ev(() => agenda.ligado && $("gcal").textContent.includes("vinculada")));
    await page.keyboard.press("Escape");
    const pid = await ev(() => Object.keys(projetos)[0]), nome = await ev((p) => projetos[p].name, pid);
    const n0 = await ev(() => window.__cal.length);
    await ev((p) => agendaSessao(p, Date.now() - 2 * 36e5, Date.now()), pid); await page.waitForTimeout(250);
    const evs = await ev(() => window.__cal);
    const e = evs[evs.length - 1] || {};
    ok("Agenda Google", "envia evento particular só com o projeto", evs.length === n0 + 1 && e.summary === "⏱ " + nome && e.visibility === "private" && e.calendar_id === "primary" && /T\d\d:\d\d:\d\d[+-]\d\d:\d\d$/.test(e.start.dateTime), JSON.stringify(e));
    await ev((p) => agendaSessao(p, Date.now() - 30000, Date.now()), pid); await page.waitForTimeout(150);
    ok("Agenda Google", "usos de menos de 1 minuto não vão", await ev((n) => window.__cal.length === n, n0 + 1));
    await ev(() => localStorage.setItem("__mcpmodo", "falha"));
    await ev((p) => agendaSessao(p, Date.now() - 6e5, Date.now()), pid); await page.waitForTimeout(250);
    ok("Agenda Google", "falha incerta não reenvia sozinha", await ev(() => agenda.falhas.length === 1 && !agenda.pendentes.length));
    await ev(() => localStorage.setItem("__mcpmodo", ""));
    await c("#gcal"); await c("[data-gcre]"); await page.waitForTimeout(250);
    ok("Agenda Google", "Reenviar manda o que falhou", await ev((n) => !agenda.falhas.length && window.__cal.length === n, n0 + 2));
    await ev(() => localStorage.setItem("__mcpmodo", "nc"));
    await ev((p) => agendaSessao(p, Date.now() - 6e5, Date.now()), pid); await page.waitForTimeout(250);
    ok("Agenda Google", "conector desconectado: fica na fila", await ev(() => agenda.pendentes.length === 1));
    await ev(() => localStorage.setItem("__mcpmodo", ""));
    await ev(() => enviarPendentesAgenda()); await page.waitForTimeout(250);
    ok("Agenda Google", "fila enviada quando volta", await ev((n) => !agenda.pendentes.length && window.__cal.length === n, n0 + 3));
    await c("[data-gcoff]");
    await ev((p) => agendaSessao(p, Date.now() - 6e5, Date.now()), pid); await page.waitForTimeout(150);
    ok("Agenda Google", "desvinculado: para de enviar", await ev((n) => !agenda.ligado && window.__cal.length === n, n0 + 3));
    await page.keyboard.press("Escape");
  });

  // ================= PERSISTÊNCIA =================
  await sec("Salvar", async () => {
    const n = await ev(() => Object.keys(projetos).length);
    ok("Salvar", "aviso 'Salvo na sua conta'", (await page.textContent("#cloud")).includes("Salvo na sua conta"));
    await page.reload(); await W(800);
    ok("Salvar", "dados continuam após recarregar", await ev(k => Object.keys(projetos).length === k, n));
    await ev(() => localStorage.setItem("__nodb", "1")); await page.reload(); await W(600);
    ok("Salvar", "sem conta: aviso de dados só no navegador", (await page.textContent("#cloud")).includes("só neste navegador"));
    ok("Salvar", "sem conta: carrega cópia local", await ev(k => Object.keys(projetos).length === k, n));
    await ev(() => localStorage.removeItem("__nodb")); await page.reload(); await W(600);
  });

  // ================= CASOS-LIMITE =================
  await sec("Casos-limite", async () => {
    await c(`[data-open="${JB}"]`); await W(200);
    await ev(() => { const c = cadastros.find(x => x.nome === "PP"); c.disciplinas.push({ id: "c-tmp", nome: "Temporária", sigla: "TMP", atividades: ["A", "B"] }); desenharEtapas() });
    await c('[data-eabr="0"]'); await c("[data-dadd]"); await sel("#ddsel", "c-tmp"); await c("[data-ddok]"); await W(200);
    const k = await ev(() => "0:" + estado.etapas[0].disciplinas.findIndex(d => d.nome === "TMP"));
    await abrirDisc(k); await W(200);
    const id = await firstIt(0); await c(`[data-run="${id}"]`);
    await c("[data-ddel]"); await yes();
    await abrirDisc("0:0"); await W(200);
    const o = await firstIt(1); await c(`[data-run="${o}"]`); await W(200);
    const started = await ev(i => !!(estado.run && estado.run.id === i), o);
    ok("Casos-limite", "excluir disciplina com cronômetro rodando não trava os cronômetros", started, started ? "" : "cronômetro fantasma: " + await page.textContent("#dm"));
    if (await ev(() => $("dlg").open)) await c("#dn");
    await ev(() => { estado.run = null; salvar(); desenhar() });
    // Excluir atividade com cronômetro: tempo perdido?
    const z = await firstIt(2), u0 = (await it(z)).u; await c(`[data-run="${z}"]`); await ev(() => { estado.run.t0 -= 1800e3 });
    await c(`[data-del="${z}"]`); ok("Casos-limite", "excluir atividade com cronômetro rodando libera o cronômetro", await ev(() => !estado.run));
    // descrição com aspas/HTML
    const y = await firstIt(3); await setv(`[data-f="d"][data-i="${y}"]`, 'Teste <b>"aspas"</b> & <img src=x onerror=alert(1)>');
    ok("Casos-limite", "texto com HTML/aspas não quebra a página", (await it(y)).d.includes("<img") && await page.locator("img").count() === 0 && (await page.inputValue(`[data-f="d"][data-i="${y}"]`)).includes('"aspas"'));
    // estimado inválido
    await setv(`[data-f="e"][data-i="${y}"]`, "abc"); ok("Casos-limite", "estimado inválido vira 00:00 (sem erro)", (await it(y)).e === 0);
    await setv(`[data-f="u"][data-i="${y}"]`, "-3"); ok("Casos-limite", "usado negativo é bloqueado", (await it(y)).u === 0);
    // data inválida
    await setv(`[data-f="c"][data-i="${y}"]`, "0201-01-01"); ok("Casos-limite", "data com ano absurdo é ignorada", (await it(y)).c !== "0201-01-01");
  });

  const errs = await ev(() => window.__errs);
  ok("Geral", "nenhum erro de JavaScript durante os testes", !errs.length && !(page.__perr || []).length, JSON.stringify([...errs, ...(page.__perr || [])]));
  fs.writeFileSync(SAIDA + "/results.json", JSON.stringify(R, null, 1));
  const f = R.filter(r => !r.pass); console.log(`\n${R.length - f.length}/${R.length} passaram; ${f.length} falharam`);
  process.exit(0);
})().catch(e => { console.error("FATAL", e); fs.writeFileSync(SAIDA + "/results.json", JSON.stringify(R, null, 1)); process.exit(1) });
