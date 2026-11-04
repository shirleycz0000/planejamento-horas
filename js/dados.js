// Estado do projeto aberto, salvar/carregar, desfazer e refazer

let editandoApontamento = null,
  pilhaDesfazer = [],
  pilhaRefazer = [],
  ultimoJson = "",
  ultimaChave = "";

const chaveDoEstado = (o) =>
  JSON.stringify({
    hd: o.hd,
    pe: o.pe,
    run: o.run,
    status: o.status,
    cal: o.cal,
    etapas: o.etapas,
  });

function desfazer() {
  if (!idProjetoAberto || telaAtual !== "etapa" || !pilhaDesfazer.length) return;
  const aberta = [estado.ei, estado.di];
  pilhaRefazer.push(JSON.stringify(estado));
  estado = carregarEstado(pilhaDesfazer.pop());
  abrirPosicao(aberta);
  ultimoJson = JSON.stringify(estado);
  ultimaChave = chaveDoEstado(estado);
  desenhar();
  salvar();
}

function refazer() {
  if (!idProjetoAberto || telaAtual !== "etapa" || !pilhaRefazer.length) return;
  const aberta = [estado.ei, estado.di];
  pilhaDesfazer.push(JSON.stringify(estado));
  estado = carregarEstado(pilhaRefazer.pop());
  abrirPosicao(aberta);
  ultimoJson = JSON.stringify(estado);
  ultimaChave = chaveDoEstado(estado);
  desenhar();
  salvar();
}

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) {
      e.preventDefault();
      desfazer();
    } else if (k === "y" || (k === "z" && e.shiftKey)) {
      e.preventDefault();
      refazer();
    }
  }
});

let estado = prepararEstado({
    versao: VERSAO_DADOS,
    hd: 7,
    run: null,
    etapas: [],
    status: null,
    cal: null,
  }),
  timerTela,
  projetos = {},
  idProjetoAberto = null,
  banco = null,
  projetoEmEdicao = null,
  acaoConfirmada = null,
  telaAtual = "home",
  mensagemEscopo = "";

// Acrescenta ao estado a etapa e a disciplina abertas na tela:
//   estado.ei / estado.di   posição da etapa e da disciplina (dentro da etapa)
//   estado.etapaAberta      a etapa aberta;  estado.discAberta  a disciplina aberta
//   estado.disc             { [nome da disciplina]: blocos da disciplina aberta }
//   estado.tab              nome da disciplina aberta
// A tela da disciplina lê os blocos por estado.disc[estado.tab].
// Nada disso é gravado: são propriedades não enumeráveis.
function prepararEstado(o) {
  let ei = 0,
    di = 0;
  const prop = (get, set) => ({ get, set, enumerable: false, configurable: true });
  Object.defineProperties(o, {
    ei: prop(
      () => ei,
      (v) => (ei = v),
    ),
    di: prop(
      () => di,
      (v) => (di = v),
    ),
    etapaAberta: prop(function () {
      return this.etapas[ei];
    }),
    discAberta: prop(function () {
      const e = this.etapas[ei];
      return e ? e.disciplinas[di] : undefined;
    }),
    disc: prop(function () {
      const e = this.etapas[ei],
        d = e && e.disciplinas[di];
      return d ? { [d.nome]: d.blocos } : {};
    }),
    tab: prop(
      function () {
        const e = this.etapas[ei],
          d = e && e.disciplinas[di];
        return d ? d.nome : undefined;
      },
      () => {},
    ),
  });
  return o;
}

// Abre a etapa/disciplina na posição [ei, di], ajustando se ela não existir mais
function abrirPosicao([e, d]) {
  estado.ei = Math.min(e || 0, Math.max(0, estado.etapas.length - 1));
  const et = estado.etapas[estado.ei];
  estado.di = Math.min(d || 0, Math.max(0, et ? et.disciplinas.length - 1 : 0));
}

// Lê um projeto salvo (qualquer formato) e devolve o estado no formato novo
function carregarEstado(j, nome) {
  const o = converterParaNovo(typeof j === "string" ? JSON.parse(j) : j, nome || "Etapa 1");
  o.etapas.forEach((e) => {
    if (!e.id) e.id = novoIdEtapa();
    if (!Array.isArray(e.disciplinas)) e.disciplinas = [];
    e.disciplinas.forEach((d) => {
      if (!d.id) d.id = novoIdDisciplina();
      d.blocos = blocosComEscopo(d.blocos);
    });
  });
  if (!o.hd) o.hd = 7;
  if (!Array.isArray(o.status) || !o.status.length) o.status = statusPadrao();
  if (!o.cal || !Array.isArray(o.cal.dias)) o.cal = { dias: [1, 2, 3, 4, 5], ev: [] };
  if (!Array.isArray(o.cal.ev)) o.cal.ev = [];
  definirStatus(o.status);
  return prepararEstado(o);
}

const CHAVE_LOCAL = "phs2",
  novoIdProjeto = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  mostrarMensagem = (t) => {
    $("sv").textContent = t;
  };

function salvarLocal() {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(projetos));
  } catch (e) {}
}

const mostrarStatusNuvem = (m) => {
  const c = $("cloud");
  c.className = "cloud " + (m === "ok" ? "ok" : "bad");
  c.textContent =
    m === "ok"
      ? "☁ Salvo na sua conta — pode fechar o navegador"
      : m === "local"
        ? "⚠ Atenção: neste acesso os dados ficam só neste navegador e podem ser perdidos. Abra o link da ferramenta com a sua conta do Claude para salvar na nuvem."
        : "⚠ Não consegui salvar na sua conta. Tente de novo; se continuar, use Exportar Excel para não perder o trabalho.";
};

async function gravarProjeto(id) {
  const p = projetos[id];
  if (!p) return;
  p.upd = Date.now();
  salvarLocal();
  if (!banco) {
    mostrarStatusNuvem("local");
    mostrarMensagem("Salvo apenas neste navegador.");
    return;
  }
  const body = { name: p.name, etapa: p.etapa || "", j: p.j, upd: p.upd };
  for (let k = 0; k < 2; k++) {
    try {
      await banco.doc("projects/" + id).set(body);
      mostrarStatusNuvem("ok");
      mostrarMensagem("Salvo na sua conta.");
      return;
    } catch (e) {
      if (!e || e.code !== "unavailable" || k) break;
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
    }
  }
  mostrarStatusNuvem("err");
  mostrarMensagem("Não foi possível salvar na conta.");
}

async function excluirProjeto(id) {
  if (cronometroForaDaTela && cronometroForaDaTela.pid === id) cronometroForaDaTela = null;
  delete projetos[id];
  salvarLocal();
  if (banco) {
    try {
      await banco.doc("projects/" + id).delete();
    } catch (e) {}
  }
}

const resumoProjeto = (j) => {
  try {
    const x = JSON.parse(j),
      stt = Array.isArray(x.status) && x.status.length ? x.status : statusPadrao(),
      rl = (n) => {
        const f = stt.find((q) => q.n === n);
        return f ? f.r : "pend";
      },
      T = { E: 0, U: 0, R: 0, D: 0, hd: x.hd || 7, n: 0, nomes: [] },
      novo = converterParaNovo(x, "Etapa 1");
    T.nomes = novo.etapas.map((e) => e.nome);
    T.n = T.nomes.length;
    percorrerAtividades(novo, (i) => {
      const r = rl(i.s);
      if (r === "sa") return;
      T.E += i.e;
      T.U += i.u;
      if (r === "ok") T.D += i.e;
      else T.R += Math.max(0, i.e - i.u);
    });
    return T;
  } catch (e) {
    return { E: 0, U: 0, R: 0, D: 0, hd: 7, n: 0, nomes: [] };
  }
};

// Totais de uma etapa (todas as suas disciplinas) ou de uma disciplina (seus blocos)
function totaisEtapa(e) {
  const T = { E: 0, U: 0, R: 0, D: 0, n: 0, nd: 0 };
  if (Array.isArray(e.disciplinas)) {
    e.disciplinas.forEach((d) => {
      const z = totaisEtapa(d);
      for (const k in T) T[k] += z[k];
    });
    return T;
  }
  (e.blocos || []).forEach((b) =>
    b.it.forEach((i) => {
      if (estaSemAcao(i.s)) return;
      T.n++;
      T.E += i.e;
      T.U += usadoAtual(i);
      if (estaConcluido(i.s)) {
        T.D += i.e;
        T.nd++;
      } else T.R += Math.max(0, i.e - usadoAtual(i));
    }),
  );
  return T;
}

const situacaoEtapa = (z) =>
  !z.n
    ? ["Sem atividades", "mut"]
    : z.nd === z.n
      ? ["Concluída", "ok"]
      : z.U === 0 && !z.nd
        ? ["Não iniciada", "mut"]
        : ["Em andamento", "acc"];

const atividadesDaDisciplina = (d) => estado.disc[d].flatMap((b) => b.it);

function usadoAtual(i) {
  return i.u + (estado.run && estado.run.id === i.id ? (Date.now() - estado.run.t0) / 36e5 : 0);
}

async function salvar() {
  if (!idProjetoAberto) return;
  if (typeof agendaRevisarDescricao === "function") agendaRevisarDescricao(); // status/nome mudou: atualiza o evento
  const j = JSON.stringify(estado),
    k = chaveDoEstado(estado);
  if (ultimaChave && ultimaChave !== k) {
    pilhaDesfazer.push(ultimoJson);
    if (pilhaDesfazer.length > 50) pilhaDesfazer.shift();
    pilhaRefazer = [];
  }
  ultimoJson = j;
  ultimaChave = k;
  $("un").disabled = !pilhaDesfazer.length;
  $("rd").disabled = !pilhaRefazer.length;
  projetos[idProjetoAberto].etapa = estado.etapas.map((e) => e.nome).join(", ");
  projetos[idProjetoAberto].j = j;
  historicoDesatualizado = true;
  await gravarProjeto(idProjetoAberto);
}

function acharAtividade(i) {
  return percorrerAtividades(estado, (x) => x.id === i) || undefined;
}

function totaisDisciplina(d) {
  const a = atividadesDaDisciplina(d).filter((i) => !estaSemAcao(i.s));
  return {
    E: a.reduce((x, i) => x + i.e, 0),
    U: a.reduce((x, i) => x + usadoAtual(i), 0),
    R: a.filter((i) => !estaConcluido(i.s)).reduce((x, i) => x + Math.max(0, i.e - usadoAtual(i)), 0),
    D: a.filter((i) => estaConcluido(i.s)).reduce((x, i) => x + i.e, 0),
  };
}

function paraCadaAtividade(fn) {
  Object.values(projetos).forEach((pj) => {
    try {
      const x = JSON.parse(pj.j);
      percorrerAtividades(x, (i, c) => void fn(pj, c.etapa, c.disciplina, c.bloco, i), pj.etapa || "");
    } catch (e) {}
  });
}

function editarProjetoSalvo(pid, fn) {
  const pj = projetos[pid];
  if (!pj) return false;
  let x;
  try {
    x = JSON.parse(pj.j);
  } catch (e) {
    return false;
  }
  // projeto ainda no formato antigo: converte (com cópia de segurança) antes de alterar
  if (!ehFormatoNovo(x)) {
    guardarCopiaFormatoAntigo(pid, pj.name, pj.j);
    x = converterParaNovo(x, pj.etapa || "Etapa 1");
  }
  fn(x);
  pj.j = JSON.stringify(x);
  historicoDesatualizado = true;
  gravarProjeto(pid);
  return true;
}

function acharAtividadeEm(x, id) {
  return percorrerAtividades(x, (i) => i.id === id);
}

function lerLocal(legacy) {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || "null");
    if (r && Object.keys(r).length) return r;
  } catch (e) {}
  if (legacy)
    try {
      const o = localStorage.getItem("ph");
      if (o) {
        const id = novoIdProjeto();
        JSON.parse(o);
        return { [id]: { id, name: "JBLUE", etapa: "PP", j: o, upd: Date.now() } };
      }
    } catch (e) {}
  return {};
}

async function migrar() {
  try {
    const m = await banco.doc("meta/migrated").get();
    if (m.exists) {
      desenharInicio();
      return;
    }
  } catch (e) {}
  let l = lerLocal(false),
    moved = false;
  try {
    const g = await banco.doc("app/state").get();
    if (g.exists && g.data().j) {
      const id = novoIdProjeto();
      projetos[id] = { id, name: "JBLUE", etapa: "PP", j: g.data().j, upd: Date.now() };
      moved = true;
    }
  } catch (e) {}
  if (!moved) {
    l = Object.keys(l).length ? l : lerLocal(true);
    for (const id in l) projetos[id] = l[id];
  }
  for (const id in projetos) await gravarProjeto(id);
  try {
    await banco.doc("meta/migrated").set({ t: Date.now() });
  } catch (e) {}
  if (!idProjetoAberto) desenharInicio();
}

const salvarAoSair = () => {
  if (idProjetoAberto && projetos[idProjetoAberto]) {
    projetos[idProjetoAberto].j = JSON.stringify(estado);
    gravarProjeto(idProjetoAberto);
  }
};

// ---------- Ações dos botões: desfazer e refazer ----------
acao("#un", () => desfazer());
acao("#rd", () => refazer());
