// Modelo JBLUE, escopos, cópias e biblioteca de modelos próprios

const MODELO_JBLUE = {
  ELT: [
    [
      "Geral",
      [
        ["Fazer planejamento", 2],
        ["Atualizar vínculos RVT arq./est.", 0.5],
        ["Pegar o checklist", 0.25],
        ["[PP] Repasse do Construflow", 2],
        ["[PP] Verificação de pendências de AP", 1],
        ["[PP] Modelagem da entrada de energia (eletrodutos enterrados)", 2.8333],
        ["[PP] Confirmar potências de bombas e equipamentos com HID", 0],
        ["[PP] Inserir luminárias e sinalizações de PCI", 2],
        ["[PP] DOC PRELIMINAR: RVT | IFC | DWG | PDF", 2],
        ["[PP] ENTREGA INTERNA: pranchas 1A, 2A e revisão da 2B", 3],
        ["Quadro de cargas dos aptos e áreas comuns (relatório para o RT)", 2],
        ["Pontos da escada e tubulação", 2.5],
        ["Pontos do poço do elevador", 1],
      ],
    ],
    [
      "Subsolo",
      [
        ["Reservatório inferior: quadro, tomadas, iluminação, bombas", 2],
        ["Inserir pontos: iluminação e tomadas", 1.5],
        ["Inserir comandos | circuitos", 0.6667],
        ["Modelagem dos eletrodutos", 2.3333],
        ["Planta de recarga: conferir pontos", 2],
      ],
    ],
    [
      "1º Pavimento Térreo",
      [
        ["Inserir pontos: iluminação e tomadas", 1.5],
        ["Inserir comandos | circuitos", 0.6667],
        ["Modelagem dos eletrodutos", 2.3333],
      ],
    ],
    [
      "1º Pavimento Mezanino",
      [
        ["Inserir pontos: iluminação e tomadas", 1.5],
        ["Inserir comandos | circuitos", 0.6667],
        ["Modelagem dos eletrodutos", 2.3333],
      ],
    ],
    [
      "Pavimento Tipo (2º ao 8º)",
      [
        ["TIPO 01: importar arquivos e inserir pontos", 1],
        ["TIPO 01: comandos, circuitos e eletrodutos", 0.8333],
        ["TIPO 02: pontos, comandos, circuitos e eletrodutos", 1.5],
        ["TIPO 03: pontos, comandos, circuitos e eletrodutos", 1.5],
        ["TIPO 04: pontos, comandos, circuitos e eletrodutos", 1.5],
        ["TIPO 05 (parecido com o 01)", 0.5],
        ["TIPO 06 (espelhar o 02 e corrigir)", 0.3333],
      ],
    ],
    [
      "Entrepiso (pav. técnico)",
      [
        ["Pontos, comandos e eletrodutos", 1.5],
        ["Verificar pontos das demais disciplinas (apontamento #4492)", 2.5],
      ],
    ],
    [
      "Cobertura",
      [
        ["Inserir pontos: iluminação e tomadas", 1.5],
        ["Inserir comandos | circuitos", 0.6667],
        ["Modelagem dos eletrodutos", 2.3333],
      ],
    ],
    [
      "Barrilete | Reservatório",
      [
        ["Inserir pontos: iluminação, tomadas e TUE", 0.6667],
        ["Inserir comandos | circuitos", 0.5],
        ["Modelagem dos eletrodutos", 1],
      ],
    ],
    [
      "Apontamentos a atender",
      [
        ["7446 Tomadas de veículos elétricos: alimentar 1 vaga", 1],
        ["2996 Posição do quadro de transferência automática (QTA)", 0.3333],
        ["9628 Informações elétricas dos equipamentos de renovação, exaustão e loja", 2],
        ["8110 Alimentação de bombas e luminárias", 1],
        ["4110 [CQP-AP] Elétrica pós CQM: verificar ajustes", 6],
        ["8200 [CQP-AJAP] Projeto elétrico: conferir ajustes", 3],
        ["7453 [CQP] Informações importantes: analisar", 2],
        ["6375 Monitoramento de bombas e extravasão", 2],
        ["2916 Demanda de energia: novo cálculo após lojas", 2],
        ["7038 Infras das lojas/salas comerciais", 2],
        ["5097 Veículos elétricos: alimentar pontos", 1.5],
      ],
    ],
  ],
  TEL: [
    [
      "Geral",
      [
        ["Atualizar vínculos de projeto", 0.3333],
        ["Repasse Construflow ou similar", 0.5],
        ["Planejamento da etapa", 0.3333],
        ["Verificação de pendências de AP", 0.3333],
        ["Modelagem dos eletrodutos (entrada de dados)", 0.5],
        ["DOC PRELIMINAR", 1],
        ["Checklist", 0.3333],
      ],
    ],
    ["Subsolo", []],
    ["Térreo", []],
    ["Pavimento Tipo", []],
    ["Apontamentos a atender", []],
  ],
};

let contadorModelo = 0;

const criarModeloJblue = () => {
  contadorModelo = 0;
  const o = {};
  for (const k in MODELO_JBLUE)
    o[k] = MODELO_JBLUE[k].map(([n, it]) => ({
      n,
      it: it.map(([d, e]) => ({ id: "a" + ++contadorModelo, d, r: "Shirley", s: "Pendente", e, u: 0 })),
    }));
  return { hd: 7, tab: "ELT", run: null, disc: o };
};

function dadosNovoProjeto(tpl, etNome) {
  // em branco: só o nome; etapas e disciplinas são adicionadas depois, pelos cadastros
  if (tpl === "vazio")
    return { versao: VERSAO_DADOS, hd: 7, run: null, pe: RESPONSAVEIS_PADRAO.slice(), etapas: [] };
  if (tpl.startsWith("copy:") && projetos[tpl.slice(5)]) {
    // cópia: mesma estrutura; zera usado, registro diário, status, conclusão e datas;
    // mantém estimado e responsável; descarta comentários e os apontamentos (são de cada obra)
    const x = carregarEstado(projetos[tpl.slice(5)].j, projetos[tpl.slice(5)].etapa);
    x.run = null;
    x.etapas.forEach((e) => ((e.ini = ""), (e.fim = "")));
    percorrerBlocos(x, (b) => {
      if (ehBlocoApontamentos(b.n)) b.it = [];
      else
        b.it.forEach((i) => {
          i.u = 0;
          i.lg = [];
          delete i.ss;
          i.s = statusComComportamento("pend");
          i.c = "";
          i.cm = [];
          if (i.l) i.l.forEach((a) => (a.c = false));
        });
    });
    return x;
  }
  const sid = tpl === "jblue" || tpl === "jblue-pav" ? tpl : "blank",
    et = {
      id: novoIdEtapa(),
      nome: etNome || "Etapa 1",
      escopo: nomeDoEscopo(sid),
      escopoId: sid,
      tab: "",
      disc: {},
    };
  mesclarEscopo(et, disciplinasDoEscopo(sid));
  return converterParaNovo({ hd: 7, run: null, etapas: [et] });
}

const ESCOPOS = [
  { id: "blank", nome: "Em branco (ELT e TEL: Geral e Apontamentos)" },
  { id: "jblue", nome: "Modelo JBLUE: pavimentos e atividades (ELT + TEL)" },
  { id: "jblue-pav", nome: "Modelo JBLUE: somente pavimentos (ELT + TEL)" },
];

const disciplinaEmBranco = () => [
  { n: "Geral", it: [] },
  { n: "Apontamentos a atender", it: [] },
];

const zerarAtividades = (d) => {
  for (const k in d)
    d[k].forEach((b) => {
      if (ehBlocoApontamentos(b.n)) b.it = [];
      else
        b.it.forEach((i) => {
          i.u = 0;
          i.lg = [];
          delete i.ss;
          i.s = statusComComportamento("pend");
          i.c = "";
          i.cm = [];
          if (i.l) i.l.forEach((a) => (a.c = false));
        });
    });
  return d;
};

function disciplinasDoEscopo(sid) {
  if (sid.startsWith("tpl:")) {
    const t = modelosSalvos[sid.slice(4)];
    return t ? JSON.parse(t.j).disc : {};
  }
  if (sid === "jblue") return criarModeloJblue().disc;
  if (sid === "jblue-pav") {
    const d = criarModeloJblue().disc;
    for (const k in d) d[k].forEach((b) => (b.it = []));
    return d;
  }
  return { ELT: disciplinaEmBranco(), TEL: disciplinaEmBranco() };
}

function nomeDoEscopo(sid) {
  if (sid.startsWith("tpl:")) {
    const t = modelosSalvos[sid.slice(4)];
    return t ? "Meu modelo: " + t.nome : "";
  }
  return (ESCOPOS.find((x) => x.id === sid) || {}).nome || "";
}

function mesclarEscopo(et, disc) {
  let nb = 0,
    na = 0,
    sk = 0;
  for (const d in disc) {
    if (!et.disc[d]) et.disc[d] = [];
    for (const b of disc[d]) {
      let tb = et.disc[d].find((x) => normalizar(x.n) === normalizar(b.n));
      if (!tb) {
        tb = { n: b.n, it: [] };
        et.disc[d].push(tb);
        nb++;
      }
      for (const it of b.it) {
        if (tb.it.some((x) => normalizar(x.d) === normalizar(it.d))) {
          sk++;
          continue;
        }
        tb.it.push(Object.assign({}, it, { id: novoIdAtividade(), s: statusComComportamento("pend") }));
        na++;
      }
    }
  }
  if (!et.tab || !et.disc[et.tab]) et.tab = Object.keys(et.disc)[0];
  return { nb, na, sk };
}

function clonarAtividade(i) {
  const c = JSON.parse(JSON.stringify(i));
  c.id = novoIdAtividade();
  c.s = statusComComportamento("pend");
  c.u = 0;
  c.lg = [];
  delete c.ss;
  c.c = "";
  c.cm = [];
  if (c.l) c.l.forEach((a) => (a.c = false));
  delete c.dep;
  return c;
}

function replicar(bi, alvos, trocar) {
  const src = estado.disc[estado.tab][bi];
  let add = 0,
    sk = 0;
  alvos.forEach((ti) => {
    const tb = estado.disc[estado.tab][ti];
    if (!tb || tb === src) return;
    src.it.forEach((i) => {
      let d = i.d;
      if (trocar && src.n) {
        const re = new RegExp(src.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        d = d.replace(re, tb.n);
      }
      if (tb.it.some((x) => normalizar(x.d) === normalizar(d))) {
        sk++;
        return;
      }
      const c = clonarAtividade(i);
      c.d = d;
      c.ds = "";
      c.dp = "";
      tb.it.push(c);
      add++;
    });
  });
  return { add, sk };
}

function janelaReplicar() {
  const src = estado.disc[estado.tab][janela.arg];
  if (!src) return ["Replicar atividades", "<p class='note'>Pavimento não encontrado.</p>"];
  if (ehBlocoApontamentos(src.n))
    return [
      "Replicar atividades",
      "<p class='note'>Os apontamentos são específicos de cada projeto e não são replicados.</p><div class='df'><button data-dclose>Fechar</button></div>",
    ];
  const outros = estado.disc[estado.tab]
    .map((b, i) => ({ b, i }))
    .filter((x) => x.b !== src && !ehBlocoApontamentos(x.b.n));
  return [
    "Replicar atividades de “" + src.n + "”",
    `<p class="note">Copia as <b>${src.it.length} atividade(s)</b> deste pavimento para os pavimentos marcados. São copiados a descrição, o responsável, as horas estimadas, a prioridade e o checklist. Status, tempo usado, datas e comentários começam do zero. Atividades que já existem no destino (mesma descrição) são ignoradas.</p>` +
      `<div class="df" style="justify-content:flex-start;flex-wrap:wrap"><input id="rpf" placeholder="Marcar pavimentos cujo nome contenha… (ex.: Tipo)" style="min-width:280px">` +
      `<button data-rplmark>Marcar</button><button data-rplall>Marcar todos</button>` +
      `<button data-rplnone>Limpar</button></div><div class="epl">${outros.map((x) => `<label class="epc"><input type="checkbox" data-rplc="${x.i}"> ${escaparHtml(x.b.n)} <span class="note" style="margin:0">(${x.b.it.length})</span></label>`).join("") || '<span class="note">Não há outros pavimentos nesta disciplina.</span>'}</div>` +
      `<label><input type="checkbox" id="rpr" checked> Trocar o nome “${escaparHtml(src.n)}” pelo nome do pavimento de destino nas descrições</label>` +
      `<p class="note">${escaparHtml(janela.msg || "")}</p><div class="df" style="justify-content:flex-end">` +
      `<button data-dclose>Fechar</button><button class="p" data-rplrun>Replicar</button></div>`,
  ];
}

let modelosSalvos = {};

try {
  modelosSalvos = JSON.parse(localStorage.getItem("phtpl") || "{}");
} catch (e) {}

let modelosSincronizados = false,
  cacheHistorico = null,
  horaCacheHistorico = 0,
  historicoDesatualizado = true;

const salvarModelosLocal = () => {
  try {
    localStorage.setItem("phtpl", JSON.stringify(modelosSalvos));
  } catch (e) {}
};

async function salvarModelo(t) {
  modelosSalvos[t.id] = t;
  salvarModelosLocal();
  if (banco) {
    try {
      await banco.doc("templates/" + t.id).set({ nome: t.nome, tipo: t.tipo, j: t.j, upd: t.upd });
    } catch (e) {}
  }
}

async function excluirModelo(id) {
  delete modelosSalvos[id];
  salvarModelosLocal();
  if (banco) {
    try {
      await banco.doc("templates/" + id).delete();
    } catch (e) {}
  }
}

const limparParaModelo = (disc) => {
  zerarAtividades(disc);
  for (const d in disc)
    disc[d].forEach((b) =>
      b.it.forEach((i) => {
        i.ds = "";
        i.dp = "";
        delete i.dep;
        i.cm = [];
      }),
    );
  return disc;
};

function criarModelo(tipo, nome, data) {
  const t = {
    id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    nome,
    tipo,
    j: JSON.stringify(data),
    upd: Date.now(),
  };
  salvarModelo(t);
  return t;
}

const listarModelos = (tipo) =>
  Object.values(modelosSalvos)
    .filter((t) => t.tipo === tipo)
    .sort((a, b) => a.nome.localeCompare(b.nome));

function salvarPavimentoComoModelo(bi, nome) {
  const c = JSON.parse(JSON.stringify(estado.disc[estado.tab][bi])),
    disc = limparParaModelo({ [estado.tab]: [c] });
  criarModelo("pavimento", nome, { d: estado.tab, b: disc[estado.tab][0] });
}

function adicionarPavimentoDoModelo(id) {
  const t = modelosSalvos[id];
  if (!t) return null;
  const x = JSON.parse(t.j),
    arr = estado.disc[estado.tab];
  let tb = arr.find((b) => normalizar(b.n) === normalizar(x.b.n)),
    add = 0,
    sk = 0;
  if (!tb) {
    tb = { n: x.b.n, it: [] };
    arr.push(tb);
  }
  x.b.it.forEach((i) => {
    if (tb.it.some((q) => normalizar(q.d) === normalizar(i.d))) {
      sk++;
      return;
    }
    tb.it.push(Object.assign({}, i, { id: novoIdAtividade(), s: statusComComportamento("pend") }));
    add++;
  });
  return { add, sk, n: tb.n };
}

function atualizarSeletorModelos() {
  const el = $("nbt"),
    kv = el.value;
  el.innerHTML =
    '<option value="">Adicionar pavimento de um modelo…</option>' +
    listarModelos("pavimento")
      .map((t) => `<option value="${t.id}">${escaparHtml(t.nome)}</option>`)
      .join("");
  el.value = kv && modelosSalvos[kv] ? kv : "";
}

function janelaModelos() {
  const L = Object.values(modelosSalvos).sort(
    (a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome),
  );
  return [
    "Meus modelos",
    `<p class="note">Salve um <b>pavimento</b> (botão 💾 no cabeçalho dele) como modelo, com as atividades e as horas estimadas, e use-o em qualquer projeto em “+ Pavimento do modelo”. Status, tempo usado, datas e comentários não entram no modelo. As listas de atividades de cada etapa e disciplina ficam em <b>Cadastros</b>; modelos de etapa antigos podem ser levados para lá com “Trazer etapas de Meus modelos”.</p>` +
      `<table class="ett"><thead><tr><th>Nome</th><th>Tipo</th><th>Conteúdo</th>` +
      `<th></th></tr></thead><tbody>${
        L.map((t) => {
          let c = "";
          try {
            const x = JSON.parse(t.j);
            c =
              t.tipo === "pavimento"
                ? x.b.it.length + " atividade(s) · disciplina " + escaparHtml(x.d)
                : Object.keys(x.disc)
                    .map((d) => escaparHtml(d) + ": " + x.disc[d].length + " pav.")
                    .join(" · ") +
                  " · " +
                  Object.values(x.disc)
                    .flat()
                    .reduce((a, b) => a + b.it.length, 0) +
                  " atividade(s)";
          } catch (e) {}
          return (
            `<tr><td>${escaparHtml(t.nome)}</td><td>${t.tipo === "etapa" ? "Etapa" : "Pavimento"}</td>` +
            `<td>${c}</td><td><button data-tpldel="${escaparHtml(t.id)}" title="Excluir modelo" aria-label="Excluir modelo">×</button></td></tr>`
          );
        }).join("") || '<tr><td colspan="4"><span class="note">Nenhum modelo salvo ainda.</span></td></tr>'
      }</tbody></table>` +
      `<p class="note">${escaparHtml(janela.msg || "")}</p>`,
  ];
}

// ---------- Ações dos botões: modelos e replicar ----------

acao("data-svb", (v) => {
  const bi = +v,
    b = estado.disc[estado.tab][bi];
  if (ehBlocoApontamentos(b.n))
    return mostrarMensagem("Apontamentos são específicos de cada projeto e não viram modelo.");
  abrirJanelaTexto({
    title: "Salvar pavimento como modelo",
    label: "Nome do modelo",
    val: b.n,
    ok: (v) => {
      const n = v.trim();
      if (!n) return "Informe o nome.";
      salvarPavimentoComoModelo(bi, n);
      atualizarSeletorModelos();
      mostrarMensagem('Modelo de pavimento salvo: "' + n + '".');
      return "";
    },
  });
});

acao("#addbt", () => {
  const id = $("nbt").value;
  if (!id) return mostrarMensagem("Escolha um modelo de pavimento.");
  const r = adicionarPavimentoDoModelo(id);
  if (r) {
    mostrarMensagem(
      'Pavimento "' + r.n + '": ' + r.add + " atividade(s) adicionada(s); " + r.sk + " já existia(m).",
    );
    salvar();
    desenhar();
  }
});

acao("data-tpldel", (id) => {
  const tt = modelosSalvos[id];
  if (tt)
    confirmar('Excluir o modelo "' + tt.nome + '"?', async () => {
      await excluirModelo(id);
      if (janela && janela.kind === "tpl") desenharJanela();
      atualizarSeletorModelos();
    });
});

// Janela "Replicar atividades"
acao("data-rpl", (v) => abrirJanela("rpl", +v));
const rplCaixas = () => document.querySelectorAll("[data-rplc]");
acao(
  "data-rplmark",
  () => {
    const q = normalizar($("rpf").value);
    if (!q) return;
    rplCaixas().forEach((c) => {
      const b = estado.disc[estado.tab][+c.dataset.rplc];
      if (b && normalizar(b.n).includes(q)) c.checked = true;
    });
  },
  { janela: true },
);
acao("data-rplall", () => rplCaixas().forEach((c) => (c.checked = true)), { janela: true });
acao("data-rplnone", () => rplCaixas().forEach((c) => (c.checked = false)), { janela: true });
acao(
  "data-rplrun",
  () => {
    const al = [...document.querySelectorAll("[data-rplc]:checked")].map((c) => +c.dataset.rplc);
    if (!al.length) {
      janela.msg = "Marque ao menos um pavimento de destino.";
      return desenharJanela();
    }
    const r = replicar(janela.arg, al, $("rpr").checked);
    janela.msg =
      r.add +
      " atividade(s) criada(s) em " +
      al.length +
      " pavimento(s); " +
      r.sk +
      " já existia(m) e foi(ram) ignorada(s).";
    desenharJanela();
    salvar();
  },
  { janela: true },
);

// ---------- Pendências de outra etapa ----------
// Traz para a disciplina aberta as atividades não concluídas (nem "sem ação") da mesma
// disciplina em outra etapa, num bloco "Pendências da etapa <nome>". As atividades
// originais não mudam; as cópias começam do zero (sem horas usadas, sem comentários),
// com o estimado igual ao que restava, e guardam a origem em "po" para não repetir.

const NOME_BLOCO_PENDENCIAS = "Pendências da etapa ";

// Etapas (fora a aberta) que têm a disciplina aberta: [{ ei, e, d, pend }]
function etapasComPendencias() {
  const nome = normalizar(estado.tab),
    jaPuxadas = new Set(estado.disc[estado.tab].flatMap((b) => b.it.map((i) => i.po).filter(Boolean)));
  return estado.etapas
    .map((e, ei) => {
      if (ei === estado.ei) return null;
      const d = e.disciplinas.find((x) => normalizar(x.nome) === nome);
      if (!d) return null;
      const pend = d.blocos
        .filter((b) => !ehBlocoApontamentos(b.n))
        .flatMap((b) =>
          b.it
            .filter((i) => !estaConcluido(i.s) && !estaSemAcao(i.s) && !jaPuxadas.has(i.id))
            .map((i) => ({ b, i })),
        );
      return { ei, e, d, pend };
    })
    .filter(Boolean);
}

function janelaPendencias() {
  const ops = etapasComPendencias();
  if (!ops.length)
    return [
      "Puxar pendências de outra etapa",
      `<p class="note">Nenhuma outra etapa deste projeto tem a disciplina ${escaparHtml(estado.tab)}.</p>` +
        `<div class="df" style="justify-content:flex-end"><button data-dclose>Fechar</button></div>`,
    ];
  if (janela.arg === undefined || !ops.some((o) => o.ei === janela.arg)) {
    const com = ops.find((o) => o.pend.length);
    janela.arg = (com || ops[0]).ei;
  }
  const o = ops.find((x) => x.ei === janela.arg),
    grupos = [];
  o.pend.forEach(({ b, i }) => {
    let g = grupos.find((x) => x.b === b);
    if (!g) grupos.push((g = { b, it: [] }));
    g.it.push(i);
  });
  return [
    "Puxar pendências de outra etapa",
    `<label class="df" style="justify-content:flex-start">Etapa <select id="pdet" aria-label="Etapa de origem">` +
      ops
        .map(
          (x) =>
            `<option value="${x.ei}"${x.ei === o.ei ? " selected" : ""}>${escaparHtml(x.e.nome)} · ${escaparHtml(estado.tab)} (${plural(x.pend.length, "pendente", "pendentes")})</option>`,
        )
        .join("") +
      `</select></label>` +
      (o.pend.length
        ? `<p class="note" style="margin:0">As atividades marcadas vão para o bloco <b>${escaparHtml(NOME_BLOCO_PENDENCIAS + o.e.nome)}</b> desta disciplina, com o estimado igual ao que restava. As originais na etapa ${escaparHtml(o.e.nome)} não mudam.</p>` +
          `<div class="df" style="justify-content:flex-start"><button data-pdtodas="1">Marcar todas</button><button data-pdtodas="0">Desmarcar todas</button></div>` +
          `<div class="pdlista">${grupos
            .map(
              (g) =>
                `<b>${escaparHtml(g.b.n)}</b>` +
                g.it
                  .map(
                    (i) =>
                      `<label><input type="checkbox" data-pdi="${escaparHtml(i.id)}" checked> <span>${escaparHtml(i.d || "(sem nome)")}</span>` +
                      `<span class="note" style="margin:0">${escaparHtml(i.s)} · resta ${fmtHoras(Math.max(0, i.e - i.u))}${i.r ? " · " + escaparHtml(i.r) : ""}</span></label>`,
                  )
                  .join(""),
            )
            .join("")}</div>`
        : `<p class="note">Nenhuma atividade pendente de ${escaparHtml(estado.tab)} na etapa ${escaparHtml(o.e.nome)}${o.d.blocos.some((b) => b.it.some((i) => !estaConcluido(i.s) && !estaSemAcao(i.s))) ? " que ainda não tenha sido puxada" : ""}.</p>`) +
      `<p class="note" id="pdmsg">${escaparHtml(janela.msg || "")}</p>` +
      `<div class="df" style="justify-content:flex-end"><button data-dclose>Cancelar</button>` +
      (o.pend.length ? `<button class="p" data-pdok>Puxar pendências</button>` : "") +
      `</div>`,
  ];
}

acao("#pend", () => abrirJanela("pend"));

acao(
  "data-pdtodas",
  (v) => {
    document.querySelectorAll("#wd [data-pdi]").forEach((x) => (x.checked = v === "1"));
  },
  { janela: true },
);

acao(
  "data-pdok",
  () => {
    const o = etapasComPendencias().find((x) => x.ei === janela.arg);
    if (!o) return;
    const marcadas = new Set(
        [...document.querySelectorAll("#wd [data-pdi]:checked")].map((x) => x.dataset.pdi),
      ),
      escolhidas = o.pend.filter(({ i }) => marcadas.has(i.id));
    if (!escolhidas.length) {
      janela.msg = "Marque ao menos uma atividade.";
      $("pdmsg").textContent = janela.msg;
      return;
    }
    const bs = estado.disc[estado.tab],
      nome = NOME_BLOCO_PENDENCIAS + o.e.nome;
    let b = bs.find((x) => normalizar(x.n) === normalizar(nome));
    if (!b) {
      const ka = bs.findIndex((x) => ehBlocoApontamentos(x.n));
      b = { n: nome, it: [] };
      bs.splice(ka < 0 ? bs.length : ka, 0, b);
    }
    escolhidas.forEach(({ i }) => {
      const c = clonarAtividade(i);
      c.e = Math.max(0, i.e - i.u);
      c.po = i.id;
      b.it.push(c);
    });
    pavimentosRecolhidos.delete(chaveRecolhido(b));
    salvarRecolhidos();
    mensagemEscopo =
      plural(escolhidas.length, "atividade pendente puxada", "atividades pendentes puxadas") +
      " para “" +
      nome +
      "”.";
    fecharJanela();
    salvar();
    desenhar();
  },
  { janela: true },
);
