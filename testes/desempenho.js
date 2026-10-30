// Tempo de uma edição completa (evento + atualização + layout) numa etapa grande
const { open, criarProjetoModelo } = require("./ambiente");
(async () => {
  const { page } = await open();
  const ev = (f, a) => page.evaluate(f, a), W = ms => page.waitForTimeout(ms || 300);
  await criarProjetoModelo(page, "Grande", "jblue"); await W();
  await page.click('[data-eabr="0"]'); await W();
  await ev(() => { const d = estado.disc.ELT, base = JSON.parse(JSON.stringify(d.filter(b => !ehBlocoApontamentos(b.n)))); for (let r = 0; r < 6; r++) base.forEach(b => d.push({ n: b.n + " " + r, it: b.it.map(i => ({ ...i, id: novoIdAtividade() })) })); desenhar(); salvar(); });
  await W(500);
  const res = [];
  for (const [nome, sel, val] of [["estimado", "e", "3:00"], ["usado", "u", "1:00"], ["descrição", "d", "Texto novo"]]) {
    const vals = [];
    for (let k = 0; k < 5; k++) {
      const id = await ev(k => estado.disc.ELT[3 + k].it[0].id, k);
      vals.push(await ev(async ([id, sel, val]) => {
        const el = document.querySelector(`[data-f="${sel}"][data-i="${id}"]`); el.value = val + "";
        const a = performance.now(); el.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise(r => setTimeout(r, 0)); document.body.offsetHeight;
        return performance.now() - a;
      }, [id, sel, val]));
      await W(150);
    }
    vals.sort((a, b) => a - b); res.push(nome + ": " + vals[2].toFixed(0) + " ms");
  }
  const cm = [];
  for (let k = 0; k < 5; k++) {
    const id = await ev(k => estado.disc.ELT[3 + k].it[1].id, k);
    cm.push(await ev(async id => { const a = performance.now(); document.querySelector(`[data-cm="${id}"]`).click(); await new Promise(r => setTimeout(r, 0)); document.body.offsetHeight; return performance.now() - a; }, id));
    await W(150);
  }
  cm.sort((a, b) => a - b); res.push("abrir comentários: " + cm[2].toFixed(0) + " ms");
  console.log(await ev(() => atividadesDaDisciplina(estado.tab).length), "atividades na tela | mediana de 5 edições →", res.join(" | "));
  process.exit(0);
})();
