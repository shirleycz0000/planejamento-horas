// Cadastros (templates): etapas base e, dentro de cada etapa, as disciplinas com a
// lista de atividades. As atividades guardam só o nome: vão para o bloco
// "Escopo + Geral" da disciplina (responsável e horas são preenchidos no projeto).
//
// cadastros = [{ id, nome, ordem, upd,
//                disciplinas: [{ id, nome, sigla, atividades: ["nome", ...] }] }]
// Guardados no banco (coleção "cadetapas", um documento por etapa) e no navegador
// ("phcad3"). Alterar um cadastro não muda os projetos que já o usaram.
//
// Os cadastros da versão anterior (por disciplina: coleção "cadastros" e "phcad") são
// convertidos uma vez e ficam guardados como estavam.

const CHAVE_CADASTROS = "phcad3",
  CHAVE_CADASTROS_ANTIGOS = "phcad";
let cadastros = [],
  cadastroAberto = null, // etapa selecionada na janela
  cadastrosSincronizados = false,
  cadastrosVaziosNaConta = null, // primeira leitura da coleção nova: vazia?
  cadastrosAntigos = null, // cadastros da versão anterior (lidos da conta)
  cadastrosPreparados = false;
try {
  cadastros = JSON.parse(localStorage.getItem(CHAVE_CADASTROS) || "[]");
} catch (e) {}

const novoIdCadastro = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const cadastroPorId = (id) => cadastros.find((c) => c.id === id);
const ordenarCadastros = () => cadastros.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
const discDoCadastro = (c, k) => c && c.disciplinas[+k];
const nomeDaDisciplina = (d) => d.sigla || d.nome; // nome usado no projeto

// Disciplina de uma etapa do cadastro pelo nome usado no projeto (sigla ou nome)
const acharDiscCadastro = (c, nome) =>
  c &&
  c.disciplinas.find(
    (d) => normalizar(d.sigla) === normalizar(nome) || normalizar(d.nome) === normalizar(nome),
  );

// Todas as disciplinas cadastradas (em qualquer etapa), sem repetir
function disciplinasCadastradas() {
  const vistas = new Map();
  cadastros.forEach((c) =>
    c.disciplinas.forEach((d) => {
      const k = normalizar(nomeDaDisciplina(d));
      if (!vistas.has(k)) vistas.set(k, { nome: d.nome, sigla: d.sigla });
    }),
  );
  return [...vistas.values()];
}

function salvarCadastrosLocal() {
  try {
    localStorage.setItem(CHAVE_CADASTROS, JSON.stringify(cadastros));
  } catch (e) {}
}

async function gravarCadastro(c) {
  c.upd = Date.now();
  salvarCadastrosLocal();
  if (!banco) return;
  try {
    await banco
      .doc("cadetapas/" + c.id)
      .set({ nome: c.nome, ordem: c.ordem || 0, disciplinas: c.disciplinas, upd: c.upd });
  } catch (e) {
    mostrarMensagem("Não foi possível salvar o cadastro na sua conta.");
  }
}

async function apagarCadastro(id) {
  cadastros = cadastros.filter((c) => c.id !== id);
  salvarCadastrosLocal();
  if (banco)
    try {
      await banco.doc("cadetapas/" + id).delete();
    } catch (e) {}
}

// ---------- Preenchimento inicial e conversão ----------

// Etapa PP do Modelo JBLUE com as disciplinas e as atividades do bloco "Geral"
function cadastrosIniciais() {
  const m = criarModeloJblue().disc,
    nomes = { ELT: "Elétrica", TEL: "Telecomunicações" };
  return [
    {
      id: "t-pp",
      nome: "PP",
      ordem: 0,
      disciplinas: Object.keys(m).map((sigla) => ({
        id: "c-" + sigla.toLowerCase(),
        nome: nomes[sigla] || sigla,
        sigla,
        atividades: (m[sigla].find((b) => normalizar(b.n) === "geral") || { it: [] }).it.map((i) => i.d),
      })),
    },
  ];
}

// Cadastros da versão anterior (disciplina > etapas) → etapa > disciplinas
function converterCadastrosAntigos(antigos) {
  const novos = [],
    porNome = new Map();
  antigos
    .slice()
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .forEach((d) =>
      (d.etapas || []).forEach((e) => {
        const k = normalizar(e.nome);
        let c = porNome.get(k);
        if (!c) {
          c = { id: novoIdCadastro("t"), nome: e.nome, ordem: novos.length, disciplinas: [] };
          porNome.set(k, c);
          novos.push(c);
        }
        if (!acharDiscCadastro(c, d.sigla || d.nome))
          c.disciplinas.push({
            id: novoIdCadastro("c"),
            nome: d.nome || d.sigla || "Disciplina",
            sigla: d.sigla || "",
            atividades: (e.atividades || []).slice(),
          });
      }),
    );
  return novos;
}

// Traz as etapas salvas em "Meus modelos": cada modelo vira uma etapa do cadastro
// (ou completa a de mesmo nome), com uma disciplina por disciplina do modelo e as
// atividades do bloco "Geral"/"Escopo + Geral". Devolve quantas disciplinas foram criadas.
function importarEtapasDosModelos() {
  let n = 0;
  listarModelos("etapa").forEach((t) => {
    let disc;
    try {
      disc = JSON.parse(t.j).disc || {};
    } catch (e) {
      return;
    }
    let c = cadastros.find((x) => normalizar(x.nome) === normalizar(t.nome)),
      mudou = false;
    for (const sigla in disc) {
      const bloco = disc[sigla].find((b) => normalizar(b.n) === "geral" || ehBlocoEscopo(b)),
        nomes = bloco ? bloco.it.map((i) => i.d).filter(Boolean) : [];
      if (!c) {
        c = { id: novoIdCadastro("t"), nome: t.nome, ordem: cadastros.length, disciplinas: [] };
        cadastros.push(c);
      }
      if (acharDiscCadastro(c, sigla)) continue;
      const conhecida = disciplinasCadastradas().find(
        (d) => normalizar(nomeDaDisciplina(d)) === normalizar(sigla),
      );
      c.disciplinas.push({
        id: novoIdCadastro("c"),
        nome: conhecida ? conhecida.nome : sigla,
        sigla: conhecida ? conhecida.sigla : sigla,
        atividades: nomes,
      });
      mudou = true;
      n++;
    }
    if (mudou) gravarCadastro(c);
  });
  return n;
}

function lerCadastrosAntigosLocal() {
  try {
    const a = JSON.parse(localStorage.getItem(CHAVE_CADASTROS_ANTIGOS) || "[]");
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}

// Chamado quando a coleção nova (e, na conta, a antiga) termina de carregar.
// Na primeira vez: converte os cadastros da versão anterior ou, se não houver,
// preenche com o Modelo JBLUE. Se você apagar tudo depois, não volta a preencher.
async function prepararCadastrosIniciais() {
  if (cadastrosPreparados || cadastrosVaziosNaConta === null) return;
  if (banco && cadastrosAntigos === null) return;
  cadastrosPreparados = true;
  if (!cadastrosVaziosNaConta) return;
  if (cadastros.length) {
    // criados neste navegador antes de entrar na conta: envia para a conta
    cadastros.forEach((c) => gravarCadastro(c));
    return;
  }
  let jaPreenchido = false;
  try {
    jaPreenchido = localStorage.getItem("phcad3-ini") === "1";
    if (banco) jaPreenchido = jaPreenchido || (await banco.doc("meta/cadetapas").get()).exists;
  } catch (e) {}
  if (jaPreenchido) return;
  const antigos = banco ? cadastrosAntigos : lerCadastrosAntigosLocal();
  let usouAntigos = false;
  if (antigos.length) {
    cadastros = converterCadastrosAntigos(antigos);
    usouAntigos = true;
  } else {
    // a versão anterior já tinha sido preenchida e você apagou tudo: continua vazio
    let antesPreenchido = false;
    try {
      antesPreenchido = localStorage.getItem("phcad-ini") === "1";
      if (banco) antesPreenchido = antesPreenchido || (await banco.doc("meta/cadastros").get()).exists;
    } catch (e) {}
    if (!antesPreenchido) cadastros = cadastrosIniciais();
  }
  cadastros.forEach((c) => gravarCadastro(c));
  if (!usouAntigos) importarEtapasDosModelos();
  try {
    localStorage.setItem("phcad3-ini", "1");
    if (banco) await banco.doc("meta/cadetapas").set({ t: Date.now(), convertidos: usouAntigos });
  } catch (e) {}
  salvarCadastrosLocal();
  if (janela && janela.kind === "cad") desenharJanela();
  if (telaAtual === "etapas") desenharEtapas();
}

// Sem conta: só o navegador
function prepararCadastrosSemConta() {
  cadastrosVaziosNaConta = true;
  prepararCadastrosIniciais();
}

// Cadastros da versão anterior, lidos uma vez da conta para a conversão
function receberCadastrosAntigos(snap) {
  if (cadastrosAntigos !== null || snap.metadata.fromCache) return;
  cadastrosAntigos = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  prepararCadastrosIniciais();
}

// Atualizações vindas da conta (outro dispositivo ou aba)
function receberCadastros(snap) {
  if (snap.metadata.fromCache && snap.empty) return;
  const vistos = {};
  snap.docs.forEach((doc) => {
    const v = doc.data() || {},
      c = cadastroPorId(doc.id);
    vistos[doc.id] = 1;
    const novo = {
      id: doc.id,
      nome: v.nome || "Etapa",
      ordem: v.ordem || 0,
      disciplinas: Array.isArray(v.disciplinas) ? v.disciplinas : [],
      upd: v.upd || 0,
    };
    if (!c) cadastros.push(novo);
    else if ((v.upd || 0) > (c.upd || 0)) Object.assign(c, novo);
  });
  if (!snap.metadata.fromCache && !snap.metadata.hasPendingWrites) {
    if (!cadastrosSincronizados) {
      cadastrosSincronizados = true;
      cadastrosVaziosNaConta = snap.empty;
      prepararCadastrosIniciais();
    } else cadastros = cadastros.filter((c) => vistos[c.id]);
  }
  ordenarCadastros();
  salvarCadastrosLocal();
  if (janela && janela.kind === "cad") desenharListaCadastros();
}

// ---------- Janela "Cadastros" ----------

const plural = (n, um, varios) => n + " " + (n === 1 ? um : varios);

function htmlListaCadastros() {
  return cadastros
    .map(
      (c) =>
        `<button class="${c.id === cadastroAberto ? "on2" : ""}" data-cadsel="${c.id}">` +
        `<b>${escaparHtml(c.nome)}</b>` +
        `<span class="note" style="margin:0;display:block">${plural(c.disciplinas.length, "disciplina", "disciplinas")}</span></button>`,
    )
    .join("");
}

function desenharListaCadastros() {
  // só redesenha se mudou (não troca o botão que está sendo clicado)
  const el = $("cadlista"),
    h = htmlListaCadastros();
  if (el && el.innerHTML !== h) el.innerHTML = h;
}

function htmlDisciplinaCadastro(d, k, total) {
  return (
    `<div class="cadet"><div class="df">` +
    `<input class="cadetn" data-caddn="${k}" value="${escaparHtml(d.nome)}" aria-label="Nome da disciplina">` +
    `<input class="cadsig" data-cadds="${k}" value="${escaparHtml(d.sigla || "")}" placeholder="Sigla" aria-label="Sigla da disciplina">` +
    `<span class="note" style="margin:0;white-space:nowrap">${plural(d.atividades.length, "atividade", "atividades")}</span>` +
    `<button data-caddup="${k}" title="Subir disciplina" aria-label="Subir disciplina"${k ? "" : " disabled"}>↑</button>` +
    `<button data-cadddn="${k}" title="Descer disciplina" aria-label="Descer disciplina"${k < total - 1 ? "" : " disabled"}>↓</button>` +
    `<button data-cadddel="${k}" title="Excluir disciplina desta etapa" aria-label="Excluir disciplina">×</button></div>` +
    d.atividades
      .map(
        (a, ai) =>
          `<div class="cadat"><span class="num">${ai + 1}</span>` +
          `<input data-cadat="${k}:${ai}" value="${escaparHtml(a)}" aria-label="Nome da atividade">` +
          `<button data-cadatup="${k}:${ai}" title="Subir" aria-label="Subir atividade"${ai ? "" : " disabled"}>↑</button>` +
          `<button data-cadatdn="${k}:${ai}" title="Descer" aria-label="Descer atividade"${ai < d.atividades.length - 1 ? "" : " disabled"}>↓</button>` +
          `<button data-cadatdel="${k}:${ai}" title="Excluir atividade" aria-label="Excluir atividade">×</button></div>`,
      )
      .join("") +
    `<div class="cadat"><span class="num">+</span>` +
    `<input data-cadatn="${k}" placeholder="Nova atividade e Enter" aria-label="Nova atividade">` +
    `<button data-cadatadd="${k}">Adicionar</button></div>` +
    `<details><summary class="note" style="margin:0;cursor:pointer">Colar uma lista (uma atividade por linha)</summary>` +
    `<textarea data-cadcola="${k}" rows="4" aria-label="Lista de atividades"></textarea>` +
    `<button data-cadcolar="${k}">Adicionar a lista</button></details></div>`
  );
}

// Sugestões de disciplinas já cadastradas em outras etapas (para não digitar de novo)
function htmlSugestoesDisciplinas(c) {
  const ops = disciplinasCadastradas()
    .filter((d) => !acharDiscCadastro(c, nomeDaDisciplina(d)))
    .map((d) => `<option value="${escaparHtml(d.nome)}">${escaparHtml(d.sigla || "")}</option>`)
    .join("");
  return ops ? `<datalist id="caddlista">${ops}</datalist>` : "";
}

function janelaCadastros() {
  if (!cadastroPorId(cadastroAberto)) cadastroAberto = cadastros[0] ? cadastros[0].id : null;
  const c = cadastroPorId(cadastroAberto),
    temModelos = listarModelos("etapa").length > 0;
  return [
    "Cadastros: etapas e disciplinas",
    `<p class="note" style="margin:0">Cadastre as <b>etapas</b> (ex.: Estudo Preliminar, Projeto Básico, Executivo) e, em cada uma, ` +
      `as <b>disciplinas</b> com a lista de atividades. Ao adicionar uma disciplina numa etapa do projeto, essas atividades entram no bloco ` +
      `<b>${NOME_BLOCO_ESCOPO}</b>; responsável e horas são preenchidos no projeto. Mudar um cadastro não altera projetos que já o usaram.</p>` +
      `<div class="cadg"><div class="cadl"><div id="cadlista">${htmlListaCadastros()}</div>` +
      `<div class="cadnova"><b>Nova etapa</b><input id="cadnn" placeholder="Nome (ex.: Projeto Básico)" aria-label="Nome da etapa">` +
      `<button class="p" data-cadadde>+ Etapa</button></div></div>` +
      `<div class="cadr">${
        c
          ? `<div class="df cadcab"><label>Etapa <input data-cadn value="${escaparHtml(c.nome)}" aria-label="Nome da etapa"></label>` +
            `<button data-caddele title="Excluir esta etapa do cadastro">Excluir etapa</button></div>` +
            (c.disciplinas.length
              ? c.disciplinas.map((d, k) => htmlDisciplinaCadastro(d, k, c.disciplinas.length)).join("")
              : `<p class="note">Nenhuma disciplina cadastrada em ${escaparHtml(c.nome)}.</p>`) +
            `<div class="df cadnovad"><input id="caddnova" list="caddlista" placeholder="Nova disciplina (ex.: Elétrica)" aria-label="Nome da nova disciplina">` +
            `<input id="caddsnova" placeholder="Sigla (ex.: ELT)" aria-label="Sigla da nova disciplina">` +
            `<button class="p" data-caddadd>+ Disciplina</button></div>` +
            htmlSugestoesDisciplinas(c)
          : `<p class="note">Cadastre a primeira etapa ao lado.</p>`
      }</div></div>` +
      (temModelos
        ? `<div class="df" style="justify-content:flex-start"><button data-cadimp>Trazer etapas de “Meus modelos”</button></div>`
        : "") +
      `<p class="note" id="cadmsg">${escaparHtml(janela.msg || "")}</p>`,
  ];
}

// Redesenha a janela devolvendo o foco a um campo (seletor) ou ao campo em uso
function redesenharCadastros(focar) {
  const a = document.activeElement,
    sel =
      focar ||
      (a &&
        a.closest &&
        a.closest("#wd") &&
        [...a.attributes]
          .filter((x) => x.name.startsWith("data-cad") || x.name === "id")
          .map((x) => `[${x.name}="${x.value}"]`)
          .join(""));
  desenharJanela();
  if (sel) {
    const el = document.querySelector("#wd " + sel);
    if (el) el.focus();
  }
}

const mensagemCadastro = (m) => {
  janela.msg = m;
  const el = $("cadmsg");
  if (el) el.textContent = m;
};

// ---------- Ações da janela ----------

const JANELA = { janela: true };
const mover = (lista, k, para) => {
  if (para < 0 || para >= lista.length) return false;
  lista.splice(para, 0, lista.splice(k, 1)[0]);
  return true;
};
const indices = (v) => String(v).split(":").map(Number);
const etapaCadAberta = () => cadastroPorId(cadastroAberto);

acao(
  "data-cadsel",
  (id) => {
    cadastroAberto = id;
    janela.msg = "";
    redesenharCadastros();
  },
  JANELA,
);

acao(
  "data-cadadde",
  () => {
    const nome = $("cadnn").value.trim();
    if (!nome) return mensagemCadastro("Informe o nome da etapa.");
    if (cadastros.some((c) => normalizar(c.nome) === normalizar(nome)))
      return mensagemCadastro('Já existe a etapa "' + nome + '" no cadastro.');
    const c = { id: novoIdCadastro("t"), nome, ordem: cadastros.length, disciplinas: [] };
    cadastros.push(c);
    gravarCadastro(c);
    cadastroAberto = c.id;
    janela.msg = 'Etapa "' + nome + '" cadastrada. Agora adicione as disciplinas.';
    redesenharCadastros("#caddnova");
  },
  JANELA,
);

acao(
  "data-caddele",
  () => {
    const c = etapaCadAberta();
    if (!c) return;
    confirmar(
      'Excluir a etapa "' +
        c.nome +
        '" e as suas ' +
        plural(c.disciplinas.length, "disciplina", "disciplinas") +
        " do cadastro? Os projetos que já usam essa etapa não mudam.",
      async () => {
        await apagarCadastro(c.id);
        cadastroAberto = null;
        janela.msg = "";
        redesenharCadastros();
      },
    );
  },
  JANELA,
);

acao(
  "data-caddadd",
  () => {
    const c = etapaCadAberta(),
      nome = $("caddnova").value.trim();
    if (!c) return;
    if (!nome) return mensagemCadastro("Informe o nome da disciplina.");
    // nome de uma disciplina já cadastrada em outra etapa: reaproveita a sigla
    const conhecida = disciplinasCadastradas().find(
        (d) => normalizar(d.nome) === normalizar(nome) || normalizar(d.sigla) === normalizar(nome),
      ),
      sigla = ($("caddsnova").value.trim() || (conhecida ? conhecida.sigla : "")).toUpperCase(),
      nomeFinal = conhecida && !$("caddsnova").value.trim() ? conhecida.nome : nome;
    if (acharDiscCadastro(c, nomeFinal) || (sigla && acharDiscCadastro(c, sigla)))
      return mensagemCadastro('A disciplina "' + nome + '" já está em ' + c.nome + ".");
    c.disciplinas.push({ id: novoIdCadastro("c"), nome: nomeFinal, sigla, atividades: [] });
    gravarCadastro(c);
    janela.msg = "";
    redesenharCadastros(`[data-cadatn="${c.disciplinas.length - 1}"]`);
  },
  JANELA,
);

acao(
  "data-cadddel",
  (k) => {
    const c = etapaCadAberta(),
      d = discDoCadastro(c, k);
    if (!d) return;
    confirmar(
      'Excluir a disciplina "' +
        d.nome +
        '" (' +
        plural(d.atividades.length, "atividade", "atividades") +
        ") da etapa " +
        c.nome +
        " do cadastro?",
      () => {
        c.disciplinas.splice(+k, 1);
        gravarCadastro(c);
        redesenharCadastros();
      },
    );
  },
  JANELA,
);

acao(
  "data-caddup",
  (k) => {
    const c = etapaCadAberta();
    if (c && mover(c.disciplinas, +k, +k - 1)) (gravarCadastro(c), redesenharCadastros());
  },
  JANELA,
);
acao(
  "data-cadddn",
  (k) => {
    const c = etapaCadAberta();
    if (c && mover(c.disciplinas, +k, +k + 1)) (gravarCadastro(c), redesenharCadastros());
  },
  JANELA,
);

// Atividades
function adicionarAtividadesCadastro(k, nomes) {
  const c = etapaCadAberta(),
    d = discDoCadastro(c, k);
  if (!d) return 0;
  let n = 0,
    rep = 0;
  nomes
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .forEach((x) => {
      if (d.atividades.some((a) => normalizar(a) === normalizar(x))) return rep++;
      d.atividades.push(x);
      n++;
    });
  if (n) gravarCadastro(c);
  janela.msg = rep ? rep + " atividade(s) já existiam nesta disciplina e foram ignoradas." : "";
  return n;
}

acao(
  "data-cadatadd",
  (k) => {
    const el = document.querySelector(`[data-cadatn="${k}"]`);
    adicionarAtividadesCadastro(k, [el ? el.value : ""]);
    redesenharCadastros(`[data-cadatn="${k}"]`);
  },
  JANELA,
);

acao(
  "data-cadcolar",
  (k) => {
    const el = document.querySelector(`[data-cadcola="${k}"]`),
      n = adicionarAtividadesCadastro(k, (el ? el.value : "").split(/\r?\n/));
    redesenharCadastros(`[data-cadatn="${k}"]`);
    if (n) mensagemCadastro(n + " atividade(s) adicionada(s)." + (janela.msg ? " " + janela.msg : ""));
  },
  JANELA,
);

acao(
  "data-cadatdel",
  (v) => {
    const [k, ai] = indices(v),
      c = etapaCadAberta(),
      d = discDoCadastro(c, k);
    if (!d) return;
    d.atividades.splice(ai, 1);
    gravarCadastro(c);
    redesenharCadastros(`[data-cadatn="${k}"]`);
  },
  JANELA,
);

acao(
  "data-cadatup",
  (v) => {
    const [k, ai] = indices(v),
      c = etapaCadAberta(),
      d = discDoCadastro(c, k);
    if (d && mover(d.atividades, ai, ai - 1))
      (gravarCadastro(c), redesenharCadastros(`[data-cadatup="${k}:${ai - 1}"]`));
  },
  JANELA,
);
acao(
  "data-cadatdn",
  (v) => {
    const [k, ai] = indices(v),
      c = etapaCadAberta(),
      d = discDoCadastro(c, k);
    if (d && mover(d.atividades, ai, ai + 1))
      (gravarCadastro(c), redesenharCadastros(`[data-cadatdn="${k}:${ai + 1}"]`));
  },
  JANELA,
);

acao(
  "data-cadimp",
  () => {
    const n = importarEtapasDosModelos();
    janela.msg = n
      ? n + " disciplina(s) trazida(s) de “Meus modelos”."
      : "Nada novo: as etapas de “Meus modelos” já estão no cadastro.";
    redesenharCadastros();
  },
  JANELA,
);

// Edição dos nomes (grava ao sair do campo, sem redesenhar a janela)
$("wd").addEventListener("change", (e) => {
  const t = e.target,
    c = etapaCadAberta();
  if (!c || !t.dataset) return;
  if (t.dataset.cadn !== undefined) {
    const nome = t.value.trim();
    if (nome === c.nome) return;
    if (!nome || cadastros.some((x) => x !== c && normalizar(x.nome) === normalizar(nome))) {
      t.value = c.nome;
      return mensagemCadastro("Nome vazio ou repetido: mantido “" + c.nome + "”.");
    }
    c.nome = nome;
  } else if (t.dataset.caddn !== undefined) {
    const d = discDoCadastro(c, t.dataset.caddn),
      nome = t.value.trim();
    if (!d || nome === d.nome) return;
    if (!nome || c.disciplinas.some((x) => x !== d && normalizar(x.nome) === normalizar(nome))) {
      t.value = d.nome;
      return mensagemCadastro("Nome de disciplina vazio ou repetido: mantido “" + d.nome + "”.");
    }
    d.nome = nome;
  } else if (t.dataset.cadds !== undefined) {
    const d = discDoCadastro(c, t.dataset.cadds),
      sigla = t.value.trim().toUpperCase();
    if (!d || sigla === (d.sigla || "")) return void (t.value = sigla);
    if (sigla && c.disciplinas.some((x) => x !== d && normalizar(x.sigla) === normalizar(sigla))) {
      t.value = d.sigla || "";
      return mensagemCadastro("Já existe uma disciplina com a sigla " + sigla + " nesta etapa.");
    }
    d.sigla = t.value = sigla;
  } else if (t.dataset.cadat !== undefined) {
    const [k, ai] = indices(t.dataset.cadat),
      d = discDoCadastro(c, k),
      nome = t.value.replace(/\s+/g, " ").trim();
    if (!d) return;
    if (!nome) {
      t.value = d.atividades[ai];
      return mensagemCadastro("Para remover uma atividade, use o botão ×.");
    }
    d.atividades[ai] = nome;
  } else return;
  gravarCadastro(c);
  desenharListaCadastros();
});

// Enter no campo de nova atividade adiciona; no da nova disciplina ou etapa, cria
$("wd").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !e.target.dataset) return;
  const t = e.target;
  if (t.dataset.cadatn !== undefined) {
    e.preventDefault();
    adicionarAtividadesCadastro(t.dataset.cadatn, [t.value]);
    redesenharCadastros(`[data-cadatn="${t.dataset.cadatn}"]`);
  } else if (t.id === "caddnova" || t.id === "caddsnova") {
    e.preventDefault();
    document.querySelector("[data-caddadd]").click();
  } else if (t.id === "cadnn") {
    e.preventDefault();
    document.querySelector("[data-cadadde]").click();
  }
});
