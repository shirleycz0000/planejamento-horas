// Confere que a atualização parcial deixa a tela igual a um redesenho completo.
const { open, criarProjetoModelo } = require("./ambiente");
(async () => {
  const { page } = await open();
  const ev = (f, a) => page.evaluate(f, a), W = ms => page.waitForTimeout(ms || 250);
  let ok = 0, falhas = [];
  await criarProjetoModelo(page, "P", "jblue"); await W();
  await page.click('[data-eabr="0"]'); await W();
  const tela = () => ev(() => { document.querySelectorAll("[data-liveu]").forEach(e => e.setAttribute("value", e.value)); return ["bl", "gt", "al"].map(i => document.getElementById(i).innerHTML).join("\n@@\n"); });
  async function conferir(nome) {
    await W();
    const parcial = await tela();
    await ev(() => { const f = window.__full; desenhar(); window.__full = f; }); await W(50);
    const completo = await tela();
    if (parcial === completo) ok++; else {
      let i = 0; while (parcial[i] === completo[i]) i++;
      falhas.push(nome + ": difere em …" + parcial.slice(Math.max(0, i - 60), i + 80) + "\n   vs …" + completo.slice(Math.max(0, i - 60), i + 80));
    }
  }
  const sv = async (sel, v) => { const l = page.locator(sel).first(); await l.fill(v); await l.dispatchEvent("change"); };
  const id = await ev(() => estado.disc.ELT[1].it[1].id), ap = await ev(() => { const b = estado.disc.ELT.find(b => ehBlocoApontamentos(b.n)); return b.it[0].id; });
  // conta redesenhos completos
  await ev(() => { window.__full = 0; const o = window.desenharEtapa; window.desenharEtapa = function () { window.__full++; return o.apply(this, arguments); }; });
  await sv(`[data-f="e"][data-i="${id}"]`, "2:15"); await conferir("estimado");
  await sv(`[data-f="u"][data-i="${id}"]`, "3:00"); await conferir("usado acima do estimado (alerta)");
  await sv(`[data-f="d"][data-i="${id}"]`, "Descrição nova"); await conferir("descrição");
  await page.selectOption(`[data-f="r"][data-i="${id}"]`, "Milene"); await conferir("responsável");
  await page.selectOption(`[data-f="s"][data-i="${id}"]`, "Concluído"); await conferir("status concluído");
  await page.locator(`[data-done="${id}"]`).uncheck(); await conferir("desmarcar concluído");
  await sv(`[data-f="c"][data-i="${id}"]`, "2026-10-10"); await page.mouse.click(5, 5); await conferir("data de conclusão");
  await page.click(`[data-cm="${id}"]`); await conferir("abrir detalhes");
  await page.selectOption(`[data-f="pr"][data-i="${id}"]`, "a"); await conferir("prioridade");
  await page.fill(`[data-cmn="${id}"]`, "oi"); await page.press(`[data-cmn="${id}"]`, "Enter"); await conferir("novo comentário");
  ok += (await ev(i => document.activeElement && document.activeElement.dataset.cmn === i, id)) ? 1 : (falhas.push("foco não voltou ao campo de comentário"), 0);
  await sv(`[data-cmt="${id}:0"]`, "editado"); await conferir("editar comentário");
  await page.click(`[data-cmdel="${id}:0"]`); await conferir("excluir comentário");
  await page.click(`[data-cmclose="${id}"]`); await conferir("fechar detalhes");
  await sv(`[data-f="ap"][data-i="${ap}"]`, "Teste https://x.construflow.com.br/a?issueId=9"); await conferir("link do apontamento");
  await page.click(`[data-ed="${ap}"]`); await W();
  ok += (await ev(i => document.activeElement && document.activeElement.dataset.i === i, ap)) ? 1 : (falhas.push("foco não foi para a edição do link"), 0);
  await page.mouse.click(5, 5); await W(400); await conferir("sair da edição do link");
  await page.fill(`[data-cn="${ap}"]`, "Ação 1"); await page.press(`[data-cn="${ap}"]`, "Enter"); await conferir("nova ação");
  await page.locator(`[data-ck="${ap}:0"]`).check(); await conferir("marcar ação");
  await page.click(`[data-cdel="${ap}:0"]`); await conferir("excluir ação");
  const full = await ev(() => window.__full);
  // cronômetro: totais a cada 5 s, sem redesenho completo
  await page.click(`[data-run="${id}"]`); await W(200);
  await ev(() => { estado.run.t0 -= 2 * 3600e3; window.__full = 0; });
  await W(5600);
  const h = await ev(() => ({ full: window.__full, sum: document.querySelector("#gt tr.cur td:nth-child(3)").textContent }));
  await conferir("totais com cronômetro rodando");
  console.log(`atualização parcial = redesenho completo: ${ok} conferências ok, ${falhas.length} falhas`);
  console.log(`redesenhos completos durante ${19} edições: ${full}`);
  console.log(`cronômetro: redesenhos completos em 5,6 s: ${h.full}; total "Usado" atualizado para ${h.sum}`);
  falhas.forEach(f => console.log("FALHA " + f));
  console.log("erros JS:", JSON.stringify(await ev(() => window.__errs)), JSON.stringify(page.__perr || []));
  process.exit(0);
})();
