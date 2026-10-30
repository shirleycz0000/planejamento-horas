// Tela da disciplina (dentro de uma etapa): atividades, pavimentos, filtros, lote e arrastar

// Filtros por pavimento (como no Excel): em cada bloco, o título das colunas Status,
// Conclusão (data de entrega) e Responsável abre uma lista de valores para marcar.
// filtrosBloco[chave do bloco] = { s: [status], c: [datas "aaaa-mm-dd"; "" = sem data],
// r: [responsáveis; "" = sem responsável] } — cada um null/ausente = sem filtro.
// Ficam guardados neste navegador ("phfb").
let filtrosBloco = {};
try {
  filtrosBloco = JSON.parse(localStorage.getItem("phfb") || "{}") || {};
} catch (e) {}
const salvarFiltrosBloco = () => {
  try {
    localStorage.setItem("phfb", JSON.stringify(filtrosBloco));
  } catch (e) {}
};
const filtroDoBloco = (b) => filtrosBloco[chaveRecolhido(b)] || {};
const blocoFiltrado = (b) => {
  const f = filtroDoBloco(b);
  return !!(f.s || f.r || f.c);
};
const passaNosFiltros = (i, b) => {
  const f = filtroDoBloco(b);
  return (
    (!f.s || f.s.includes(i.s)) && (!f.r || f.r.includes(i.r || "")) && (!f.c || f.c.includes(i.c || ""))
  );
};
// Esquece os filtros de um pavimento (ex.: excluído)
const limparFiltrosDoBloco = (b) => {
  delete filtrosBloco[chaveRecolhido(b)];
  salvarFiltrosBloco();
};

let pavimentosRecolhidos = new Set();

try {
  pavimentosRecolhidos = new Set(JSON.parse(localStorage.getItem("phcol") || "[]"));
} catch (e) {}

const chaveRecolhido = (b) =>
    idProjetoAberto + "|" + estado.etapaAberta.id + "|" + estado.discAberta.id + "|" + normalizar(b.n),
  salvarRecolhidos = () => {
    try {
      localStorage.setItem("phcol", JSON.stringify([...pavimentosRecolhidos]));
    } catch (e) {}
  };

let cursorNoFim = null,
  detalhesAbertos = new Set(),
  focarComentario = null;

function adicionarComentario(id) {
  const n = document.querySelector(`[data-cmn="${id}"]`),
    v = n ? n.value.trim() : "",
    x = acharAtividade(id);
  if (!v || !x) return;
  (x.cm = x.cm || []).push({ t: v, d: Date.now() });
  focarComentario = id;
  atualizarAtividade(id);
  salvar();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.cmn) {
    e.preventDefault();
    adicionarComentario(e.target.dataset.cmn);
  }
});

const restante = (i) => {
  const r = i.e - usadoAtual(i);
  return r < -1 / 120 ? r : Math.max(0, r);
};

const htmlRestante = (i) =>
  estaSemAcao(i.s)
    ? "—"
    : `<span data-rest="${i.id}" class="${restante(i) < 0 ? "r" : "ok"}">${fmtHoras(restante(i))}</span>`;

const nomeApontamento = (i) =>
  i.d || "Apontamento" + (idDoApontamento(i.h) ? " " + idDoApontamento(i.h) : "");

const lerApontamento = (v, x) => {
  v = String(v || "");
  const m = v.match(REGEX_LINK);
  if (!m) return { d: v.trim(), h: "" };
  const h = normalizarLink(m[0]);
  return {
    d: v
      .replace(m[0], "")
      .trim()
      .replace(/^[\s|:–—-]+|[\s|:–—-]+$/g, ""),
    h: h || x.h || "",
  };
};

const htmlApontamento = (i) =>
  i.h && editandoApontamento !== i.id
    ? `<div class="df"><a class="lk" href="${escaparHtml(i.h)}" target="_blank" rel="noopener noreferrer" title="Abrir no Construflow">${escaparHtml(nomeApontamento(i))}</a>` +
      `<button data-ed="${i.id}" title="Editar nome e link" aria-label="Editar nome e link">✎</button></div>`
    : `<div class="df"><input data-f="ap" data-i="${i.id}" placeholder="Cole o link do Construflow ou o nome do apontamento" aria-label="Link ou nome do apontamento" value="${escaparHtml([i.d, i.h].filter(Boolean).join(" "))}"></div>`;

const ATRIBUTOS_FOCO = [
  "data-eini",
  "data-efim",
  "data-en",
  "data-hg",
  "data-sel",
  "data-dup",
  "data-dh",
  "data-cmt",
  "data-cmn",
  "data-cm",
  "data-cmdel",
  "data-cmadd",
  "data-cmclose",
  "data-done",
  "data-f",
  "data-i",
  "data-ct",
  "data-ck",
  "data-cn",
  "data-bn",
  "data-run",
  "data-del",
  "data-add",
  "data-ed",

  "data-cadd",
  "data-cdel",
  "data-delb",
];

function chaveDoFoco(el) {
  if (!el || !el.closest || !el.closest("#bl,#et")) return null;
  const a = ATRIBUTOS_FOCO.filter((n) => el.hasAttribute(n))
    .map((n) => `[${n}="${el.getAttribute(n)}"]`)
    .join("");
  return a ? { sel: el.tagName.toLowerCase() + a, s: el.selectionStart, e: el.selectionEnd } : null;
}

function desenhar() {
  fecharFiltroBloco();
  document.body.dataset.tela = idProjetoAberto ? telaAtual : "home";
  if (!idProjetoAberto) {
    desenharInicio();
    return;
  }
  if (telaAtual === "etapas") {
    const k0 = chaveDoFoco(document.activeElement);
    desenharEtapas();
    if (k0) {
      const el0 = document.querySelector(k0.sel);
      if (el0) {
        el0.focus({ preventScroll: true });
        try {
          el0.setSelectionRange(k0.s, k0.e);
        } catch (e) {}
      }
    }
    return;
  }
  if (telaAtual !== "etapa") return;
  const k = chaveDoFoco(document.activeElement);
  desenharEtapa();
  restaurarFoco(k);
}

// Depois de redesenhar, devolve o foco ao campo certo:
// pedido explícito (nova atividade, comentário, edição de link) ou o campo que estava em uso.
function restaurarFoco(k) {
  if (focarDescricao) {
    const el = document.querySelector(
      `[data-f="d"][data-i="${focarDescricao}"],[data-f="ap"][data-i="${focarDescricao}"]`,
    );
    focarDescricao = null;
    if (el) {
      el.focus();
      if (el.select) el.select();
      return;
    }
  }
  if (focarComentario) {
    const e0 = document.querySelector(`[data-cmn="${focarComentario}"]`);
    focarComentario = null;
    if (e0) {
      e0.focus();
      return;
    }
  }
  if (cursorNoFim) {
    const el = document.querySelector(`[data-f="ap"][data-i="${cursorNoFim}"]`),
      x = acharAtividade(cursorNoFim);
    cursorNoFim = null;
    if (el && x) {
      el.focus();
      const n = (x.d || "").length;
      try {
        el.setSelectionRange(n, n);
      } catch (e) {}
      return;
    }
  }
  if (k) {
    const el = document.querySelector(k.sel);
    if (el) {
      el.focus({ preventScroll: true });
      try {
        el.setSelectionRange(k.s, k.e);
      } catch (e) {}
    }
  }
}

// Resumo da etapa aberta: uma linha por disciplina e o total da etapa
function desenharResumoGeral() {
  const T = { E: 0, U: 0, R: 0, D: 0 },
    row = (n, z, c, di) =>
      `<tr${c ? ` class="${c}"` : ""}><td>${di === undefined ? escaparHtml(n) : `<button class="lnk" data-tab="${di}" title="Abrir ${escaparHtml(n)}">${escaparHtml(n)}</button>`}</td><td>${fmtHoras(z.E)}</td><td>${fmtHoras(z.U)}</td>` +
      `<td>${fmtHoras(z.R)}</td><td>${emDias(z.E)}</td><td>${emDias(z.R)}</td><td>${z.E ? Math.round((z.D / z.E) * 100) : 0}%</td></tr>`;
  const et = estado.etapaAberta,
    rs = (et ? et.disciplinas : [])
      .map((d, di) => {
        const z = totaisEtapa(d);
        for (const k in T) T[k] += z[k];
        return row(d.nome, z, di === estado.di ? "cur" : "", di);
      })
      .join("");
  $("gt").innerHTML =
    "<thead><tr><th>Disciplina</th><th>Estimado</th><th>Usado</th><th>Restante</th><th>Dias estimados</th><th>Dias restantes</th><th>Avanço</th></tr></thead><tbody>" +
    rs +
    row("Total geral", T, "tt") +
    "</tbody>";
}

// Botões das disciplinas da etapa aberta (a aberta fica destacada)
function desenharAbasDisciplinas() {
  const et = estado.etapaAberta;
  $("tabs").innerHTML =
    '<div class="seg" role="tablist" aria-label="Disciplinas da etapa">' +
    (et ? et.disciplinas : [])
      .map(
        (d, di) =>
          `<button role="tab" aria-selected="${di === estado.di}" class="${di === estado.di ? "on" : ""}" data-tab="${di}" title="${escaparHtml(d.escopo ? "Origem: " + d.escopo : d.nome)}">${escaparHtml(d.nome)}</button>`,
      )
      .join("") +
    "</div>" +
    '<button data-dadd title="Adicionar uma disciplina nesta etapa (ex.: SPDA, PCI)">+ Disciplina</button>' +
    '<span class="dd"><button class="ico" data-dd aria-haspopup="menu" aria-expanded="false" title="Mais opções da disciplina" aria-label="Mais opções da disciplina">⋯</button>' +
    '<div class="ddm l" role="menu" hidden><button data-dren role="menuitem">✎ Renomear disciplina</button><div class="dds"></div>' +
    '<button class="dang" data-ddel role="menuitem">× Excluir disciplina</button></div></span>';
}

let modoSelecao = false,
  selecionadas = new Set(),
  ordenarPorPrioridade = false;

try {
  ordenarPorPrioridade = localStorage.getItem("phsort") === "1";
} catch (e) {}

const compararPrioridade = (a, b) =>
  (ORDEM_PRIORIDADE[a.pr] ?? 3) - (ORDEM_PRIORIDADE[b.pr] ?? 3) ||
  String(a.dp || "9999").localeCompare(String(b.dp || "9999"));

function mudarStatus(x, ns) {
  const old = x.s;
  x.s = ns;
  if (estaConcluido(ns)) {
    if (estado.run && estado.run.id === x.id) pararCronometro();
    if (!x.c) x.c = hoje();
  } else if (estaConcluido(old)) x.c = "";
}

function htmlAlertas() {
  const al = [],
    t0 = hoje();
  estado.disc[estado.tab].forEach((b) =>
    b.it.forEach((i) => {
      if (estaSemAcao(i.s) || (estaConcluido(i.s) && usadoAtual(i) <= i.e)) return;
      const u = usadoAtual(i);
      if (i.e > 0 && u > i.e)
        al.push(
          `<p class="r">● Estourou: ${escaparHtml(i.d)} (${escaparHtml(b.n)}) usou ${fmtHoras(u)} de ${fmtHoras(i.e)}</p>`,
        );
      else if (i.e > 0 && u >= 0.8 * i.e && !estaConcluido(i.s))
        al.push(
          `<p class="a">● Perto do limite: ${escaparHtml(i.d)} (${escaparHtml(b.n)}) ${fmtHoras(u)} de ${fmtHoras(i.e)}</p>`,
        );
    }),
  );
  return al.length
    ? `<div class="alerts"><b>Alertas de atraso (${al.length})</b>${al.join("")}</div>`
    : `<div class="alerts none">Nenhuma atividade acima do estimado.</div>`;
}

let ocultarDetalhes = false;

try {
  ocultarDetalhes = localStorage.getItem("phhc") === "1";
} catch (e) {}

// Seletor de prioridade na própria linha da atividade: mostra só o símbolo; a lista
// (select transparente por cima) mostra os nomes
const htmlPrioridade = (i) => {
  const pr = i.pr && PRIORIDADES[i.pr];
  return (
    `<span class="prw ${pr ? pr[2] : "pr-0"}" title="Prioridade: ${pr ? pr[1] : "nenhuma"}"><span class="prv" aria-hidden="true">${pr ? pr[0] : "–"}</span>` +
    `<select class="prs" data-f="pr" data-i="${i.id}" aria-label="Prioridade">` +
    `<option value=""${pr ? "" : " selected"}>– Sem prioridade</option>` +
    Object.keys(PRIORIDADES)
      .map(
        (k) =>
          `<option value="${k}"${i.pr === k ? " selected" : ""}>${PRIORIDADES[k][0]} ${PRIORIDADES[k][1]}</option>`,
      )
      .join("") +
    `</select></span>`
  );
};

const htmlDetalhes = (i) => {
  const cm = i.cm || [],
    open = detalhesAbertos.has(i.id);
  if (!open && (ocultarDetalhes || !cm.length)) return "";
  return `<tr class="cmr"><td></td><td></td><td colspan="9"><div class="cl">${cm.length || open ? `<b>Comentários (${cm.length})</b>` : ""}${cm
    .map(
      (c, k) =>
        `<div class="ck"><span class="cd">${dataHoraBR(c.d)}</span><input data-cmt="${i.id}:${k}" aria-label="Comentário" value="${escaparHtml(c.t)}">` +
        `<button data-cmdel="${i.id}:${k}" title="Excluir comentário" aria-label="Excluir comentário">×</button></div>`,
    )
    .join("")}${
    open
      ? `<div class="df"><input data-cmn="${i.id}" placeholder="Escreva um comentário e aperte Enter" aria-label="Novo comentário">` +
        `<button class="p" data-cmadd="${i.id}">Adicionar</button><button data-cmclose="${i.id}">Fechar</button></div>`
      : ""
  }</div></td></tr>`;
};

function htmlAtividade(i, b, ap, dnd) {
  const run = estado.run && estado.run.id === i.id,
    cmn = (i.cm || []).length,
    hint = dicaHistorico(i);
  return (
    `<tr data-rid="${i.id}" class="${estaConcluido(i.s) ? "done" : estaSemAcao(i.s) ? "sa" : faltaPublicar(i.s) ? "fp" : ""}">` +
    `<td class="ckc"><input type="checkbox" data-done="${i.id}"${estaConcluido(i.s) ? " checked" : ""} aria-label="Marcar como concluído"></td>` +
    `<td class="act">${modoSelecao ? `<input type="checkbox" data-sel="${i.id}"${selecionadas.has(i.id) ? " checked" : ""} aria-label="Selecionar atividade">` : ""}<span class="dh${dnd ? "" : " off"}" data-dh="${i.id}" draggable="${dnd}" title="${dnd ? "Arraste para reordenar" : "Reordenar indisponível com filtro ou ordenação ativos"}">⋮⋮</span>` +
    `${htmlPrioridade(i)}<button data-cm="${i.id}" title="${detalhesAbertos.has(i.id) ? "Recolher comentários" : "Abrir comentários"}" aria-label="Comentários">${detalhesAbertos.has(i.id) ? "−" : "+"}</button>${cmn ? `<span class="bdg" title="${cmn} comentário(s)">${cmn}</span>` : ""}</td>` +
    `<td class="d">${ap ? htmlApontamento(i) : campoDescricao(i)}</td><td><select class="sst ${classeCorStatus(i.s)}" data-f="s" data-i="${i.id}" aria-label="Status">${nomesStatus.map((x) => `<option class="${classeCorStatus(x)}"${x === i.s ? " selected" : ""}>${escaparHtml(x)}</option>`).join("")}</select></td>` +
    `<td class="n"><input inputmode="numeric" placeholder="00:00" data-f="e" data-i="${i.id}" value="${fmtHoras(i.e)}"${hint ? ` class="hh" title="${escaparHtml(hint)}"` : ""}></td>` +
    `<td class="n"><input inputmode="numeric" placeholder="00:00" data-f="u" data-i="${i.id}" value="${fmtHoras(usadoAtual(i))}"${run ? ` readonly data-liveu="${i.id}" title="Contando: o tempo é somado ao pausar"` : ""}></td>` +
    `<td class="n rs">${htmlRestante(i)}</td>` +
    `<td><button data-run="${i.id}" title="${run ? "Pausar" : "Play"}" aria-label="${run ? "Pausar" : "Play"}">${run ? "⏸" : "▶"}</button> ${run ? `<span class="t" data-live="${i.id}">${fmtHorasSeg(usadoAtual(i) - i.u)}</span>` : ""}</td>` +
    `<td><select data-f="r" data-i="${i.id}" aria-label="Responsável">${(i.r && !estado.pe.includes(i.r)
      ? [i.r]
      : []
    )
      .concat(estado.pe)
      .map((n) => `<option${n === i.r ? " selected" : ""}>${escaparHtml(n)}</option>`)
      .join("")}<option value=""${i.r ? "" : " selected"}>— sem responsável —</option></select></td>` +
    `<td class="dt"><input type="date" data-f="c" data-i="${i.id}" value="${escaparHtml(i.c || "")}" aria-label="Data de conclusão"></td>` +
    `<td class="acts"><button data-dup="${i.id}" title="Duplicar atividade" aria-label="Duplicar atividade">⧉</button>` +
    `<button data-del="${i.id}" title="Excluir" aria-label="Excluir">×</button></td></tr>${
      ap
        ? `<tr class="ac${estaConcluido(i.s) ? " done" : ""}"><td></td><td></td><td colspan="9">` +
          `<div class="cl"><b>Ações (${(i.l || []).filter((x) => x.c).length}/${(i.l || []).length})</b>${(
            i.l || []
          )
            .map(
              (x, k) =>
                `<div class="ck${x.c ? " x" : ""}"><input type="checkbox" data-ck="${i.id}:${k}"${x.c ? " checked" : ""} aria-label="Ação concluída">` +
                `<input data-ct="${i.id}:${k}" aria-label="Texto da ação" value="${escaparHtml(x.t)}">` +
                `<button data-cdel="${i.id}:${k}" title="Excluir ação" aria-label="Excluir ação">×</button></div>`,
            )
            .join("")}<div class="df">` +
          `<input data-cn="${i.id}" placeholder="Nova ação para atender este apontamento" aria-label="Nova ação">` +
          `<button data-cadd="${i.id}">+ Ação</button></div></div></td></tr>`
        : ""
    }${htmlDetalhes(i)}`
  );
}

const NOMES_FILTRO = { s: "Status", r: "Responsável", c: "Conclusão" };
// Botão de filtro no título de uma coluna (▾; destacado quando há filtro)
function htmlBotaoFiltro(b, bi, campo) {
  const ativo = !!filtroDoBloco(b)[campo];
  return `<button class="fbt${ativo ? " on" : ""}" data-fb="${bi}:${campo}" title="${ativo ? "Filtro aplicado — clique para mudar" : "Filtrar"}" aria-label="Filtrar ${NOMES_FILTRO[campo].toLowerCase()}">${ativo ? "⏷" : "▾"}</button>`;
}

function htmlPavimentos() {
  const dnd = !filtroAtivo() && !ordenarPorPrioridade;
  return estado.disc[estado.tab]
    .map((b, bi) => {
      const ap = ehBlocoApontamentos(b.n),
        filtrado = blocoFiltrado(b);
      let vis = b.it.filter((i) => passaNosFiltros(i, b));
      if (ordenarPorPrioridade) vis = [...vis].sort(compararPrioridade);
      const col = pavimentosRecolhidos.has(chaveRecolhido(b));
      return (
        `<section class="bl${col ? " col" : ""}" data-bi="${bi}"><h2>${htmlCabecalhoPavimento(b, bi, dnd, col)}</h2>` +
        `<div class="sc"><table><thead><tr><th style="width:34px" title="Concluído">✓</th>` +
        `<th style="width:1%;white-space:nowrap" title="Arrastar, prioridade e comentários">⋮⋮ Prioridade +</th>` +
        `<th>Atividade</th><th style="width:160px"><span class="thf">Status${htmlBotaoFiltro(b, bi, "s")}</span></th><th style="width:84px">Estimado</th>` +
        `<th style="width:84px">Usado</th><th style="width:84px">Restante</th>` +
        `<th style="width:90px">Cronômetro</th><th style="width:110px"><span class="thf">Responsável${htmlBotaoFiltro(b, bi, "r")}</span></th>` +
        `<th style="width:136px"><span class="thf" title="Data de entrega (conclusão)">Conclusão${htmlBotaoFiltro(b, bi, "c")}</span></th>` +
        `<th style="width:72px"></th></tr></thead><tbody>${vis.map((i) => htmlAtividade(i, b, ap, dnd)).join("")}` +
        (filtrado && !vis.length && b.it.length
          ? `<tr><td colspan="11"><span class="note">Nenhuma atividade com esse filtro. <button data-fbclr="${bi}">Limpar filtro</button></span></td></tr>`
          : "") +
        `</tbody></table></div>` +
        `<div class="foot"><button data-add="${bi}">${ap ? "+ Apontamento" : "+ Atividade"}</button></div></section>`
      );
    })
    .join("");
}

// Cabeçalho de um pavimento: arrastar, recolher, nome, totais e botões
function htmlCabecalhoPavimento(b, bi, dnd, col) {
  const be = b.it.filter((i) => !estaSemAcao(i.s)).reduce((a, i) => a + i.e, 0),
    bu = b.it.reduce((a, i) => a + usadoAtual(i), 0),
    nd = b.it.filter((i) => estaConcluido(i.s)).length,
    rn = !!(estado.run && b.it.some((i) => i.id === estado.run.id));
  return (
    `<span class="bh${dnd ? "" : " off"}" data-bh="${bi}" draggable="${dnd}" title="${dnd ? "Arraste para reordenar o pavimento" : "Reordenar indisponível com filtro ou ordenação ativos"}">⋮⋮</span>` +
    `<button class="tg" data-tg="${bi}" aria-expanded="${!col}" title="${col ? "Expandir atividades" : "Recolher atividades"}" aria-label="${col ? "Expandir atividades" : "Recolher atividades"}">${col ? "▸" : "▾"}</button>` +
    `<input class="bt" data-bn="${bi}" value="${escaparHtml(b.n)}" aria-label="Nome do pavimento">` +
    `<span>${blocoFiltrado(b) ? `<button class="fbx" data-fbclr="${bi}" title="Mostrar todas as atividades deste pavimento">Filtro: ${b.it.filter((i) => passaNosFiltros(i, b)).length} de ${b.it.length} ×</button> ` : ""}${col ? `${b.it.length} atividade${b.it.length === 1 ? "" : "s"} · ${nd} concluída${nd === 1 ? "" : "s"}${rn ? " · ⏱ em andamento" : ""} · ` : ""}${fmtHoras(bu)} / ${fmtHoras(be)} ` +
    `<span class="dd"><button class="ico" data-dd aria-haspopup="menu" aria-expanded="false" title="Mais opções do pavimento" aria-label="Mais opções do pavimento">⋯</button>` +
    `<span class="ddm" role="menu" hidden><button data-dupb="${bi}" role="menuitem">⧉ Duplicar pavimento</button>` +
    `<button data-rpl="${bi}" role="menuitem">⇄ Replicar em outros pavimentos</button>` +
    `<button data-svb="${bi}" role="menuitem">💾 Salvar como modelo</button><span class="dds"></span>` +
    `<button class="dang" data-delb="${bi}" role="menuitem">× Excluir pavimento</button></span></span></span>`
  );
}

// ---------- Atualização parcial (sem redesenhar a tela inteira) ----------

// Algum pavimento da disciplina aberta com filtro
const filtroAtivo = () => (estado.disc[estado.tab] || []).some(blocoFiltrado);

// Resumo geral (totais por disciplina), alertas e botões desfazer/refazer
function desenharTotais() {
  desenharResumoGeral();
  $("al").innerHTML = htmlAlertas();
  $("un").disabled = !pilhaDesfazer.length;
  $("rd").disabled = !pilhaRefazer.length;
}

// Redesenha o cabeçalho do pavimento (sem mexer no nome, se ele estiver sendo editado)
function atualizarCabecalhoPavimento(bi) {
  const h2 = document.querySelector(`section.bl[data-bi="${bi}"] > h2`),
    b = estado.disc[estado.tab][bi];
  if (!h2 || !b || h2.contains(document.activeElement)) return;
  const col = pavimentosRecolhidos.has(chaveRecolhido(b));
  h2.innerHTML = htmlCabecalhoPavimento(b, bi, !filtroAtivo() && !ordenarPorPrioridade, col);
}

// Depois de editar um campo de uma atividade: troca só a linha dela, o cabeçalho do
// pavimento e os totais. Com filtro ou ordenação ativos a linha pode sumir ou mudar de
// lugar, então a tela inteira é redesenhada.
function atualizarAtividade(id) {
  if (telaAtual !== "etapa" || filtroAtivo() || ordenarPorPrioridade) return desenhar();
  const bi = estado.disc[estado.tab].findIndex((b) => b.it.some((i) => i.id === id)),
    linha = document.querySelector(`tr[data-rid="${id}"]`);
  if (bi < 0 || !linha) return desenhar();
  const k = chaveDoFoco(document.activeElement),
    b = estado.disc[estado.tab][bi],
    i = b.it.find((x) => x.id === id);
  // a atividade ocupa a linha principal e as linhas de detalhe que vêm logo depois
  let prox = linha.nextElementSibling;
  while (prox && !prox.hasAttribute("data-rid")) {
    const seguinte = prox.nextElementSibling;
    prox.remove();
    prox = seguinte;
  }
  const t = document.createElement("template");
  t.innerHTML = htmlAtividade(i, b, ehBlocoApontamentos(b.n), true);
  linha.replaceWith(t.content);
  atualizarCabecalhoPavimento(bi);
  desenharTotais();
  restaurarFoco(k);
}

function desenharBarraLote() {
  const tc = ocultarDetalhes ? "Mostrar comentários" : "Recolher comentários";
  $("hidec").title = tc;
  $("hidec").setAttribute("aria-label", tc);
  $("hidec").classList.toggle("on2", ocultarDetalhes);
  const bar = $("bar");
  bar.hidden = !modoSelecao;
  $("selm").classList.toggle("on2", modoSelecao);
  $("sortp").classList.toggle("on2", ordenarPorPrioridade);
  if (!modoSelecao) return;
  const kp = (id) => $(id).value,
    vs = kp("bst"),
    vr = kp("brs"),
    vp = kp("bpr");
  $("bst").innerHTML = nomesStatus
    .map((x) => `<option class="${classeCorStatus(x)}">${escaparHtml(x)}</option>`)
    .join("");
  $("bst").value = nomesStatus.includes(vs) ? vs : nomesStatus[0];
  $("brs").innerHTML =
    estado.pe.map((n) => `<option>${escaparHtml(n)}</option>`).join("") +
    '<option value="">— sem responsável —</option>';
  if (vr !== "" || $("brs").options.length)
    $("brs").value = [...$("brs").options].some((o) => o.value === vr) ? vr : $("brs").options[0].value;
  $("bpr").innerHTML =
    '<option value="">Sem prioridade</option><option value="a">▲ Alta</option><option value="m">● Média</option><option value="b">▼ Baixa</option>';
  $("bpr").value = vp || "a";
  const vis = new Set(estado.disc[estado.tab].flatMap((b) => b.it.map((i) => i.id)));
  [...selecionadas].forEach((k) => {
    if (!vis.has(k)) selecionadas.delete(k);
  });
  $("barn").textContent = selecionadas.size + " selecionada" + (selecionadas.size === 1 ? "" : "s");
}

function aplicarEmLote(kind, val) {
  const ids = [...selecionadas];
  if (!ids.length) {
    mostrarMensagem("Selecione ao menos uma atividade.");
    return;
  }
  ids.forEach((id) => {
    const x = acharAtividade(id);
    if (!x) return;
    if (kind === "s") mudarStatus(x, val);
    else x[kind] = val;
  });
  desenhar();
  salvar();
}

function desenharEtapa() {
  for (const d in estado.disc)
    estado.disc[d].forEach((b) => {
      if (ehBlocoApontamentos(b.n))
        b.it.forEach((i) => {
          if (i.k !== undefined) {
            if (i.k) i.d = (i.k + " " + i.d).trim();
            delete i.k;
          }
          if (i.l === undefined) {
            i.l = i.a ? [{ t: i.a, c: false }] : [];
            delete i.a;
          }
        });
    });
  if (!estado.pe) estado.pe = RESPONSAVEIS_PADRAO.slice();
  $("pecnt").textContent = estado.pe.length + (estado.pe.length === 1 ? " pessoa" : " pessoas");
  if (document.activeElement !== $("hd")) $("hd").value = estado.hd;
  {
    const d = estado.discAberta,
      et = estado.etapaAberta;
    $("pnm").textContent = projetos[idProjetoAberto].name;
    $("sub").textContent = "· Etapa " + et.nome;
    $("back").textContent = projetos[idProjetoAberto].name;
    $("bcet").textContent = et.nome;
    $("bcdi").textContent = d.nome;
    // disciplinas do cadastro (todas as etapas); a desta etapa e disciplina vem selecionada
    const sv = $("scs").value,
      ops = opcoesCadastroDaDisciplina(et, d);
    $("scs").innerHTML = ops.length
      ? ops.map((o) => `<option value="${escaparHtml(o.v)}">${escaparHtml(o.l)}</option>`).join("")
      : '<option value="">Nenhuma disciplina no cadastro</option>';
    const ok = (v) => v && ops.some((o) => o.v === v);
    $("scs").value = ok(sv) ? sv : ops[0] ? ops[0].v : "";
    $("scl").disabled = !ops.length;
    desenharAbasDisciplinas();
    $("scm").textContent = mensagemEscopo;
  }
  desenharTotais();
  $("bl").innerHTML = htmlPavimentos();
  desenharBarraLote();
  atualizarSeletorModelos();
  clearInterval(timerTela);
  if (estado.run) {
    let n = 0;
    timerTela = setInterval(() => {
      if (!estado.run) return clearInterval(timerTela);
      const x = acharAtividade(estado.run.id),
        e = document.querySelector(`[data-live="${estado.run.id}"]`);
      if (x && e) e.textContent = fmtHorasSeg(usadoAtual(x) - x.u);
      const lu = document.querySelector(`[data-liveu="${estado.run.id}"]`);
      if (x && lu) lu.value = fmtHoras(usadoAtual(x));
      const rr = document.querySelector(`[data-rest="${estado.run.id}"]`);
      if (x && rr) {
        rr.textContent = fmtHoras(restante(x));
        rr.className = restante(x) < 0 ? "r" : "ok";
      }
      // a cada 5 s, atualiza os totais e o cabeçalho do pavimento (sem redesenhar as linhas)
      if (++n % 5 === 0 && telaAtual === "etapa") {
        desenharTotais();
        const bi = estado.disc[estado.tab].findIndex((b) => b.it.some((i) => i.id === estado.run.id));
        if (bi >= 0) atualizarCabecalhoPavimento(bi);
      }
    }, 1000);
  }
}

// ---------- Ações dos botões: tela da disciplina ----------

// Atividades
acao(
  "data-add",
  (bi) => {
    const b = estado.disc[estado.tab][+bi];
    b.it.push({
      id: novoIdAtividade(),
      d: ehBlocoApontamentos(b.n) ? "" : "Nova atividade",
      l: [],
      h: "",
      r: estado.pe[0] || "",
      s: statusComComportamento("pend"),
      e: 1,
      u: 0,
    });
  },
  SALVA,
);

acao(
  "data-del",
  (id) => {
    if (estado.run && estado.run.id === id) estado.run = null;
    estado.disc[estado.tab].forEach((b) => (b.it = b.it.filter((i) => i.id !== id)));
  },
  SALVA,
);

acao(
  "data-dup",
  (id) => {
    const i0 = acharAtividade(id);
    estado.disc[estado.tab].forEach((b) => {
      const k = b.it.findIndex((x) => x.id === id);
      if (k >= 0) {
        const c = clonarAtividade(i0);
        c.d = (i0.d || "") + " (cópia)";
        b.it.splice(k + 1, 0, c);
      }
    });
  },
  SALVA,
);

// Apontamento: abrir edição de nome e link
acao(
  "data-ed",
  (id) => {
    editandoApontamento = id;
    cursorNoFim = id;
  },
  SALVA_LINHA,
);

// Detalhes e comentários
acao(
  "data-cm",
  (id) => {
    if (detalhesAbertos.has(id)) detalhesAbertos.delete(id);
    else {
      detalhesAbertos.add(id);
      focarComentario = id;
    }
  },
  SALVA_LINHA,
);
acao("data-cmclose", (id) => detalhesAbertos.delete(id), SALVA_LINHA);
acao("data-cmadd", (id) => adicionarComentario(id));
acao(
  "data-cmdel",
  (v) => {
    const [a, k] = v.split(":");
    acharAtividade(a).cm.splice(+k, 1);
  },
  SALVA_LINHA,
);

// Ações (checklist) dos apontamentos
acao("data-cadd", (id) => adicionarAcao(id));
acao(
  "data-cdel",
  (v) => {
    const [a, k] = v.split(":");
    acharAtividade(a).l.splice(+k, 1);
  },
  SALVA_LINHA,
);

// Pavimentos
acao(
  "#addb",
  () => {
    const n = $("nb").value.trim() || "Novo pavimento",
      bs = estado.disc[estado.tab],
      ka = bs.findIndex((b) => ehBlocoApontamentos(b.n));
    bs.splice(ka < 0 ? bs.length : ka, 0, { n, it: [] });
    $("nb").value = "";
  },
  SALVA,
);

acao(
  "data-dupb",
  (v) => {
    const bi = +v,
      b = estado.disc[estado.tab][bi];
    let n = b.n + " (cópia)",
      q = 2;
    while (estado.disc[estado.tab].some((x) => normalizar(x.n) === normalizar(n)))
      n = b.n + " (cópia " + q++ + ")";
    estado.disc[estado.tab].splice(bi + 1, 0, { n, it: b.it.map(clonarAtividade) });
  },
  SALVA,
);

acao("data-delb", (v) => {
  const bi = +v,
    b = estado.disc[estado.tab][bi];
  if (ehBlocoEscopo(b))
    return mostrarMensagem(
      "O bloco " + b.n + " é o escopo da disciplina e não pode ser excluído (dá para excluir as atividades).",
    );
  const go = () => {
    if (estado.run && b.it.some((i) => i.id === estado.run.id)) estado.run = null;
    limparFiltrosDoBloco(b);
    estado.disc[estado.tab].splice(bi, 1);
    desenhar();
    salvar();
  };
  if (b.it.length) confirmar('Excluir o pavimento "' + b.n + '" e suas ' + b.it.length + " atividades?", go);
  else go();
});

acao("data-tg", (v) => {
  const k = chaveRecolhido(estado.disc[estado.tab][+v]);
  if (pavimentosRecolhidos.has(k)) pavimentosRecolhidos.delete(k);
  else pavimentosRecolhidos.add(k);
  salvarRecolhidos();
  desenhar();
});
acao("#colall", () => {
  estado.disc[estado.tab].forEach((b) => pavimentosRecolhidos.add(chaveRecolhido(b)));
  salvarRecolhidos();
  desenhar();
});
acao("#expall", () => {
  estado.disc[estado.tab].forEach((b) => pavimentosRecolhidos.delete(chaveRecolhido(b)));
  salvarRecolhidos();
  desenhar();
});

// Atividades do cadastro: acrescenta ao Escopo + Geral as que faltam na disciplina
acao(
  "#scl",
  () => {
    const [ce, cd] = cadastroPorValor($("scs").value),
      d = estado.discAberta;
    if (!cd) {
      mensagemEscopo = "Escolha uma disciplina do cadastro.";
      desenhar();
      return false;
    }
    const r = carregarAtividadesDoCadastro(d, cd.atividades);
    if (!d.cadastroDiscId) {
      d.cadastroDiscId = cd.id;
      d.escopo = "Cadastro: " + ce.nome + " · " + cd.nome;
    }
    mensagemEscopo =
      r.na +
      " atividade(s) do cadastro acrescentada(s) ao " +
      NOME_BLOCO_ESCOPO +
      "; " +
      r.sk +
      " já estavam na disciplina.";
  },
  SALVA,
);

// Responsáveis (janela "pe", aberta pelo menu ⚙ Configurações)
function janelaResponsaveis() {
  return [
    "Responsáveis do projeto",
    `<p class="note" style="margin:0">Nomes que aparecem na coluna Responsável das atividades deste projeto.</p>` +
      `<div class="chips" id="chips">${
        estado.pe
          .map(
            (n, k) =>
              `<span class="chip">${escaparHtml(n)}<button data-delp="${k}" title="Remover da lista" aria-label="Remover ${escaparHtml(n)}">×</button></span>`,
          )
          .join("") || '<span class="note" style="margin:0">Nenhum responsável.</span>'
      }</div>` +
      `<div class="df" style="justify-content:flex-start"><input id="np" placeholder="Nome do responsável" aria-label="Nome do responsável">` +
      `<button class="p" id="addp">+ Responsável</button></div>` +
      `<div class="df" style="justify-content:flex-end"><button data-dclose>Fechar</button></div>`,
  ];
}

function adicionarResponsavel() {
  const n = $("np").value.trim();
  if (!n) return false;
  if (!estado.pe.some((x) => x.toLowerCase() === n.toLowerCase())) estado.pe.push(n);
  desenharJanela();
  $("np").focus();
}
acao("#addp", adicionarResponsavel, { ...SALVA, janela: true });
acao(
  "data-delp",
  (k) => {
    estado.pe.splice(+k, 1);
    desenharJanela();
  },
  { ...SALVA, janela: true },
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "np" && adicionarResponsavel() !== false) {
    e.preventDefault();
    desenhar();
    salvar();
  }
});

// Resumo geral da etapa: recolher e mostrar (lembrado no navegador)
let resumoRecolhido = false;
try {
  resumoRecolhido = localStorage.getItem("phrg") === "1";
} catch (e) {}
function aplicarResumoRecolhido() {
  $("gtw").hidden = resumoRecolhido;
  $("tggi").textContent = resumoRecolhido ? "▸" : "▾";
  $("tgger").setAttribute("aria-expanded", String(!resumoRecolhido));
  $("tgger").title = resumoRecolhido ? "Mostrar o resumo" : "Recolher o resumo";
}
aplicarResumoRecolhido();
acao("#tgger", () => {
  resumoRecolhido = !resumoRecolhido;
  try {
    localStorage.setItem("phrg", resumoRecolhido ? "1" : "0");
  } catch (e) {}
  aplicarResumoRecolhido();
});
acao("#bchome", () => irParaInicio());

// Filtros e visualização
acao("#hidec", () => {
  ocultarDetalhes = !ocultarDetalhes;
  if (ocultarDetalhes) detalhesAbertos.clear();
  try {
    localStorage.setItem("phhc", ocultarDetalhes ? "1" : "0");
  } catch (e) {}
  desenhar();
});
acao("#sortp", () => {
  ordenarPorPrioridade = !ordenarPorPrioridade;
  try {
    localStorage.setItem("phsort", ordenarPorPrioridade ? "1" : "0");
  } catch (e) {}
  desenhar();
});

// Seleção em lote
acao("#selm", () => {
  modoSelecao = !modoSelecao;
  if (!modoSelecao) selecionadas.clear();
  desenhar();
});
acao("#selall", () => {
  estado.disc[estado.tab].forEach((b) =>
    b.it.filter((i) => passaNosFiltros(i, b)).forEach((i) => selecionadas.add(i.id)),
  );
  desenhar();
});
acao("#selnone", () => {
  selecionadas.clear();
  desenhar();
});
acao("#bstb", () => aplicarEmLote("s", $("bst").value));
acao("#brsb", () => aplicarEmLote("r", $("brs").value));
acao("#bprb", () => aplicarEmLote("pr", $("bpr").value));
acao("#bdcb", () => {
  if (!$("bdc").value) return mostrarMensagem("Escolha a data de conclusão.");
  aplicarEmLote("c", $("bdc").value);
});
acao("#bdel", () => {
  const n = selecionadas.size;
  if (!n) return mostrarMensagem("Selecione ao menos uma atividade.");
  confirmar("Excluir as " + n + " atividades selecionadas?", () => {
    const ids = new Set(selecionadas);
    if (estado.run && ids.has(estado.run.id)) estado.run = null;
    estado.disc[estado.tab].forEach((b) => (b.it = b.it.filter((i) => !ids.has(i.id))));
    selecionadas.clear();
    desenhar();
    salvar();
  });
});

function adicionarAcao(id) {
  const n = document.querySelector(`[data-cn="${id}"]`),
    v = n ? n.value.trim() : "",
    x = acharAtividade(id);
  if (!v || !x) return;
  (x.l = x.l || []).push({ t: v, c: false });
  atualizarAtividade(id);
  salvar();
  const m = document.querySelector(`[data-cn="${id}"]`);
  if (m) m.focus();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.cn) {
    e.preventDefault();
    adicionarAcao(e.target.dataset.cn);
  }
});

document.addEventListener("focusout", (e) => {
  const t = e.target,
    id = t.dataset && t.dataset.f === "ap" ? t.dataset.i : null;
  if (id)
    setTimeout(() => {
      const x = acharAtividade(id);
      if (x && x.h && editandoApontamento === id) {
        editandoApontamento = null;
        atualizarAtividade(id);
      }
    }, 150);
});

document.addEventListener("change", (e) => {
  const t = e.target;
  let idAlterado = null;
  if (t.type === "date" && t.value) {
    const y = +t.value.slice(0, 4);
    if (!(y >= 1900 && y <= 2200)) return;
  }
  if (t.name === "pmodo") {
    atualizarFormularioNovo();
    return;
  }
  if (t.id === "pf") {
    if (t.files[0] && !$("pn").value.trim()) $("pn").value = t.files[0].name.replace(/\.[^.]+$/, "");
    return;
  }
  if (t.id === "pcp") return;
  if (t.id === "pet") {
    desenharDisciplinasNovoProjeto();
    return;
  }
  if (t.closest && t.closest("#pdisc")) return;
  if (t.id === "ds") {
    $("dn2").hidden = t.value !== "";
    if (!t.value) $("dn2").focus();
    return;
  }
  if (t.id === "pdet") {
    janela.arg = +t.value;
    janela.msg = "";
    desenharJanela();
    return;
  }
  if (t.dataset && t.dataset.pdi !== undefined) return;
  if (t.id === "ddsel") {
    $("ddnome").hidden = t.value !== "";
    if (!t.value) $("ddnome").focus();
    return;
  }
  if (t.id === "hdt") {
    dataHoras = t.value || hoje();
    desenharHoras();
    return;
  }
  if (t.id === "hpj") {
    projetoHoras = t.value;
    desenharHoras();
    return;
  }
  if (t.id === "lpj") {
    preencherAtividadesLancamento();
    return;
  }
  if (t.closest && t.closest("#fpop")) return;
  if (t.id === "hd" || t.id === "ehd") {
    estado.hd = Math.max(1, +t.value || 7);
  } else if (t.dataset.en !== undefined) {
    // nome da etapa (não pode repetir no projeto)
    const ei = +t.dataset.en,
      n = t.value.trim();
    if (
      !estado.etapas[ei] ||
      !n ||
      estado.etapas.some((e, j) => j !== ei && normalizar(e.nome) === normalizar(n))
    ) {
      desenharEtapas();
      return;
    }
    estado.etapas[ei].nome = n;
  } else if (t.dataset.eini !== undefined) {
    estado.etapas[+t.dataset.eini].ini = t.value;
  } else if (t.dataset.efim !== undefined) {
    estado.etapas[+t.dataset.efim].fim = t.value;
  } else if (t.dataset.sel) {
    if (t.checked) selecionadas.add(t.dataset.sel);
    else selecionadas.delete(t.dataset.sel);
    desenhar();
    return;
  } else if (t.dataset.bn) {
    estado.disc[estado.tab][+t.dataset.bn].n = t.value.trim() || "Pavimento";
  } else if (t.dataset.done) {
    const x = acharAtividade(t.dataset.done);
    if (!x) return;
    idAlterado = x.id;
    if (t.checked) {
      if (estado.run && estado.run.id === x.id) pararCronometro();
      x.s = statusComComportamento("ok");
      if (!x.c) x.c = hoje();
    } else {
      x.s = x.u > 0 ? statusComComportamento("and") : statusComComportamento("pend");
      x.c = "";
    }
  } else if (t.dataset.cmt) {
    const [a, k] = t.dataset.cmt.split(":"),
      x = acharAtividade(a);
    if (!x || !x.cm || !x.cm[+k]) return;
    x.cm[+k].t = t.value;
    idAlterado = x.id;
  } else if (t.dataset.ck || t.dataset.ct) {
    const [a, k] = (t.dataset.ck || t.dataset.ct).split(":"),
      x = acharAtividade(a);
    if (!x || !x.l[+k]) return;
    idAlterado = x.id;
    if (t.dataset.ck) x.l[+k].c = t.checked;
    else x.l[+k].t = t.value;
  } else if (t.dataset.f) {
    const x = acharAtividade(t.dataset.i);
    if (!x) return;
    idAlterado = x.id;
    const f = t.dataset.f,
      old = x.s;
    if (f === "ap") {
      const r = lerApontamento(t.value, x);
      x.d = r.d;
      x.h = r.h;
      editandoApontamento = null;
    } else if (f === "u") {
      const nv = lerHoras(t.value);
      ajustarRegistro(x, nv - x.u);
      x.u = nv;
    } else x[f] = f === "e" ? lerHoras(t.value) : t.value;
    if (f === "s") {
      if (estaConcluido(t.value)) {
        if (!x.c) x.c = hoje();
        if (estado.run && estado.run.id === x.id) pararCronometro();
      } else if (estaConcluido(old)) x.c = "";
    }
  } else return;
  salvar();
  // campo de uma atividade: atualiza só a linha dela; outros campos: redesenha a tela
  const redesenho = idAlterado ? () => atualizarAtividade(idAlterado) : desenhar;
  // no campo de data, espera sair do campo (o calendário do navegador ainda pode estar aberto)
  if (t.type === "date" && document.activeElement === t) redesenharAposData = redesenho;
  else setTimeout(redesenho, 0);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target && e.target.type === "date") e.target.blur();
});

let redesenharAposData = null;

document.addEventListener("focusout", (e) => {
  if (redesenharAposData && e.target && e.target.type === "date") {
    const f = redesenharAposData;
    redesenharAposData = null;
    setTimeout(f, 0);
  }
});

let arrastando = null,
  focarDescricao = null;

function adicionarAtividadeEm(bi) {
  const b = estado.disc[estado.tab][bi];
  if (!b) return;
  const ap = ehBlocoApontamentos(b.n),
    id = "a" + Date.now().toString(36) + (++contadorIds).toString(36);
  b.it.push({
    id,
    d: ap ? "" : "Nova atividade",
    l: [],
    h: "",
    r: estado.pe[0] || "",
    s: statusComComportamento("pend"),
    e: 1,
    u: 0,
  });
  pavimentosRecolhidos.delete(chaveRecolhido(b));
  salvarRecolhidos();
  focarDescricao = id;
  desenhar();
  salvar();
}

$("bl").addEventListener("dragstart", (e) => {
  const h = e.target.closest && e.target.closest("[data-dh],[data-bh]");
  if (!h || h.classList.contains("off")) {
    e.preventDefault();
    return;
  }
  if (h.dataset.dh !== undefined) {
    arrastando = { t: "it", id: h.dataset.dh };
    const tr = h.closest("tr");
    tr.classList.add("dragging");
    try {
      e.dataTransfer.setData("text/plain", h.dataset.dh);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setDragImage(tr, 12, 12);
    } catch (x) {}
  } else {
    arrastando = { t: "bl", bi: +h.dataset.bh };
    try {
      e.dataTransfer.setData("text/plain", "bl" + h.dataset.bh);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setDragImage(h.closest("h2"), 12, 12);
    } catch (x) {}
  }
});

const limparMarcaSoltar = () =>
  document.querySelectorAll(".dropb").forEach((x) => x.classList.remove("dropb"));

$("bl").addEventListener("dragover", (e) => {
  if (!arrastando) return;
  const tr = e.target.closest("tr[data-rid]"),
    sec = e.target.closest("section.bl");
  if (arrastando.t === "it" && (tr || sec)) {
    e.preventDefault();
    limparMarcaSoltar();
    if (tr && tr.dataset.rid !== arrastando.id) tr.classList.add("dropb");
    else if (!tr && sec) sec.classList.add("dropb");
  } else if (arrastando.t === "bl" && sec && +sec.dataset.bi !== arrastando.bi) {
    e.preventDefault();
    limparMarcaSoltar();
    sec.classList.add("dropb");
  }
});

$("bl").addEventListener("drop", (e) => {
  if (!arrastando) return;
  e.preventDefault();
  const tr = e.target.closest("tr[data-rid]"),
    sec = e.target.closest("section.bl"),
    arr = estado.disc[estado.tab];
  let mv = false;
  if (arrastando.t === "it" && sec) {
    const tb = arr[+sec.dataset.bi];
    let from = null,
      item = null;
    arr.forEach((b) => {
      const k = b.it.findIndex((x) => x.id === arrastando.id);
      if (k >= 0) {
        from = b;
        item = b.it.splice(k, 1)[0];
      }
    });
    if (item) {
      if (tr && tr.dataset.rid !== arrastando.id) {
        const ti = tb.it.findIndex((x) => x.id === tr.dataset.rid);
        tb.it.splice(ti < 0 ? tb.it.length : ti, 0, item);
      } else tb.it.push(item);
      mv = true;
    }
  } else if (arrastando.t === "bl" && sec) {
    const tgt = arr[+sec.dataset.bi],
      m = arr.splice(arrastando.bi, 1)[0];
    arr.splice(arr.indexOf(tgt), 0, m);
    mv = true;
  }
  arrastando = null;
  limparMarcaSoltar();
  if (mv) {
    desenhar();
    salvar();
  }
});

$("bl").addEventListener("dragend", () => {
  arrastando = null;
  limparMarcaSoltar();
  document.querySelectorAll(".dragging").forEach((x) => x.classList.remove("dragging"));
});

document.addEventListener("keydown", (e) => {
  if (telaAtual !== "etapa" || (janela && $("wd").open)) return;
  const t = e.target;
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const k = e.key;
    if (k === "[") {
      estado.disc[estado.tab].forEach((b) => pavimentosRecolhidos.add(chaveRecolhido(b)));
      salvarRecolhidos();
      desenhar();
      e.preventDefault();
      return;
    }
    if (k === "]") {
      estado.disc[estado.tab].forEach((b) => pavimentosRecolhidos.delete(chaveRecolhido(b)));
      salvarRecolhidos();
      desenhar();
      e.preventDefault();
      return;
    }
    if (k === "n" || k === "N") {
      const sec = t.closest && t.closest("section.bl");
      let bi = sec ? +sec.dataset.bi : estado.disc[estado.tab].findIndex((b) => !ehBlocoApontamentos(b.n));
      if (bi < 0) bi = 0;
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      adicionarAtividadeEm(bi);
      return;
    }
  }
  if (
    e.key === "Enter" &&
    !e.shiftKey &&
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    t.dataset &&
    (t.dataset.f === "d" || t.dataset.f === "ap")
  ) {
    e.preventDefault();
    const tr = t.closest("tr"),
      sec = t.closest("section.bl"),
      rows = [...tr.closest("tbody").querySelectorAll("tr[data-rid]")],
      k = rows.indexOf(tr);
    if (k < rows.length - 1) {
      const nx = rows[k + 1].querySelector('[data-f="d"],[data-f="ap"]');
      if (nx) {
        nx.focus();
        if (nx.select) nx.select();
      }
    } else {
      t.blur();
      adicionarAtividadeEm(+sec.dataset.bi);
    }
  }
});

// ---------- Filtro por pavimento (lista de valores, como no Excel) ----------

let popFiltro = null; // { bi, campo }

function fecharFiltroBloco() {
  popFiltro = null;
  const p = $("fpop");
  if (p) p.remove();
}

function abrirFiltroBloco(bi, campo, botao) {
  fecharFiltroBloco();
  const b = estado.disc[estado.tab][bi];
  if (!b) return;
  popFiltro = { bi, campo };
  const atual = filtroDoBloco(b)[campo],
    cont = new Map();
  b.it.forEach((i) => {
    const v = campo === "s" ? i.s : (campo === "c" ? i.c : i.r) || "";
    cont.set(v, (cont.get(v) || 0) + 1);
  });
  // status na ordem do cadastro de status; datas da mais antiga para a mais nova e
  // responsáveis em ordem alfabética, com os vazios no fim
  let valores = [...cont.keys()];
  if (campo === "s") valores.sort((x, y) => nomesStatus.indexOf(x) - nomesStatus.indexOf(y));
  else valores.sort((x, y) => (!x ? 1 : !y ? -1 : x.localeCompare(y)));
  const rot = (v) =>
      campo === "r" && !v ? "(Sem responsável)" : campo === "c" ? (v ? dataBR(v) : "(Sem data)") : v,
    marcado = (v) => !atual || atual.includes(v),
    p = document.createElement("div");
  p.id = "fpop";
  p.className = "fpop";
  p.setAttribute("role", "dialog");
  p.innerHTML =
    `<b>${NOMES_FILTRO[campo]} · ${escaparHtml(b.n)}</b>` +
    `<label class="fpall"><input type="checkbox" data-fpall${valores.every(marcado) ? " checked" : ""}> (Selecionar tudo)</label>` +
    `<div class="fplist">${
      valores
        .map(
          (v) =>
            `<label><input type="checkbox" data-fpv="${escaparHtml(v)}"${marcado(v) ? " checked" : ""}>` +
            `<span class="${campo === "s" ? classeCorStatus(v) : ""}">${escaparHtml(rot(v))}</span><span class="note" style="margin:0">${cont.get(v)}</span></label>`,
        )
        .join("") || '<span class="note">Sem atividades.</span>'
    }</div>` +
    `<div class="df" style="justify-content:flex-end"><button data-fpclr>Limpar</button><button class="p" data-fpok>OK</button></div>`;
  document.body.appendChild(p);
  const r = botao.getBoundingClientRect(),
    w = p.offsetWidth;
  p.style.top = r.bottom + window.scrollY + 4 + "px";
  p.style.left =
    Math.max(8, Math.min(r.right + window.scrollX - w, window.scrollX + innerWidth - w - 8)) + "px";
  const pr = p.querySelector("[data-fpv]");
  if (pr) pr.focus();
}

function aplicarFiltroBloco(valores) {
  if (!popFiltro) return;
  const b = estado.disc[estado.tab][popFiltro.bi];
  if (!b) return fecharFiltroBloco();
  const k = chaveRecolhido(b),
    f = { ...(filtrosBloco[k] || {}) };
  f[popFiltro.campo] = valores;
  if (!f.s && !f.r && !f.c) delete filtrosBloco[k];
  else filtrosBloco[k] = f;
  salvarFiltrosBloco();
  fecharFiltroBloco();
  desenhar();
}

acao("data-fb", (v, botao) => {
  const [bi, campo] = String(v).split(":");
  if (popFiltro && popFiltro.bi === +bi && popFiltro.campo === campo) return fecharFiltroBloco();
  abrirFiltroBloco(+bi, campo, botao);
});

acao("data-fpok", () => {
  const caixas = [...document.querySelectorAll("#fpop [data-fpv]")],
    marcados = caixas.filter((x) => x.checked).map((x) => x.dataset.fpv);
  // tudo marcado = sem filtro
  aplicarFiltroBloco(marcados.length === caixas.length ? null : marcados);
});

acao("data-fpclr", () => aplicarFiltroBloco(null));

// "Limpar filtro" do pavimento (as duas colunas)
acao("data-fbclr", (bi) => {
  const b = estado.disc[estado.tab][+bi];
  if (b) limparFiltrosDoBloco(b);
  fecharFiltroBloco();
  desenhar();
});

// "(Selecionar tudo)" marca ou desmarca todos; marcar um a um atualiza o "Selecionar tudo"
document.addEventListener("change", (e) => {
  const t = e.target;
  if (!t.closest || !t.closest("#fpop")) return;
  const caixas = [...document.querySelectorAll("#fpop [data-fpv]")];
  if (t.dataset.fpall !== undefined) caixas.forEach((x) => (x.checked = t.checked));
  else document.querySelector("#fpop [data-fpall]").checked = caixas.every((x) => x.checked);
});

// Fecha a lista ao clicar fora dela ou com Esc; Enter aplica
document.addEventListener("mousedown", (e) => {
  if (popFiltro && !e.target.closest("#fpop") && !e.target.closest("[data-fb]")) fecharFiltroBloco();
});
document.addEventListener("keydown", (e) => {
  if (!popFiltro) return;
  if (e.key === "Escape") fecharFiltroBloco();
  else if (e.key === "Enter" && e.target.closest && e.target.closest("#fpop")) {
    e.preventDefault();
    document.querySelector("#fpop [data-fpok]").click();
  }
});
