// Janelas (status, calendário, atalhos, modelos), disciplinas e tema

const NOMES_TEMA = { a: "◐ Automático", l: "☀ Claro", d: "🌙 Escuro" };

let tema = "a";

try {
  tema = localStorage.getItem("pht") || "a";
} catch (e) {}

function aplicarTema() {
  const r = document.documentElement;
  if (tema === "l") r.setAttribute("data-theme", "light");
  else if (tema === "d") r.setAttribute("data-theme", "dark");
  else r.removeAttribute("data-theme");
  const b = $("thm");
  if (b) {
    b.textContent = "Tema: " + NOMES_TEMA[tema];
    b.title = "Alternar entre automático, claro e escuro";
  }
  document.querySelectorAll(".thm2").forEach((x) => (x.textContent = NOMES_TEMA[tema]));
}

aplicarTema();

let janela = null,
  statusEmEdicao = [],
  janelaTexto = null;

function abrirJanela(kind, arg) {
  janela = { kind, arg };
  desenharJanela();
  const d = $("wd");
  if (!d.open) d.showModal();
}

const fecharJanela = () => {
  const d = $("wd");
  if (d.open) d.close();
};

$("wd").addEventListener("close", () => {
  janela = null;
  if (idProjetoAberto) desenhar();
});

$("wd").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.stc !== undefined) {
    t.className = "sst pc" + t.value;
  }
});

function usoDoStatus(n) {
  let c = 0;
  percorrerAtividades(estado, (i) => {
    if (i.s === n) c++;
  });
  return c;
}

function lerStatusDaJanela() {
  document.querySelectorAll("[data-stn]").forEach((el) => {
    const k = +el.dataset.stn;
    if (statusEmEdicao[k]) statusEmEdicao[k].n = el.value;
  });
  document.querySelectorAll("[data-str]").forEach((el) => {
    const k = +el.dataset.str;
    if (statusEmEdicao[k]) statusEmEdicao[k].r = el.value;
  });
  document.querySelectorAll("[data-stc]").forEach((el) => {
    const k = +el.dataset.stc;
    if (statusEmEdicao[k]) statusEmEdicao[k].c = +el.value;
  });
}

function desenharJanela() {
  if (!janela) return;
  const k = janela.kind;
  let t = "",
    h = "";
  if (k === "std") {
    t = "Status das atividades";
    if (!statusEmEdicao.length || janela.fresh !== false) {
      statusEmEdicao = statusAtuais.map((x) => ({ o: x.n, n: x.n, r: x.r, c: x.c }));
      janela.fresh = false;
    }
    h =
      `<p class="note">Cada status tem um <b>comportamento</b>, que define como ele entra nos cálculos: “Concluído” conta como feito e preenche a data de conclusão, “Sem ação” fica fora dos totais, “Em andamento” é marcado ao dar play, e “Falta publicar” deixa a linha em azul. Você pode renomear, mudar a cor ou criar novos status com qualquer comportamento.</p>` +
      `<table class="ett"><thead><tr><th>Nome</th><th>Comportamento</th><th>Cor</th>` +
      `<th></th></tr></thead><tbody>${statusEmEdicao
        .map(
          (x, i) =>
            `<tr><td><input data-stn="${i}" value="${escaparHtml(x.n)}" aria-label="Nome do status"></td>` +
            `<td><select data-str="${i}" aria-label="Comportamento">${Object.entries(COMPORTAMENTOS)
              .map(([v, l]) => `<option value="${v}"${x.r === v ? " selected" : ""}>${l}</option>`)
              .join("")}</select></td>` +
            `<td><select class="sst pc${x.c}" data-stc="${i}" aria-label="Cor">${NOMES_CORES.map((n, j) => `<option value="${j}" class="pc${j}"${x.c === j ? " selected" : ""}>${n}</option>`).join("")}</select></td>` +
            `<td><button data-stdel="${i}" title="Excluir status" aria-label="Excluir status">×</button></td></tr>`,
        )
        .join("")}</tbody></table>` +
      `<div class="df" style="justify-content:flex-start"><button data-stadd>+ Adicionar status</button></div>` +
      `<p class="note" id="stm">${escaparHtml(janela.msg || "")}</p><div class="df" style="justify-content:flex-end">` +
      `<button data-dclose>Cancelar</button><button class="p" data-stsave>Salvar status</button></div>`;
  } else if (k === "cal") {
    t = "Calendário de trabalho";
    const c = calendario(),
      dn = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    h =
      `<p class="note">Os dias úteis e as folgas são usados na <b>previsão de término</b> das etapas e nas faixas de dias sem trabalho do cronograma. Horas produtivas por dia: <b>${estado.hd}h</b> (campo “Horas/dia” no topo).</p>` +
      `<div class="df" style="justify-content:flex-start;flex-wrap:wrap"><b>Dias de trabalho:</b>${dn.map((n, i) => `<label><input type="checkbox" data-caldia="${i}"${c.dias.includes(i) ? " checked" : ""}> ${n}</label>`).join("")}</div>` +
      `<b>Feriados, férias e folgas</b><table class="ett"><thead><tr><th>Descrição</th>` +
      `<th>Início</th><th>Fim</th><th></th></tr></thead><tbody>${
        [...c.ev]
          .sort((a, b) => String(a.ini).localeCompare(String(b.ini)))
          .map(
            (e) =>
              `<tr><td>${escaparHtml(e.nome)}</td><td>${dataBR(e.ini)}</td><td>${dataBR(e.fim || e.ini)}</td>` +
              `<td><button data-calrm="${escaparHtml(e.id)}" aria-label="Remover">×</button></td></tr>`,
          )
          .join("") ||
        '<tr><td colspan="4"><span class="note">Nenhum feriado ou folga cadastrado.</span></td></tr>'
      }</tbody></table>` +
      `<div class="df" style="justify-content:flex-start;flex-wrap:wrap"><input id="cevn" placeholder="Descrição (ex.: Férias)" aria-label="Descrição">` +
      `<input type="date" id="cevi" aria-label="Início"><input type="date" id="cevf" aria-label="Fim (opcional)">` +
      `<button data-caladd>+ Adicionar</button></div><div class="df" style="justify-content:flex-start;flex-wrap:wrap">` +
      `<label>Feriados nacionais de <input type="number" id="cfy" min="2020" max="2100" value="${new Date().getFullYear()}" style="width:90px"></label>` +
      `<button data-calfer>Adicionar feriados nacionais</button></div><p class="note">${escaparHtml(janela.msg || "")}</p>`;
  } else if (k === "kbd") {
    t = "Atalhos de teclado";
    h =
      `<table class="ett"><tbody><tr><td><b>Enter</b> numa atividade</td><td>Vai para a atividade de baixo. Na última do pavimento, cria uma nova já pronta para digitar.</td></tr>` +
      `<tr><td><b>Alt + N</b></td><td>Nova atividade no pavimento da linha em que você está (ou no primeiro).</td></tr>` +
      `<tr><td><b>Alt + [</b></td><td>Recolher todos os pavimentos da disciplina.</td></tr>` +
      `<tr><td><b>Alt + ]</b></td><td>Expandir todos os pavimentos da disciplina.</td></tr>` +
      `<tr><td><b>Ctrl + Z</b> / <b>Ctrl + Y</b></td><td>Desfazer e refazer (fora dos campos de texto).</td></tr>` +
      `<tr><td><b>Arrastar ⋮⋮</b></td><td>Reordena atividades e pavimentos.</td></tr></tbody></table>`;
  } else if (k === "ind") {
    t = janelaTexto.title;
    h =
      `<label>${escaparHtml(janelaTexto.label)} <input id="indv" value="${escaparHtml(janelaTexto.val || "")}" style="flex:1"></label>${janelaTexto.extra || ""}<p class="note">${escaparHtml(janela.msg || "")}</p>` +
      `<div class="df" style="justify-content:flex-end"><button data-dclose>Cancelar</button>` +
      `<button class="p" data-indok>OK</button></div>`;
  } else if (
    k === "rpl" ||
    k === "tpl" ||
    k === "hist" ||
    k === "cad" ||
    k === "dadd" ||
    k === "pend" ||
    k === "gcal" ||
    k === "pe"
  ) {
    const f = {
      rpl: janelaReplicar,
      tpl: janelaModelos,
      hist: janelaHistorico,
      cad: janelaCadastros,
      dadd: janelaNovaDisciplina,
      pend: janelaPendencias,
      gcal: janelaAgenda,
      pe: janelaResponsaveis,
    }[k];
    if (f) {
      const r = f();
      t = r[0];
      h = r[1];
    }
  }
  $("wdt").textContent = t;
  $("wdb").innerHTML = h;
}

function abrirJanelaTexto(o) {
  janelaTexto = o;
  abrirJanela("ind");
}

// ---------- Ações dos botões: janelas, disciplinas e tema ----------

acao("data-dlg", (k) => {
  janela = { kind: k };
  if (k === "std") statusEmEdicao = [];
  abrirJanela(k, null);
});
acao("data-dclose", () => fecharJanela());

// Janela de texto (indOpen): botão OK
acao("data-indok", () => {
  const m = janelaTexto.ok($("indv").value);
  if (m) {
    janela.msg = m;
    return desenharJanela();
  }
  fecharJanela();
});

// Janela de status
acao(
  "data-stadd",
  () => {
    lerStatusDaJanela();
    statusEmEdicao.push({ o: null, n: "Novo status", r: "pend", c: 5 });
    desenharJanela();
  },
  { janela: true },
);

acao(
  "data-stdel",
  (v) => {
    lerStatusDaJanela();
    const k = +v,
      x = statusEmEdicao[k],
      u = x.o ? usoDoStatus(x.o) : 0;
    if (u) {
      janela.msg =
        'O status "' +
        x.o +
        '" está em uso por ' +
        u +
        " atividade(s). Renomeie-o ou mude essas atividades antes de excluir.";
      return desenharJanela();
    }
    statusEmEdicao.splice(k, 1);
    desenharJanela();
  },
  { janela: true },
);

acao(
  "data-stsave",
  () => {
    lerStatusDaJanela();
    const names = statusEmEdicao.map((x) => x.n.trim()),
      erro = (m) => {
        janela.msg = m;
        desenharJanela();
      };
    if (names.some((n) => !n)) return erro("Todo status precisa de um nome.");
    if (new Set(names.map(normalizar)).size !== names.length) return erro("Há dois status com o mesmo nome.");
    if (!statusEmEdicao.some((x) => x.r === "pend") || !statusEmEdicao.some((x) => x.r === "ok"))
      return erro("É preciso manter ao menos um status “Em aberto” e um “Concluído”.");
    // status renomeados: atualiza as atividades e o filtro
    const map = {};
    statusEmEdicao.forEach((x) => {
      if (x.o && x.o !== x.n.trim()) map[x.o] = x.n.trim();
    });
    percorrerAtividades(estado, (i) => {
      if (map[i.s]) i.s = map[i.s];
    });
    // filtros dos pavimentos: troca os nomes renomeados e tira os status excluídos
    for (const k in filtrosBloco) {
      const f = filtrosBloco[k];
      if (f.s) f.s = f.s.map((n) => map[n] || n).filter((n) => names.includes(n));
    }
    salvarFiltrosBloco();
    estado.status = statusEmEdicao.map((x) => ({ n: x.n.trim(), r: x.r, c: x.c }));
    definirStatus(estado.status);
    statusEmEdicao = [];
    fecharJanela();
    desenhar();
    salvar();
  },
  { janela: true },
);

// Janela do calendário
acao(
  "data-caladd",
  () => {
    const n = $("cevn").value.trim(),
      a = $("cevi").value,
      b = $("cevf").value;
    if (!n || !a) janela.msg = "Informe a descrição e a data de início.";
    else if (b && b < a) janela.msg = "O fim não pode ser antes do início.";
    else {
      calendario().ev.push({
        id: "v" + Math.random().toString(36).slice(2, 8),
        nome: n,
        ini: a,
        fim: b || a,
      });
      janela.msg = "";
      salvar();
    }
    desenharJanela();
  },
  { janela: true },
);

acao(
  "data-calrm",
  (id) => {
    const c = calendario();
    c.ev = c.ev.filter((e) => e.id !== id);
    desenharJanela();
    salvar();
  },
  { janela: true },
);

acao(
  "data-calfer",
  () => {
    const y = +$("cfy").value || new Date().getFullYear(),
      c = calendario();
    let n = 0;
    feriados(y).forEach((f) => {
      if (!c.ev.some((e) => e.ini === f.ini && normalizar(e.nome) === normalizar(f.nome))) {
        c.ev.push(f);
        n++;
      }
    });
    janela.msg = n + " feriado(s) de " + y + " adicionado(s).";
    desenharJanela();
    salvar();
  },
  { janela: true },
);

// Tema: automático → claro → escuro
function alternarTema() {
  tema = tema === "a" ? "l" : tema === "l" ? "d" : "a";
  try {
    localStorage.setItem("pht", tema);
  } catch (e) {}
  aplicarTema();
}
acao("#thm", alternarTema);
acao("data-thm", alternarTema); // item "Tema" do menu ⚙ Configurações

$("wd").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.caldia !== undefined) {
    const c = calendario(),
      d = +t.dataset.caldia;
    c.dias = c.dias.filter((x) => x !== d);
    if (t.checked) c.dias.push(d);
    c.dias.sort();
    salvar();
  }
});
