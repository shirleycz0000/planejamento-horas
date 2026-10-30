// Histórico estimado × real

const chaveHistorico = (t) =>
    normalizar(
      String(t || "")
        .replace(/^\s*(\[[^\]]*\]\s*)+/, "")
        .replace(/^\s*\d{2,6}\s+/, "")
        .replace(/\btipo\s*\d+\b/gi, " ")
        .replace(/\([^)]*\)/g, " ")
        .replace(/[:;,\-–|]+/g, " "),
    )
      .replace(/\s+/g, " ")
      .trim(),
  chavePavimentoHistorico = (n) =>
    normalizar(
      String(n || "")
        .replace(/\([^)]*\)/g, " ")
        .replace(/\d+/g, " ")
        .replace(/[º°]/g, ""),
    )
      .replace(/\s+/g, " ")
      .trim() || normalizar(n);

function montarHistorico() {
  const A = new Map(),
    B = new Map(),
    DS = new Map(), // por disciplina
    ET = new Map(), // por etapa
    tot = { n: 0, E: 0, U: 0 };
  const proj = (x, rl) =>
    percorrerBlocos(x, (b, c) => {
      if (ehBlocoApontamentos(b.n)) return;
      let be = 0,
        bu = 0,
        bn = 0;
      b.it.forEach((i) => {
        if (rl(i.s) !== "ok" || !(i.e > 0) || !(i.u > 0)) return;
        const k = chaveHistorico(i.d);
        if (!k) return;
        const a = A.get(k) || { n: 0, E: 0, U: 0, ex: i.d };
        a.n++;
        a.E += i.e;
        a.U += i.u;
        A.set(k, a);
        const kd = normalizar(c.disciplina || "—"),
          ds = DS.get(kd) || { n: 0, E: 0, U: 0, ex: c.disciplina || "—" };
        ds.n++;
        ds.E += i.e;
        ds.U += i.u;
        DS.set(kd, ds);
        const ke = normalizar(c.etapa.nome || "—"),
          et = ET.get(ke) || { n: 0, E: 0, U: 0, ex: c.etapa.nome || "—" };
        et.n++;
        et.E += i.e;
        et.U += i.u;
        ET.set(ke, et);
        be += i.e;
        bu += i.u;
        bn++;
        tot.n++;
        tot.E += i.e;
        tot.U += i.u;
      });
      if (bn) {
        const k = chavePavimentoHistorico(b.n),
          a = B.get(k) || { n: 0, E: 0, U: 0, ex: b.n };
        a.n++;
        a.E += be;
        a.U += bu;
        B.set(k, a);
      }
    });
  Object.values(projetos).forEach((pj) => {
    if (pj.id === idProjetoAberto) return;
    try {
      const x = JSON.parse(pj.j),
        stt = Array.isArray(x.status) && x.status.length ? x.status : statusPadrao(),
        rl = (n) => {
          const f = stt.find((q) => q.n === n);
          return f ? f.r : "pend";
        };
      proj(x, rl);
    } catch (e) {}
  });
  if (idProjetoAberto && estado.etapas) proj(estado, comportamentoDo);
  return { A, B, DS, ET, tot };
}

function obterHistorico() {
  if (!cacheHistorico || historicoDesatualizado || Date.now() - horaCacheHistorico > 20000) {
    cacheHistorico = montarHistorico();
    horaCacheHistorico = Date.now();
    historicoDesatualizado = false;
  }
  return cacheHistorico;
}

const desvioPercentual = (u, e) => (e ? (u >= e ? "+" : "") + Math.round((u / e - 1) * 100) + "%" : "—");

function dicaHistorico(i) {
  if (!i.d) return "";
  const a = obterHistorico().A.get(chaveHistorico(i.d));
  if (!a || a.n < 2) return "";
  return (
    "Histórico (" +
    a.n +
    " atividades parecidas concluídas): estimado médio " +
    fmtHoras(a.E / a.n) +
    ", real médio " +
    fmtHoras(a.U / a.n) +
    " (" +
    desvioPercentual(a.U, a.E) +
    ")"
  );
}

function janelaHistorico() {
  const h = obterHistorico(),
    A = [...h.A.values()]
      .filter((a) => a.n >= 2)
      .sort((x, y) => y.n - x.n || Math.abs(y.U / y.E - 1) - Math.abs(x.U / x.E - 1))
      .slice(0, 40),
    B = [...h.B.values()].sort((x, y) => y.n - x.n).slice(0, 30),
    DS = [...h.DS.values()].sort((x, y) => y.U - x.U),
    ET = [...h.ET.values()].sort((x, y) => y.U - x.U);
  const tabelaSoma = (titulo, coluna, lista) =>
    `<b>${titulo}</b>` +
    `<table class="ett"><thead><tr><th>${coluna}</th><th class="tn">Atividades</th><th class="tn">Estimado</th>` +
    `<th class="tn">Real</th><th class="tn">Desvio</th></tr></thead><tbody>${
      lista
        .map(
          (a) =>
            `<tr><td>${escaparHtml(a.ex)}</td><td class="tn">${a.n}</td><td class="tn">${fmtHoras(a.E)}</td><td class="tn">${fmtHoras(a.U)}</td>` +
            `<td class="tn" style="color:var(--${a.U > a.E * 1.1 ? "bad" : a.U < a.E * 0.9 ? "ok" : "mut"})">${desvioPercentual(a.U, a.E)}</td></tr>`,
        )
        .join("") || '<tr><td colspan="5"><span class="note">Sem dados.</span></td></tr>'
    }</tbody></table>`;
  const row = (a, m) =>
    `<tr><td>${escaparHtml(a.ex.length > 80 ? a.ex.slice(0, 78) + "…" : a.ex)}</td>` +
    `<td class="tn">${a.n}</td><td class="tn">${fmtHoras(a.E / a.n)}</td><td class="tn">${fmtHoras(a.U / a.n)}</td>` +
    `<td class="tn" style="color:var(--${a.U > a.E * 1.1 ? "bad" : a.U < a.E * 0.9 ? "ok" : "mut"})">${desvioPercentual(a.U, a.E)}</td></tr>`;
  return [
    "Histórico: estimado × real",
    `<p class="note">Compara as horas estimadas com as horas realmente usadas nas atividades <b>concluídas</b> de todos os seus projetos. Atividades de mesmo tipo são agrupadas pela descrição (sem números de pavimento e códigos). Nas telas de atividades, o campo <b>Estimado</b> fica sublinhado quando existe histórico, e o texto aparece ao passar o mouse.</p>${
      h.tot.n
        ? `<div class="sum"><div><b>${h.tot.n}</b><span>atividades concluídas com tempo</span></div>` +
          `<div><b>${fmtHoras(h.tot.E)}</b><span>estimado</span></div><div><b>${fmtHoras(h.tot.U)}</b>` +
          `<span>realmente usado</span></div><div><b>${desvioPercentual(h.tot.U, h.tot.E)}</b>` +
          `<span>desvio geral</span></div></div>`
        : '<p class="note">Ainda não há atividades concluídas com tempo usado. Conclua atividades registrando o tempo para formar o histórico.</p>'
    }` +
      tabelaSoma("Por etapa (soma das atividades concluídas)", "Etapa", ET) +
      tabelaSoma("Por disciplina (soma das atividades concluídas)", "Disciplina", DS) +
      `<b>Atividades parecidas (2 ou mais ocorrências)</b>` +
      `<table class="ett"><thead><tr><th>Atividade (exemplo)</th><th class="tn">Vezes</th>` +
      `<th class="tn">Estimado médio</th><th class="tn">Real médio</th><th class="tn">Desvio</th></tr></thead>` +
      `<tbody>${A.map((a) => row(a)).join("") || '<tr><td colspan="5"><span class="note">Nenhum grupo com 2 ou mais ocorrências ainda.</span></td></tr>'}</tbody></table>` +
      `<b>Pavimentos (soma das atividades concluídas)</b><table class="ett"><thead>` +
      `<tr><th>Pavimento (exemplo)</th><th class="tn">Ocorrências</th><th class="tn">Estimado médio</th>` +
      `<th class="tn">Real médio</th><th class="tn">Desvio</th></tr></thead><tbody>${B.map((a) => row(a)).join("") || '<tr><td colspan="5"><span class="note">Sem dados.</span></td></tr>'}</tbody></table>`,
  ];
}
