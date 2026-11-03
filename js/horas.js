// Aba Horas trabalhadas (dia, semana, mês e lançamentos)

let abaInicio = "proj",
  periodoHoras = "d",
  dataHoras = "",
  projetoHoras = "",
  projetosRecolhidosHoras = new Set();

function intervaloPeriodo() {
  const d = dataHoras || hoje();
  if (periodoHoras === "d") return [d, d];
  if (periodoHoras === "w") {
    const wd = (lerDataISO(d).getDay() + 6) % 7,
      a = somarDias(d, -wd);
    return [a, somarDias(a, 6)];
  }
  const a = d.slice(0, 8) + "01",
    m = lerDataISO(a);
  m.setMonth(m.getMonth() + 1);
  m.setDate(0);
  return [a, dataISO(m)];
}

function tituloPeriodo(a, b) {
  if (periodoHoras === "d") {
    return DIAS_SEMANA[lerDataISO(a).getDay()] + ", " + dataBR(a);
  }
  if (periodoHoras === "w") return "Semana de " + dataBR(a) + " a " + dataBR(b) + " (segunda a domingo)";
  const d = lerDataISO(a);
  return NOMES_MESES[d.getMonth()] + " de " + d.getFullYear();
}

function dadosHoras() {
  const [a, b] = intervaloPeriodo(),
    G = new Map(),
    D = new Map();
  paraCadaAtividade((pj, e, d, bl, i) => {
    if (projetoHoras && pj.id !== projetoHoras) return;
    (i.lg || []).forEach((l) => {
      if (l.d < a || l.d > b || !(l.h > 0)) return;
      D.set(l.d, (D.get(l.d) || 0) + l.h);
      const g = G.get(pj.id) || { p: pj.name, tot: 0, acts: new Map() };
      g.tot += l.h;
      const k = e.nome + "|" + d + "|" + bl.n + "|" + i.id,
        r = g.acts.get(k) || { d, e: e.nome, b: bl.n, a: i.d || "(sem nome)", loc: d + " › " + bl.n, h: 0 };
      r.h += l.h;
      g.acts.set(k, r);
      G.set(pj.id, g);
    });
  });
  const lr = cronometroAtivo();
  if (lr && (!projetoHoras || lr.pid === projetoHoras)) {
    const lab = lr.lab || descreverAtividade(lr.pid, lr.id);
    if (lab) {
      const tmp = { lg: [] };
      registrarIntervalo(tmp, (Date.now() - lr.t0) / 36e5, lr.t0, Date.now());
      tmp.lg.forEach((l) => {
        if (l.d < a || l.d > b || !(l.h > 0)) return;
        D.set(l.d, (D.get(l.d) || 0) + l.h);
        const g = G.get(lr.pid) || { p: lab.p, tot: 0, acts: new Map() };
        g.tot += l.h;
        const r = g.acts.get(lab.key) || { d: lab.d, e: lab.e, b: lab.bn, a: lab.a, loc: lab.loc, h: 0 };
        r.h += l.h;
        g.acts.set(lab.key, r);
        G.set(lr.pid, g);
      });
    }
  }
  return { a, b, G, D };
}

function desenharHoras() {
  const hp = $("hpj"),
    kv = projetoHoras;
  hp.innerHTML =
    '<option value="">Todos os projetos</option>' +
    Object.values(projetos)
      .sort((x, y) => x.name.localeCompare(y.name))
      .map((p) => `<option value="${p.id}">${escaparHtml(p.name)}</option>`)
      .join("");
  hp.value = projetos[kv] ? kv : "";
  projetoHoras = hp.value;
  if (!dataHoras) dataHoras = hoje();
  $("hdt").value = dataHoras;
  document
    .querySelectorAll("#hper button")
    .forEach((x) => x.classList.toggle("on", x.dataset.hp === periodoHoras));
  const { a, b, G, D } = dadosHoras(),
    groups = [...G.entries()].sort((x, y) => y[1].tot - x[1].tot),
    tot = groups.reduce((q, [, g]) => q + g.tot, 0),
    nact = groups.reduce((q, [, g]) => q + g.acts.size, 0),
    ndays = D.size;
  $("hh2").textContent = tituloPeriodo(a, b);
  $("hsm").innerHTML =
    `<div><b>${fmtHoras(tot)}</b><span>Total do período</span></div><div><b>${groups.length}</b>` +
    `<span>projeto${groups.length === 1 ? "" : "s"}</span></div><div><b>${nact}</b>` +
    `<span>atividade${nact === 1 ? "" : "s"} com horas</span></div>${periodoHoras === "d" ? "" : `<div><b>${ndays ? fmtHoras(tot / ndays) : "00:00"}</b><span>média por dia trabalhado (${ndays} dia${ndays === 1 ? "" : "s"})</span></div>`}`;
  let chips = "";
  if (periodoHoras !== "d") {
    const days = [];
    let x = a,
      g = 0;
    while (x <= b && g++ < 40) {
      days.push(x);
      x = somarDias(x, 1);
    }
    chips = days
      .filter((d) => periodoHoras === "w" || D.has(d))
      .map(
        (d) =>
          `<span class="hc${D.has(d) ? "" : " z"}">${DIAS_ABREV[lerDataISO(d).getDay()]} ${d.slice(8)}/${d.slice(5, 7)}: <b>${fmtHoras(D.get(d) || 0)}</b></span>`,
      )
      .join("");
  }
  $("hdc").innerHTML =
    (chips ? `<div class="note" style="margin:0 0 6px">Horas por dia</div>${chips}` : "") +
    (cronometroAtivo()
      ? '<div class="note" style="margin:4px 0 0">⏱ Inclui o tempo do cronômetro em andamento até agora.</div>'
      : "");
  let rows = "";
  groups.forEach(([pid, g]) => {
    const col = projetosRecolhidosHoras.has(pid);
    rows +=
      `<tr class="grp"><td class="gh"><button class="tg" data-hg="${pid}" aria-expanded="${!col}" title="${col ? "Mostrar as atividades" : "Recolher as atividades"}">${col ? "▸" : "▾"}</button>${escaparHtml(g.p)}</td>` +
      `<td></td><td class="note">${g.acts.size} atividade${g.acts.size === 1 ? "" : "s"}</td>` +
      `<td class="tn">${fmtHoras(g.tot)}</td></tr>`;
    if (!col)
      [...g.acts.values()]
        .sort((x, y) => y.h - x.h)
        .forEach((r) => {
          rows +=
            `<tr class="sub"><td></td><td>${escaparHtml(r.d ? r.e + " · " + r.d : r.e)}</td><td>${escaparHtml(r.a)} <span class="note" style="margin:0">· ${escaparHtml(r.b || r.loc)}</span></td>` +
            `<td class="tn">${fmtHoras(r.h)}</td></tr>`;
        });
  });
  $("htab").innerHTML =
    '<thead><tr><th>Projeto</th><th>Etapa · Disciplina</th><th>Atividade · Bloco</th><th class="tn">Horas</th></tr></thead><tbody>' +
    (rows ||
      '<tr><td colspan="4"><span class="note">Nenhuma hora registrada neste período.</span></td></tr>') +
    (rows
      ? `<tr class="tt"><td>Total do período</td><td></td><td></td><td class="tn">${fmtHoras(tot)}</td></tr>`
      : "") +
    "</tbody>";
  const lp = $("lpj"),
    kl = lp.value;
  lp.innerHTML = Object.values(projetos)
    .sort((x, y) => x.name.localeCompare(y.name))
    .map((p) => `<option value="${p.id}">${escaparHtml(p.name)}</option>`)
    .join("");
  if (projetos[kl]) lp.value = kl;
  if (!$("ldt").value) $("ldt").value = hoje();
  preencherAtividadesLancamento();
  const un = [];
  paraCadaAtividade((pj, e, d, bl, i) => {
    const h = (i.u || 0) - (i.lg || []).reduce((q, l) => q + l.h, 0);
    if (h > 1 / 120) un.push({ pj, e, d, bl, i, h });
  });
  const ut = un.reduce((q, r) => q + r.h, 0);
  desenharAgenda();
  $("hun").innerHTML = un.length
    ? `<section class="geral" style="margin-top:12px"><h2>Horas sem data (${fmtHoras(ut)} em ${un.length} atividade${un.length === 1 ? "" : "s"})</h2>` +
      `<div style="padding:10px 12px"><p class="note" style="margin:0 0 8px">São horas usadas antes do registro por dia. Elas não aparecem nos totais por dia, semana ou mês. Escolha uma data para atribuí-las; o tempo usado das atividades não muda.</p>` +
      `<div class="df" style="justify-content:flex-start;flex-wrap:wrap"><input type="date" id="udt" value="${hoje()}" aria-label="Data">` +
      `<button class="p" id="ugo">Atribuir todas à data</button></div><div class="sc" style="margin-top:8px">` +
      `<table class="ett" style="min-width:0"><tbody>${un
        .sort((x, y) => y.h - x.h)
        .slice(0, 30)
        .map(
          (r) =>
            `<tr><td>${escaparHtml(r.pj.name)} › ${escaparHtml(r.e.nome)} › ${escaparHtml(r.i.d || "")}</td><td class="tn">${fmtHoras(r.h)}</td></tr>`,
        )
        .join(
          "",
        )}</tbody></table></div>${un.length > 30 ? `<p class="note">… e mais ${un.length - 30} atividade(s).</p>` : ""}</div></section>`
    : "";
}

// ---------- Agenda: blocos de horário do período ----------
// Cada sessão do cronômetro (ss) vira um bloco "08:00–10:00 · Projeto" (só o projeto, sem
// etapa nem atividade). Sessões seguidas do mesmo projeto (até 6 min de intervalo, sem outro projeto no meio) se juntam.
// Horas lançadas à mão não têm horário e ficam de fora.

// Pausa máxima entre dois usos do mesmo projeto para virarem um bloco só (aqui e no Google Agenda)
const JUNTAR_AGENDA_MS = 6 * 60000;

function blocosAgenda() {
  const [a, b] = intervaloPeriodo(),
    ss = [];
  const add = (pid, p, e, d, nome, t0, t1, rodando) => {
    const dia = diaDe(t0);
    if (dia < a || dia > b || !(t1 > t0)) return;
    ss.push({ pid, p, e, d, nome, t0, t1, rodando });
  };
  paraCadaAtividade((pj, e, d, bl, i) => {
    if (projetoHoras && pj.id !== projetoHoras) return;
    (i.ss || []).forEach(([t0, t1]) => add(pj.id, pj.name, e.nome, d, i.d || "(sem nome)", t0, t1, false));
  });
  const lr = cronometroAtivo();
  if (lr && (!projetoHoras || lr.pid === projetoHoras)) {
    const lab = lr.lab || descreverAtividade(lr.pid, lr.id);
    if (lab) add(lr.pid, lab.p, lab.e, lab.d, lab.a, lr.t0, Date.now(), true);
  }
  ss.sort((x, y) => x.t0 - y.t0);
  const blocos = [];
  ss.forEach((s) => {
    const u = blocos[blocos.length - 1],
      chave = s.pid;
    // a sessão em andamento fica num bloco à parte (só vai para a agenda depois de pausar)
    if (
      u &&
      !u.rodando &&
      !s.rodando &&
      u.chave === chave &&
      diaDe(u.t0) === diaDe(s.t0) &&
      s.t0 - u.t1 <= JUNTAR_AGENDA_MS
    )
      u.t1 = Math.max(u.t1, s.t1);
    else
      blocos.push({
        chave,
        pid: s.pid,
        p: s.p,
        e: s.e,
        d: s.d,
        t0: s.t0,
        t1: s.t1,
        rodando: s.rodando,
        acts: new Map(),
      });
    const bl = blocos[blocos.length - 1];
    bl.acts.set(s.nome, (bl.acts.get(s.nome) || 0) + (s.t1 - s.t0) / 36e5);
  });
  return blocos;
}

const horaMin = (ms) => {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
};
const tituloBloco = (bl) => "⏱ " + bl.p;

function desenharAgenda() {
  const bls = blocosAgenda(),
    salvos = bls.filter((b) => !b.rodando);
  let ultimoDia = "";
  $("hag").innerHTML =
    `<section class="geral" style="margin-top:12px" aria-label="Agenda do período"><h2>Agenda do período · blocos de horário</h2>` +
    `<div style="padding:10px 12px;display:grid;gap:10px">` +
    `<p class="note" style="margin:0">Vale para a ferramenta inteira: conforme você usa o cronômetro, cada período vira um bloco na agenda só com o <b>nome do projeto</b> (trocou de projeto, começa outro bloco). Horas lançadas à mão (sem horário) ficam de fora.</p>` +
    (bls.length
      ? `<div class="sc"><table class="ett" style="min-width:0"><thead><tr><th>Dia</th><th>Horário</th><th>Projeto</th><th class="tn">Duração</th></tr></thead><tbody>${bls
          .map((bl) => {
            const dia = diaDe(bl.t0),
              mostrarDia = dia !== ultimoDia;
            ultimoDia = dia;
            return (
              `<tr><td>${mostrarDia ? dataBR(dia) : ""}</td><td style="white-space:nowrap">${horaMin(bl.t0)}–${bl.rodando ? "agora" : horaMin(bl.t1)}${bl.rodando ? ' <span class="stc acc">rodando</span>' : ""}</td>` +
              `<td>${escaparHtml(bl.p)}</td>` +
              `<td class="tn">${fmtHoras((bl.t1 - bl.t0) / 36e5)}</td></tr>`
            );
          })
          .join("")}</tbody></table></div>`
      : `<p class="note" style="margin:0">Nenhum bloco com horário neste período. Use o ▶ cronômetro nas atividades para registrar início e fim.</p>`) +
    `<div class="df" style="justify-content:flex-start;flex-wrap:wrap">` +
    `<button id="hagcsv"${salvos.length ? "" : " disabled"} title="Arquivo para importar no Google Agenda (ou Outlook): Configurações → Importar">Baixar para importar na agenda (.csv)</button>` +
    `<button id="hagvinc">${agenda.ligado ? "📅 Google Agenda vinculado" : "📅 Vincular Google Agenda"}</button></div>` +
    `</div></section>`;
}

// Arquivo .csv no formato de importação do Google Agenda (também abre no Outlook)
acao("#hagcsv", async () => {
  const bls = blocosAgenda().filter((b) => !b.rodando);
  if (!bls.length) return;
  const q = (v) => '"' + String(v).replace(/"/g, '""') + '"',
    data = (ms) => {
      const d = new Date(ms);
      return (
        String(d.getMonth() + 1).padStart(2, "0") +
        "/" +
        String(d.getDate()).padStart(2, "0") +
        "/" +
        d.getFullYear()
      );
    },
    hora = (ms) => {
      const d = new Date(ms),
        h = d.getHours();
      return (
        String(((h + 11) % 12) + 1).padStart(2, "0") +
        ":" +
        String(d.getMinutes()).padStart(2, "0") +
        (h < 12 ? " AM" : " PM")
      );
    },
    linhas = [
      [
        "Subject",
        "Start Date",
        "Start Time",
        "End Date",
        "End Time",
        "All Day Event",
        "Description",
        "Location",
        "Private",
      ],
    ]
      .concat(
        bls.map((bl) => [
          tituloBloco(bl),
          data(bl.t0),
          hora(bl.t0),
          data(bl.t1),
          hora(bl.t1),
          "False",
          "Registrado pelo Planejamento de Horas",
          "",
          "True",
        ]),
      )
      .map((r) => r.map(q).join(","))
      .join("\r\n");
  const [a, b] = intervaloPeriodo();
  try {
    const dl = await claude.use("downloads");
    if (!dl) return mostrarMensagem("Download indisponível nesta visualização.");
    await dl.save({ filename: "agenda-" + a + (b !== a ? "-a-" + b : "") + ".csv", data: linhas });
    mostrarMensagem(
      "Arquivo da agenda baixado. No Google Agenda: Configurações → Importar e exportar → Importar.",
    );
  } catch (e) {
    mostrarMensagem(
      e && e.code === "declined" ? "Download cancelado." : "Não foi possível baixar o arquivo.",
    );
  }
});

acao("#hagvinc", () => abrirJanela("gcal"));

function preencherAtividadesLancamento() {
  const pj = projetos[$("lpj").value],
    el = $("lat");
  if (!pj) {
    el.innerHTML = "";
    return;
  }
  let h = "";
  try {
    const x = JSON.parse(pj.j);
    percorrerAtividades(
      x,
      (i, c) => {
        h += `<option value="${escaparHtml(i.id)}">${escaparHtml(c.etapa.nome + " › " + c.disciplina + " › " + c.bloco.n + " › " + (i.d || ""))}</option>`;
      },
      pj.etapa || "",
    );
  } catch (e) {}
  el.innerHTML = h;
}

function mostrarAbaInicio() {
  $("hprojs").hidden = abaInicio !== "proj";
  $("hhrs").hidden = abaInicio !== "hrs";
  document
    .querySelectorAll("#htabs button")
    .forEach((b) => b.classList.toggle("on", b.dataset.ht === abaInicio));
  if (abaInicio === "hrs") desenharHoras();
}

async function irParaHoras() {
  if (idProjetoAberto) {
    if (estado.run)
      cronometroForaDaTela = {
        pid: idProjetoAberto,
        id: estado.run.id,
        t0: estado.run.t0,
        lab: descreverAtividade(idProjetoAberto, estado.run.id),
      };
    clearInterval(timerTela);
    await salvar();
  }
  idProjetoAberto = null;
  pilhaDesfazer = [];
  pilhaRefazer = [];
  abaInicio = "hrs";
  desenharInicio();
}

// ---------- Ações dos botões: horas trabalhadas ----------

acao("data-hrs", () => irParaHoras());
acao("data-ht", (v) => {
  abaInicio = v;
  mostrarAbaInicio();
});
acao("data-hp", (v) => {
  periodoHoras = v;
  desenharHoras();
});

// Navegar entre períodos (-1 anterior, 1 próximo, 0 hoje)
acao("data-hnav", (v) => {
  const n = +v,
    d = dataHoras || hoje();
  if (n === 0) dataHoras = hoje();
  else if (periodoHoras === "d") dataHoras = somarDias(d, n);
  else if (periodoHoras === "w") dataHoras = somarDias(d, 7 * n);
  else {
    const m = lerDataISO(d.slice(0, 8) + "01");
    m.setMonth(m.getMonth() + n);
    dataHoras = dataISO(m);
  }
  desenharHoras();
});

acao("data-hg", (k) => {
  if (projetosRecolhidosHoras.has(k)) projetosRecolhidosHoras.delete(k);
  else projetosRecolhidosHoras.add(k);
  desenharHoras();
});
acao("#hcol", () => {
  Object.keys(projetos).forEach((k) => projetosRecolhidosHoras.add(k));
  desenharHoras();
});
acao("#hexp", () => {
  projetosRecolhidosHoras.clear();
  desenharHoras();
});

// Exportar as horas do período em Excel: uma linha por atividade e o total por dia
acao("#hxls", async () => {
  if (typeof XLSX === "undefined")
    return mostrarMensagem("A biblioteca do Excel não carregou. Recarregue a página e tente de novo.");
  const { a, b, G, D } = dadosHoras(),
    hv = (h) => ({ t: "n", v: h / 24, z: "[h]:mm" }),
    grupos = [...G.values()].sort((x, y) => y.tot - x.tot),
    total = grupos.reduce((q, g) => q + g.tot, 0),
    linhas = [["Projeto", "Etapa", "Disciplina", "Bloco", "Atividade", "Horas"]];
  grupos.forEach((g) =>
    [...g.acts.values()]
      .sort((x, y) => y.h - x.h)
      .forEach((r) => linhas.push([g.p, r.e, r.d || "", r.b || r.loc, r.a, hv(r.h)])),
  );
  linhas.push(["Total do período", "", "", "", "", hv(total)]);
  const wh = XLSX.utils.aoa_to_sheet(linhas);
  wh["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 60 }, { wch: 10 }];
  wh["!autofilter"] = { ref: "A1:F" + (linhas.length - 1) };
  const dias = [...D.keys()].sort(),
    wd = XLSX.utils.aoa_to_sheet(
      [["Data", "Dia da semana", "Horas"]]
        .concat(dias.map((d) => [dataParaExcel(d), DIAS_SEMANA[lerDataISO(d).getDay()], hv(D.get(d))]))
        .concat([["Total", "", hv(total)]]),
    );
  wd["!cols"] = [{ wch: 13 }, { wch: 16 }, { wch: 10 }];
  const wp = XLSX.utils.aoa_to_sheet([
    ["Período", tituloPeriodo(a, b)],
    ["Projeto", projetoHoras && projetos[projetoHoras] ? projetos[projetoHoras].name : "Todos os projetos"],
    ["Total", hv(total)],
    ["Emitido em", dataHoraBR(Date.now())],
  ]);
  wp["!cols"] = [{ wch: 12 }, { wch: 50 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wh, "Horas");
  XLSX.utils.book_append_sheet(wb, wd, "Por dia");
  XLSX.utils.book_append_sheet(wb, wp, "Período");
  const nomePer = { d: "dia", w: "semana", m: "mes" }[periodoHoras] || periodoHoras;
  try {
    const dl = await claude.use("downloads");
    if (!dl) return mostrarMensagem("Exportação indisponível nesta visualização.");
    await dl.save({
      filename: "horas-" + nomePer + "-" + a + ".xlsx",
      data: XLSX.write(wb, { bookType: "xlsx", type: "array" }),
    });
    mostrarMensagem("Excel exportado.");
  } catch (e) {
    mostrarMensagem(
      e && e.code === "declined" ? "Exportação cancelada." : "Não foi possível salvar o Excel.",
    );
  }
});

// Lançar horas manualmente
acao("#lgo", () => {
  const pid = $("lpj").value,
    aid = $("lat").value,
    d = $("ldt").value,
    h = lerHoras($("lh").value),
    m = $("lmsg");
  if (!pid || !aid) return (m.textContent = "Escolha o projeto e a atividade.");
  if (!d) return (m.textContent = "Escolha a data.");
  if (!(h > 0)) return (m.textContent = "Informe as horas (ex.: 02:30).");
  const ok = editarProjetoSalvo(pid, (x) => {
    const i = acharAtividadeEm(x, aid);
    if (!i) return;
    i.u = (i.u || 0) + h;
    registrarHoras(i, d, h);
  });
  m.textContent = ok ? "Lançado: " + fmtHoras(h) + " em " + dataBR(d) + "." : "Não foi possível lançar.";
  $("lh").value = "";
  desenharHoras();
});

// Atribuir as horas sem data a um dia
acao("#ugo", () => {
  const d = $("udt").value;
  if (!d) return;
  let n = 0;
  Object.keys(projetos).forEach((pid) => {
    editarProjetoSalvo(pid, (x) => {
      percorrerAtividades(x, (i) => {
        const h = (i.u || 0) - (i.lg || []).reduce((q, l) => q + l.h, 0);
        if (h > 1 / 120) {
          registrarHoras(i, d, h);
          n++;
        }
      });
    });
  });
  mostrarMensagem(n + " atividade(s) com horas atribuídas a " + dataBR(d) + ".");
  desenharHoras();
});
