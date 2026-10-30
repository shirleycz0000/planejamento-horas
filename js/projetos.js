// Tela inicial de projetos e tela do projeto (etapas e disciplinas)

function confirmar(t, fn, lab) {
  $("dm").textContent = t;
  acaoConfirmada = fn;
  $("dy").textContent = lab || "Confirmar";
  $("dlg").showModal();
}

function desenharInicio() {
  telaAtual = "home";
  document.body.dataset.tela = "home";
  procurarCronometro();
  atualizarBarraCronometro();
  mostrarAbaInicio();
  $("home").hidden = false;
  $("proj").hidden = true;
  $("etp").hidden = true;
  const ids = Object.keys(projetos).sort((a, b) => (projetos[b].upd || 0) - (projetos[a].upd || 0)),
    T = { E: 0, U: 0, R: 0 };
  ids.forEach((id) => {
    const z = resumoProjeto(projetos[id].j);
    T.E += z.E;
    T.U += z.U;
    T.R += z.R;
  });
  $("hsum").textContent = ids.length
    ? `${ids.length} projeto${ids.length > 1 ? "s" : ""} · Estimado ${fmtHoras(T.E)} · Usado ${fmtHoras(T.U)} · Restante ${fmtHoras(T.R)}`
    : "";
  $("pgrid").innerHTML = ids.length
    ? ids
        .map((id) => {
          const p = projetos[id],
            z = resumoProjeto(p.j),
            pc = z.E ? Math.round((z.D / z.E) * 100) : 0,
            dr = (Math.round((z.R / z.hd) * 2) / 2).toFixed(1).replace(".", ",");
          return (
            `<article class="pc"><div><h3>${escaparHtml(p.name)}${(cronometroAtivo() || {}).pid === id ? ' <span class="stc acc">⏱ rodando</span>' : ""}</h3>` +
            `<span class="note" style="margin:0">${z.n > 1 ? z.n + " etapas" : "Etapa"}: ${escaparHtml(z.nomes.filter(Boolean).join(", ") || p.etapa || "—")}${p.upd ? " · atualizado em " + new Date(p.upd).toLocaleDateString("pt-BR") : ""}</span></div>` +
            `<div class="pm"><div><b>${fmtHoras(z.E)}</b><span>Estimado</span></div><div><b>${fmtHoras(z.U)}</b>` +
            `<span>Usado</span></div><div><b>${fmtHoras(z.R)}</b><span>Restante · ${dr} dias</span></div></div>` +
            `<div><div class="bar"><i style="width:${pc}%"></i></div><span class="note" style="margin:0">${pc}% concluído</span></div>` +
            `<div class="df"><button class="p" data-open="${id}">Abrir</button><button data-pedit="${id}">Editar</button>` +
            `<button data-pdel="${id}">Excluir</button></div></article>`
          );
        })
        .join("")
    : '<p class="note">Nenhum projeto ainda. Clique em <b>+ Novo projeto</b> para começar.</p>';
}

const fecharFormularioProjeto = () => {
  if ($("npf").open) $("npf").close();
  projetoEmEdicao = null;
};

// Aviso na janela "Novo projeto" (e na barra de mensagens)
const avisoNovoProjeto = (t) => {
  $("pmsg").textContent = t;
  mostrarMensagem(t);
};

// ---------- Projeto aberto: etapas e disciplinas ----------

function abrirProjeto(id) {
  const p = projetos[id];
  if (!p) return;
  idProjetoAberto = id;
  let antigo = false;
  try {
    const bruto = JSON.parse(p.j);
    antigo = !ehFormatoNovo(bruto);
    estado = carregarEstado(bruto, p.etapa);
  } catch (e) {
    estado = prepararEstado({ versao: VERSAO_DADOS, hd: 7, run: null, etapas: [] });
  }
  pilhaDesfazer = [];
  pilhaRefazer = [];
  editandoApontamento = null;
  fecharFiltroBloco();
  $("imp").hidden = true;
  estado.ei = 0;
  estado.di = 0;
  // projeto no formato antigo: guarda a cópia de segurança e grava já convertido
  if (antigo) {
    guardarCopiaFormatoAntigo(id, p.name, p.j);
    p.j = JSON.stringify(estado);
    gravarProjeto(id);
  }
  procurarCronometro();
  ultimoJson = JSON.stringify(estado);
  ultimaChave = chaveDoEstado(estado);
  mostrarEtapas();
}

// Última disciplina aberta em cada etapa (id da etapa → posição), para reabrir nela
const discLembrada = {};

function mostrarEtapas() {
  telaAtual = "etapas";
  $("home").hidden = true;
  $("proj").hidden = true;
  $("etp").hidden = false;
  window.scrollTo(0, 0);
  desenharEtapas();
}

// Abre a tela de atividades de uma disciplina dentro de uma etapa
function abrirDisciplina(ei, di) {
  const e = estado.etapas[ei],
    d = e && e.disciplinas[di];
  if (!d) return;
  estado.ei = ei;
  estado.di = di;
  discLembrada[e.id] = di;
  pilhaDesfazer = [];
  pilhaRefazer = [];
  editandoApontamento = null;
  fecharFiltroBloco();
  mensagemEscopo = "";
  detalhesAbertos.clear();
  telaAtual = "etapa";
  $("home").hidden = true;
  $("etp").hidden = true;
  $("proj").hidden = false;
  window.scrollTo(0, 0);
  desenhar();
  ultimoJson = JSON.stringify(estado);
  ultimaChave = chaveDoEstado(estado);
}

async function voltarParaEtapas() {
  clearInterval(timerTela);
  await salvar();
  mostrarEtapas();
}

// ---------- Etapas, disciplinas e cadastros ----------

// Etapa do cadastro ligada a uma etapa do projeto (pelo id, ou pelo nome)
const cadastroDaEtapa = (e) =>
  cadastroPorId(e.cadastroId) || cadastros.find((c) => normalizar(c.nome) === normalizar(e.nome));
const rotuloDisc = (e, d) => e.nome + " · " + d.nome;
const posicao = (v) => String(v).split(":").map(Number); // "ei:di" → [ei, di]

// "idEtapaCadastro:idDisciplinaCadastro" → [etapa do cadastro, disciplina do cadastro]
function cadastroPorValor(v) {
  const [cid, did] = String(v || "").split(":"),
    c = cadastroPorId(cid);
  return [c, c && c.disciplinas.find((x) => x.id === did)];
}

// Disciplinas do cadastro que servem para uma disciplina do projeto: a da mesma etapa
// primeiro, depois a mesma disciplina em outras etapas, depois as demais
function opcoesCadastroDaDisciplina(e, d) {
  const ce = cadastroDaEtapa(e),
    mesma = (cd) => cd.id === d.cadastroDiscId || acharDiscCadastro({ disciplinas: [cd] }, d.nome),
    ops = [];
  cadastros.forEach((c) =>
    c.disciplinas.forEach((cd) => {
      const peso = c === ce && mesma(cd) ? 0 : mesma(cd) ? 1 : c === ce ? 2 : 3;
      ops.push({
        v: c.id + ":" + cd.id,
        l: c.nome + " · " + cd.nome + " (" + cd.atividades.length + " atividades)",
        peso,
      });
    }),
  );
  return ops.sort((a, b) => a.peso - b.peso);
}

// Sugestão de estimado: média real do histórico para a atividade (arredondada a 5 min)
function estimativaDoHistorico(nome) {
  const a = obterHistorico().A.get(chaveHistorico(nome));
  return a && a.n ? Math.round((a.U / a.n) * 12) / 12 : 0;
}

// Atividades criadas a partir dos nomes do cadastro: sem responsável, estimado sugerido pelo histórico
const atividadesDoCadastro = (nomes) =>
  nomes.map((d) => ({
    id: novoIdAtividade(),
    d,
    r: "",
    s: statusComComportamento("pend"),
    e: estimativaDoHistorico(d),
    u: 0,
  }));

// Acrescenta ao bloco "Escopo + Geral" da disciplina as atividades do cadastro que ainda
// não estão nela (em nenhum bloco); as atividades acrescentadas à mão são mantidas.
function carregarAtividadesDoCadastro(d, nomes) {
  d.blocos = blocosComEscopo(d.blocos);
  const existentes = new Set(d.blocos.flatMap((b) => b.it.map((i) => normalizar(i.d)))),
    novos = nomes.filter((n) => n && !existentes.has(normalizar(n)));
  d.blocos[0].it.push(...atividadesDoCadastro(novos));
  return { na: novos.length, sk: nomes.length - novos.length };
}

function novaEtapa(nome, ce) {
  return { id: novoIdEtapa(), nome, cadastroId: ce ? ce.id : "", ini: "", fim: "", disciplinas: [] };
}

// Disciplina nova numa etapa; com cd (disciplina do cadastro), já vem com as atividades
function novaDisciplina(nome, ce, cd) {
  const d = {
    id: novoIdDisciplina(),
    nome,
    escopo: cd ? "Cadastro: " + ce.nome + " · " + cd.nome : "Em branco",
    cadastroDiscId: cd ? cd.id : "",
    blocos: [
      { n: NOME_BLOCO_ESCOPO, tipo: "escopo", it: [] },
      { n: "Apontamentos a atender", it: [] },
    ],
  };
  if (cd) carregarAtividadesDoCadastro(d, cd.atividades);
  return d;
}

// Opções de "+ Disciplina" numa etapa: [{ v, l }]. Primeiro as disciplinas do cadastro da
// etapa que faltam (e "Todas as que faltam"), depois as que já estão (para completar), as
// cadastradas em outras etapas (sem atividades) e, por fim, "Outra" (nome livre, v = "").
function opcoesNovaDisciplina(e) {
  const ce = cadastroDaEtapa(e),
    tem = (nome) => e.disciplinas.some((d) => normalizar(d.nome) === normalizar(nome)),
    daEtapa = ce ? ce.disciplinas : [],
    faltam = daEtapa.filter((cd) => !tem(nomeDaDisciplina(cd))),
    outras = disciplinasCadastradas().filter(
      (x) => !tem(nomeDaDisciplina(x)) && !acharDiscCadastro(ce, nomeDaDisciplina(x)),
    ),
    rot = (x) => x.nome + (x.sigla ? " (" + x.sigla + ")" : ""),
    ops = [];
  if (faltam.length > 1) ops.push({ v: "*", l: "Todas as que faltam do cadastro (" + faltam.length + ")" });
  [...faltam, ...daEtapa.filter((cd) => !faltam.includes(cd))].forEach((cd) =>
    ops.push({
      v: cd.id,
      l:
        rot(cd) +
        " · " +
        plural(cd.atividades.length, "atividade", "atividades") +
        (tem(nomeDaDisciplina(cd)) ? " · completar a existente" : ""),
    }),
  );
  outras.forEach((x) =>
    ops.push({ v: "n:" + nomeDaDisciplina(x), l: rot(x) + " · sem atividades nesta etapa" }),
  );
  ops.push({ v: "", l: "Outra (digite o nome)" });
  return ops;
}

// Adiciona disciplina(s) na etapa ei conforme a opção escolhida (valor de opcoesNovaDisciplina).
// Se a disciplina já existir na etapa, completa com as atividades do cadastro que faltam.
// Devolve { erro } ou { msg, di } (di = disciplina a abrir).
function adicionarDisciplina(ei, valor, nomeLivre) {
  const e = estado.etapas[ei],
    ce = e && cadastroDaEtapa(e);
  if (!e) return { erro: "Etapa não encontrada." };
  const existe = (nome) => e.disciplinas.findIndex((d) => normalizar(d.nome) === normalizar(nome));
  if (valor === "*") {
    const novas = ce.disciplinas.filter((cd) => existe(nomeDaDisciplina(cd)) < 0);
    if (!novas.length) return { erro: "Todas as disciplinas do cadastro já estão nesta etapa." };
    const di = e.disciplinas.length;
    novas.forEach((cd) => e.disciplinas.push(novaDisciplina(nomeDaDisciplina(cd), ce, cd)));
    return {
      di,
      msg:
        plural(novas.length, "disciplina adicionada", "disciplinas adicionadas") +
        " em " +
        e.nome +
        ": " +
        novas.map(nomeDaDisciplina).join(", ") +
        ".",
    };
  }
  const cd = ce && valor && !valor.startsWith("n:") ? ce.disciplinas.find((x) => x.id === valor) : null,
    nome = cd
      ? nomeDaDisciplina(cd)
      : valor.startsWith("n:")
        ? valor.slice(2)
        : String(nomeLivre || "").trim();
  if (!nome) return { erro: "Informe o nome da disciplina." };
  const ja = existe(nome);
  if (ja >= 0 && !cd) return { erro: 'A disciplina "' + nome + '" já está em ' + e.nome + "." };
  if (ja >= 0) {
    const r = carregarAtividadesDoCadastro(e.disciplinas[ja], cd.atividades);
    return {
      di: ja,
      msg:
        rotuloDisc(e, e.disciplinas[ja]) +
        ": " +
        r.na +
        " atividade(s) do cadastro acrescentada(s); " +
        r.sk +
        " já estavam na disciplina.",
    };
  }
  const d = novaDisciplina(nome, ce, cd);
  e.disciplinas.push(d);
  return {
    di: e.disciplinas.length - 1,
    msg:
      'Disciplina "' +
      rotuloDisc(e, d) +
      '" adicionada' +
      (cd ? " com " + d.blocos[0].it.length + " atividade(s) do cadastro." : " em branco."),
  };
}

// Janela "+ Disciplina" (janela.arg = posição da etapa)
function janelaNovaDisciplina() {
  const e = estado.etapas[janela.arg];
  if (!e) return ["Nova disciplina", ""];
  const ops = opcoesNovaDisciplina(e);
  return [
    "Nova disciplina em " + e.nome,
    `<label class="df" style="justify-content:flex-start">Disciplina <select id="ddsel" style="flex:1" aria-label="Disciplina do cadastro">` +
      ops.map((o) => `<option value="${escaparHtml(o.v)}">${escaparHtml(o.l)}</option>`).join("") +
      `</select></label>` +
      `<input id="ddnome" placeholder="Nome da disciplina (ex.: SPDA)" aria-label="Nome da disciplina"${ops.length > 1 ? " hidden" : ""}>` +
      (cadastroDaEtapa(e)
        ? ""
        : `<p class="note" style="margin:0">Sem cadastro para ${escaparHtml(e.nome)}: use <b>Cadastros</b> para ter disciplinas prontas.</p>`) +
      `<p class="note" id="ddmsg">${escaparHtml(janela.msg || "")}</p>` +
      `<div class="df" style="justify-content:flex-end"><button data-dclose>Cancelar</button>` +
      `<button class="p" data-ddok>Adicionar</button></div>`,
  ];
}

function desenharEtapas() {
  const p = projetos[idProjetoAberto];
  if (!p) return;
  $("enm").textContent = p.name;
  document.body.dataset.tela = "etapas";
  $("ebcp").textContent = p.name;
  if (document.activeElement !== $("ehd")) $("ehd").value = estado.hd;
  $("epecnt").textContent = plural((estado.pe || []).length, "pessoa", "pessoas");
  const T = { E: 0, U: 0, R: 0, D: 0, n: 0, nd: 0 },
    av = [],
    t0 = hoje(),
    gr = [],
    pct = (z) => (z.E ? Math.round((z.D / z.E) * 100) : 0),
    selos = (z, extra) => {
      const [st, c] = situacaoEtapa(z),
        over = z.E > 0 && z.U > z.E + 1 / 120;
      return (
        `<span class="stc ${c}">${st}</span>${over ? ' <span class="stc bad">Tempo excedido</span>' : ""}` +
        (extra || "")
      );
    };
  let rows = "";
  estado.etapas.forEach((e, ei) => {
    const z = totaisEtapa(e),
      ce = cadastroDaEtapa(e),
      over = z.E > 0 && z.U > z.E + 1 / 120,
      fc = previsaoTermino(e),
      fin = z.n && z.nd === z.n,
      atr = !!(e.fim && e.fim < t0 && !fin),
      prev = fc && !fc.done ? fc.date : "",
      pos = !!(prev && e.fim && prev > e.fim);
    for (const q in T) T[q] += z[q];
    if (over)
      av.push(
        `<p class="r">● ${escaparHtml(e.nome)}: usado ${fmtHoras(z.U)} de ${fmtHoras(z.E)} estimados (+${fmtHoras(z.U - z.E)})</p>`,
      );
    if (atr)
      av.push(
        `<p class="r">● ${escaparHtml(e.nome)}: a data de fim (${dataBR(e.fim)}) já passou e a etapa não está concluída</p>`,
      );
    if (pos)
      av.push(
        `<p class="a">● ${escaparHtml(e.nome)}: a previsão de término (${dataBR(prev)}) passa da data de fim (${dataBR(e.fim)}) em ${Math.max(1, contarDiasUteis(somarDias(e.fim, 1), prev))} dia(s) útil(eis)</p>`,
      );
    gr.push({
      l: e.nome,
      s: e.ini || "",
      e: e.fim || "",
      k: "gb-etapa",
      t: e.nome + " · " + dataBR(e.ini || "") + " → " + dataBR(e.fim || ""),
    });
    if (prev)
      gr.push({
        l: "   previsão " + e.nome,
        s: t0,
        e: prev,
        k: "gb-fc",
        t: "Previsão de término: " + dataBR(prev),
      });
    rows +=
      `<tr class="grp"><td><input class="en" data-en="${ei}" value="${escaparHtml(e.nome)}" aria-label="Nome da etapa">` +
      `${ce && normalizar(ce.nome) !== normalizar(e.nome) ? `<span class="cadnome">${escaparHtml(ce.nome)}</span>` : ""}</td>` +
      `<td class="tn">${fmtHoras(z.E)}</td><td class="tn">${fmtHoras(z.U)}</td><td class="tn">${fmtHoras(z.R)}</td>` +
      `<td class="tn">${pct(z)}%</td>` +
      `<td class="dt"><input type="date" data-eini="${ei}" value="${escaparHtml(e.ini || "")}" aria-label="Início da etapa"></td>` +
      `<td class="dt"><input type="date" data-efim="${ei}" value="${escaparHtml(e.fim || "")}" class="${atr ? "late" : ""}" aria-label="Data de fim da etapa"></td>` +
      `<td class="tn">${prev ? dataBR(prev) : fc && fc.done ? "concluída" : "—"}${fc && !fc.done ? `<div class="note" style="margin:0;font-size:11px;font-weight:400">${fc.real ? "ritmo real " + fc.rate.toFixed(1).replace(".", ",") + " h/dia" : "ritmo planejado " + estado.hd + " h/dia"}</div>` : ""}</td>` +
      `<td>${selos(z, (atr ? ' <span class="stc bad">Fim ultrapassado</span>' : "") + (pos ? ' <span class="stc bad">Previsão após o fim</span>' : ""))}</td>` +
      `<td><div class="df"><button class="p" data-eabr="${ei}" title="Abrir a etapa (atividades por disciplina)">Abrir</button>` +
      `<span class="dd"><button class="ico" data-dd aria-haspopup="menu" aria-expanded="false" title="Mais opções da etapa" aria-label="Mais opções da etapa ${escaparHtml(e.nome)}">⋯</button>` +
      `<span class="ddm" role="menu" hidden><button data-eabr="${ei}" role="menuitem">↗ Abrir etapa</button><span class="dds"></span>` +
      `<button class="dang" data-edel="${ei}" role="menuitem">× Excluir etapa</button></span></span></div></td></tr>`;
    // avisos das disciplinas e atividades da etapa
    e.disciplinas.forEach((d) => {
      const rot = rotuloDisc(e, d),
        zd = totaisEtapa(d);
      if (zd.E > 0 && zd.U > zd.E + 1 / 120)
        av.push(
          `<p class="r">● ${escaparHtml(rot)}: usado ${fmtHoras(zd.U)} de ${fmtHoras(zd.E)} estimados (+${fmtHoras(zd.U - zd.E)})</p>`,
        );
      d.blocos.forEach((b) =>
        b.it.forEach((i) => {
          if (!estaSemAcao(i.s) && i.e > 0 && usadoAtual(i) > i.e + 1 / 120)
            av.push(
              `<p class="r">● ${escaparHtml(rot)} / ${escaparHtml(b.n)}: ${escaparHtml(i.d)} usou ${fmtHoras(usadoAtual(i))} de ${fmtHoras(i.e)}</p>`,
            );
        }),
      );
    });
  });
  $("et").innerHTML =
    `<thead><tr><th>Etapa</th><th class="tn">Estimado</th><th class="tn">Usado</th><th class="tn">Restante</th><th class="tn">Avanço</th><th>Início</th><th>Fim</th><th class="tn">Previsão</th><th>Status</th><th></th></tr></thead><tbody>` +
    (rows ||
      '<tr><td colspan="10"><span class="note">Nenhuma etapa ainda. Clique em “+ Etapa” para adicionar a primeira.</span></td></tr>') +
    (estado.etapas.length
      ? `<tr class="tt"><td>Total do projeto</td><td class="tn">${fmtHoras(T.E)}</td>` +
        `<td class="tn">${fmtHoras(T.U)}</td><td class="tn">${fmtHoras(T.R)}</td><td class="tn">${pct(T)}%</td>` +
        `<td></td><td></td><td></td><td></td><td></td></tr>`
      : "") +
    "</tbody>";
  // "+ Etapa": etapas do cadastro que o projeto ainda não tem, ou outra
  const keep = $("ds").value,
    livres = cadastros.filter((c) => !estado.etapas.some((e) => cadastroDaEtapa(e) === c));
  $("ds").innerHTML =
    livres
      .map(
        (c) =>
          `<option value="${escaparHtml(c.id)}">${escaparHtml(c.nome)} · ${plural(c.disciplinas.length, "disciplina", "disciplinas")} no cadastro</option>`,
      )
      .join("") + '<option value="">Outra (digite o nome)</option>';
  if ([...$("ds").options].some((o) => o.value === keep)) $("ds").value = keep;
  $("dn2").hidden = $("ds").value !== "";
  $("eg").innerHTML = gr.some((r) => r.s || r.e)
    ? htmlCronograma(gr)
    : '<p class="note" style="padding:10px 12px">Preencha o início e o fim das etapas para ver o cronograma.</p>';
  $("eal").innerHTML = av.length
    ? `<div class="alerts"><b>Avisos (${av.length})</b>${av.join("")}</div>`
    : '<div class="alerts none">Nenhuma etapa ou atividade acima do estimado e nenhuma etapa com a data de fim ultrapassada ou com previsão fora do prazo.</div>';
}

async function irParaInicio() {
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
  desenharInicio();
}

// ---------- Ações dos botões: projetos e etapas ----------

acao("#eback", () => irParaInicio());

// Abrir a etapa: vai para as atividades da última disciplina aberta nela (ou da primeira).
// Etapa sem disciplinas: pede a primeira disciplina antes.
acao("data-eabr", (v) => abrirEtapa(+v));

function abrirEtapa(ei) {
  const e = estado.etapas[ei];
  if (!e) return;
  if (!e.disciplinas.length) return void abrirJanela("dadd", ei);
  abrirDisciplina(ei, Math.min(discLembrada[e.id] || 0, e.disciplinas.length - 1));
}
acao("#back", () => voltarParaEtapas());

// Cronograma das etapas: recolher e mostrar (lembrado no navegador)
let cronogramaRecolhido = false;
try {
  cronogramaRecolhido = localStorage.getItem("phcg") === "1";
} catch (e) {}
function aplicarCronogramaRecolhido() {
  $("eg").hidden = cronogramaRecolhido;
  $("tgcgi").textContent = cronogramaRecolhido ? "▸" : "▾";
  $("tgcg").setAttribute("aria-expanded", String(!cronogramaRecolhido));
  $("tgcg").title = cronogramaRecolhido ? "Mostrar o cronograma" : "Recolher o cronograma";
}
aplicarCronogramaRecolhido();
acao("#tgcg", () => {
  cronogramaRecolhido = !cronogramaRecolhido;
  try {
    localStorage.setItem("phcg", cronogramaRecolhido ? "1" : "0");
  } catch (e) {}
  aplicarCronogramaRecolhido();
});
acao("data-open", (id) => abrirProjeto(id));

// Criar projeto (ou salvar o nome, quando editando)

acao("data-pdel", (pid) => {
  const p = projetos[pid];
  confirmar(
    'Excluir o projeto "' + p.name + '" e todas as suas atividades? Não dá para desfazer.',
    async () => {
      await excluirProjeto(p.id);
      desenharInicio();
    },
  );
});

// ---------- Ações: etapas e disciplinas do projeto ----------

const msgEtapas = (t) => {
  $("emsg").textContent = t;
  $("enfm").textContent = $("enf").hidden ? "" : t; // aviso também dentro do menu "+ Etapa"
};
const temCronometroEm = (blocos) =>
  estado.run && blocos.some((b) => b.it.some((i) => i.id === estado.run.id));

// + Etapa (do cadastro ou com outro nome)
acao("#da", () => {
  const ce = cadastroPorId($("ds").value),
    nome = ce ? ce.nome : $("dn2").value.trim();
  if (!nome) {
    $("dn2").hidden = false;
    $("dn2").focus();
    return msgEtapas("Informe o nome da etapa.");
  }
  if (estado.etapas.some((e) => normalizar(e.nome) === normalizar(nome)))
    return msgEtapas('A etapa "' + nome + '" já está no projeto.');
  estado.etapas.push(novaEtapa(nome, ce));
  salvar();
  fecharMenus();
  $("dn2").value = "";
  desenharEtapas();
  msgEtapas('Etapa "' + nome + '" adicionada. Agora escolha as disciplinas dela.');
  abrirJanela("dadd", estado.etapas.length - 1);
});

acao("data-edel", (v) => {
  const ei = +v,
    e = estado.etapas[ei];
  if (!e) return;
  confirmar(
    'Excluir a etapa "' +
      e.nome +
      '" com as suas ' +
      plural(e.disciplinas.length, "disciplina", "disciplinas") +
      " e todas as atividades?",
    () => {
      // a etapa leva junto o cronômetro que estiver rodando nela
      if (temCronometroEm(e.disciplinas.flatMap((d) => d.blocos))) estado.run = null;
      estado.etapas.splice(ei, 1);
      salvar();
      desenharEtapas();
      atualizarBarraCronometro();
    },
  );
});

// ---------- Ações: disciplinas da etapa aberta (botões ao lado das disciplinas) ----------

// "+ Disciplina": janela com as opções do cadastro
acao("data-dadd", () => abrirJanela("dadd", estado.ei));

acao(
  "data-ddok",
  () => {
    const ei = janela.arg,
      r = adicionarDisciplina(ei, $("ddsel").value, $("ddnome").value);
    if (r.erro) {
      janela.msg = r.erro;
      $("ddmsg").textContent = r.erro;
      if ($("ddsel").value === "") (($("ddnome").hidden = false), $("ddnome").focus());
      return;
    }
    fecharJanela();
    if (telaAtual === "etapa" && estado.ei === ei) {
      estado.di = r.di;
      discLembrada[estado.etapaAberta.id] = r.di;
      selecionadas.clear();
    } else abrirDisciplina(ei, r.di);
    mensagemEscopo = r.msg;
    salvar();
    desenhar();
  },
  { janela: true },
);

// Botão de cada disciplina: abre as atividades dela
acao(
  "data-tab",
  (v) => {
    if (!estado.etapaAberta.disciplinas[+v]) return false;
    estado.di = +v;
    discLembrada[estado.etapaAberta.id] = +v;
    selecionadas.clear();
    mensagemEscopo = "";
    window.scrollTo(0, 0);
  },
  SALVA,
);

acao("data-dren", () => {
  const e = estado.etapaAberta,
    d = estado.discAberta;
  abrirJanelaTexto({
    title: "Renomear disciplina",
    label: "Novo nome",
    val: d.nome,
    ok: (v) => {
      const n = v.trim();
      if (!n) return "Informe o nome.";
      if (n === d.nome) return "";
      if (e.disciplinas.some((x) => x !== d && normalizar(x.nome) === normalizar(n)))
        return "Já existe uma disciplina com esse nome nesta etapa.";
      d.nome = n;
      salvar();
      return "";
    },
  });
});

acao("data-ddel", () => {
  const e = estado.etapaAberta,
    d = estado.discAberta,
    n = d.blocos.reduce((a, b) => a + b.it.length, 0);
  confirmar(
    'Excluir a disciplina "' + rotuloDisc(e, d) + '"' + (n ? " e as suas " + n + " atividades" : "") + "?",
    () => {
      if (temCronometroEm(d.blocos)) estado.run = null;
      e.disciplinas.splice(estado.di, 1);
      atualizarBarraCronometro();
      if (!e.disciplinas.length) {
        voltarParaEtapas();
        return msgEtapas('A etapa "' + e.nome + '" ficou sem disciplinas.');
      }
      estado.di = Math.min(estado.di, e.disciplinas.length - 1);
      discLembrada[e.id] = estado.di;
      selecionadas.clear();
      desenhar();
      salvar();
    },
  );
});

// 💾 Salvar no cadastro: as atividades do bloco "Escopo + Geral" da disciplina aberta viram
// (ou completam) a disciplina de mesmo nome na etapa do cadastro (cria o que faltar)
acao(
  "#scsv",
  () => {
    const e = estado.etapaAberta,
      d = estado.discAberta,
      escopo = d.blocos.find(ehBlocoEscopo),
      nomes = (escopo ? escopo.it : []).map((i) => (i.d || "").trim()).filter(Boolean);
    if (!nomes.length) {
      mensagemEscopo = "O bloco " + NOME_BLOCO_ESCOPO + " de " + rotuloDisc(e, d) + " está vazio.";
      return;
    }
    let ce = cadastroDaEtapa(e);
    if (!ce) {
      ce = { id: novoIdCadastro("t"), nome: e.nome, ordem: cadastros.length, disciplinas: [] };
      cadastros.push(ce);
    }
    e.cadastroId = ce.id;
    let cd = ce.disciplinas.find((x) => x.id === d.cadastroDiscId) || acharDiscCadastro(ce, d.nome),
      n = 0;
    if (!cd) {
      const conhecida = disciplinasCadastradas().find(
        (x) => normalizar(nomeDaDisciplina(x)) === normalizar(d.nome),
      );
      cd = {
        id: novoIdCadastro("c"),
        nome: conhecida ? conhecida.nome : d.nome,
        sigla: conhecida ? conhecida.sigla : d.nome.toUpperCase(),
        atividades: [],
      };
      ce.disciplinas.push(cd);
    }
    d.cadastroDiscId = cd.id;
    nomes.forEach((x) => {
      if (!cd.atividades.some((a) => normalizar(a) === normalizar(x))) (cd.atividades.push(x), n++);
    });
    gravarCadastro(ce);
    mensagemEscopo =
      "Cadastro " +
      ce.nome +
      " · " +
      cd.nome +
      ": " +
      n +
      " atividade(s) acrescentada(s) (" +
      cd.atividades.length +
      " no total).";
  },
  SALVA,
);

// Janela de confirmação (ask)
acao("#dy", () => {
  $("dlg").close();
  const f = acaoConfirmada;
  acaoConfirmada = null;
  if (f) f();
});
acao("#dn", () => {
  $("dlg").close();
  acaoConfirmada = null;
});

// Enter no nome da etapa adiciona; na janela "+ Disciplina", adiciona a disciplina
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const t = e.target;
  if (t.id === "dn2" && telaAtual === "etapas") {
    e.preventDefault();
    $("da").click();
  } else if (t.id === "ddnome" || t.id === "ddsel") {
    e.preventDefault();
    document.querySelector("[data-ddok]").click();
  }
});

// ---------- Novo projeto: em branco, cópia de outro projeto ou Excel ----------

const DICAS_NOVO = {
  branco:
    "Cria o projeto com a etapa e as disciplinas escolhidas (com as atividades do cadastro). Outras etapas podem ser adicionadas depois.",
  copia:
    "Copia etapas, disciplinas, o Escopo + Geral e os pavimentos com as atividades. Zera horas usadas, registro diário, datas e status; mantém estimado e responsáveis; descarta comentários e apontamentos.",
  excel:
    "Planilha de planejamento ou Excel exportado por esta ferramenta (o nome do arquivo vira o nome do projeto, se você não digitar outro).",
};
const modoNovoProjeto = () => (document.querySelector('[name="pmodo"]:checked') || {}).value || "branco";

// Disciplinas da etapa escolhida, para marcar (todas vêm marcadas)
function desenharDisciplinasNovoProjeto() {
  const ce = cadastroPorId($("pet").value);
  $("pdisc").innerHTML = ce
    ? ce.disciplinas.length
      ? ce.disciplinas
          .map(
            (cd) =>
              `<label title="${plural(cd.atividades.length, "atividade", "atividades")} no cadastro"><input type="checkbox" value="${escaparHtml(cd.id)}" checked> ${escaparHtml(cd.nome)}</label>`,
          )
          .join("")
      : `<span class="note">A etapa ${escaparHtml(ce.nome)} não tem disciplinas no cadastro. Use <b>Cadastros</b> para incluir.</span>`
    : '<span class="note">Sem etapa: o projeto começa vazio e as etapas são adicionadas depois.</span>';
}

// Mostra só os campos da forma escolhida
function atualizarFormularioNovo() {
  const editando = !!projetoEmEdicao,
    modo = modoNovoProjeto(),
    ids = Object.keys(projetos).sort((a, b) => projetos[a].name.localeCompare(projetos[b].name));
  $("pmodosl").hidden = editando;
  $("petl").hidden = editando || modo !== "branco";
  $("pdiscs").hidden = editando || modo !== "branco";
  $("pcpl").hidden = editando || modo !== "copia";
  $("pfl").hidden = editando || modo !== "excel";
  $("pdica").textContent = editando ? "" : DICAS_NOVO[modo];
  $("pmsg").textContent = "";
  const kp = $("pcp").value;
  $("pcp").innerHTML = ids.length
    ? ids.map((id) => `<option value="${id}">${escaparHtml(projetos[id].name)}</option>`).join("")
    : '<option value="">Nenhum projeto para copiar</option>';
  if (projetos[kp]) $("pcp").value = kp;
}

function abrirFormularioProjeto() {
  atualizarFormularioNovo();
  if (!$("npf").open) $("npf").showModal();
  $("pn").focus();
}

acao("#newp", () => {
  projetoEmEdicao = null;
  $("npt").textContent = "Novo projeto";
  $("pn").value = "";
  document.querySelector('[name="pmodo"][value="branco"]').checked = true;
  $("pf").value = "";
  $("pc").textContent = "Criar projeto";
  // etapas do cadastro (a primeira vem escolhida) ou nenhuma
  $("pet").innerHTML =
    cadastros
      .map((c, k) => `<option value="${escaparHtml(c.id)}">${k + 1}. ${escaparHtml(c.nome)}</option>`)
      .join("") + '<option value="">Nenhuma (adicionar depois)</option>';
  desenharDisciplinasNovoProjeto();
  abrirFormularioProjeto();
});

acao("#px", () => fecharFormularioProjeto());
acao("#pxx", () => fecharFormularioProjeto());
$("npf").addEventListener("close", () => (projetoEmEdicao = null));

// Criar projeto (ou salvar o nome, quando editando)
acao("#pc", () => {
  let n = $("pn").value.trim();
  if (projetoEmEdicao) {
    if (!n) return $("pn").focus();
    projetos[projetoEmEdicao].name = n;
    gravarProjeto(projetoEmEdicao);
    fecharFormularioProjeto();
    desenharInicio();
    return;
  }
  const modo = modoNovoProjeto();
  if (modo === "excel") {
    const f = $("pf").files[0];
    if (!f) return avisoNovoProjeto("Escolha o arquivo Excel para importar.");
    importarProjeto(n || f.name.replace(/\.[^.]+$/, ""));
    return;
  }
  if (!n) {
    avisoNovoProjeto("Digite o nome do projeto.");
    return $("pn").focus();
  }
  if (modo === "copia" && !projetos[$("pcp").value]) return avisoNovoProjeto("Escolha o projeto a copiar.");
  const id = novoIdProjeto(),
    origem = modo === "copia" ? projetos[$("pcp").value] : null,
    dados = dadosNovoProjeto(origem ? "copy:" + origem.id : "vazio"),
    ce = !origem && cadastroPorId($("pet").value),
    marcadas = [...$("pdisc").querySelectorAll("input:checked")].map((x) => x.value);
  // "Novo": já com a etapa escolhida e as disciplinas marcadas (com as atividades do cadastro)
  if (ce) {
    const e = novaEtapa(ce.nome, ce);
    ce.disciplinas
      .filter((cd) => marcadas.includes(cd.id))
      .forEach((cd) => e.disciplinas.push(novaDisciplina(nomeDaDisciplina(cd), ce, cd)));
    dados.etapas.push(e);
  }
  projetos[id] = {
    id,
    name: n,
    etapa: origem ? origem.etapa : ce ? ce.nome : "",
    j: JSON.stringify(dados),
    upd: Date.now(),
  };
  gravarProjeto(id);
  fecharFormularioProjeto();
  abrirProjeto(id);
  if (origem)
    msgEtapas('Projeto copiado de "' + origem.name + '". Horas usadas, datas e status começam do zero.');
  else if (ce)
    msgEtapas(
      'Projeto criado com a etapa "' +
        ce.nome +
        '"' +
        (marcadas.length
          ? " e " +
            plural(marcadas.length, "disciplina", "disciplinas") +
            '. Clique em "Abrir" para ver as atividades.'
          : " (sem disciplinas)."),
    );
});

acao("data-pedit", (pid) => {
  const p = projetos[pid];
  projetoEmEdicao = p.id;
  $("npt").textContent = "Editar projeto";
  $("pn").value = p.name;
  $("pc").textContent = "Salvar";
  abrirFormularioProjeto();
});

// Enter no nome cria; escolher um arquivo sugere o nome
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "pn" && $("npf").open) {
    e.preventDefault();
    $("pc").click();
  }
});
