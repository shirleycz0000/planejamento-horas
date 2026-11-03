// Vínculo com o Google Agenda (conector "Google Calendar" do claude.ai; no site próprio,
// js/site.js oferece o mesmo "Google Calendar" falando direto com a API do Google).
//
// O botão "📅 Vincular Google Agenda" da tela inicial pede a permissão do conector; o
// login (e-mail e senha) acontece na tela do próprio Google, nunca nesta ferramenta.
// Depois de vinculado, cada uso do cronômetro (ao pausar ou trocar de atividade) vai para um
// evento particular na agenda principal, só com o nome do projeto: "⏱ Edifício JBLUE".
// O formato do evento é lido do próprio conector (describeTool) na hora de vincular.
//
// Blocos: usos seguidos do MESMO projeto, com pausa de até 6 min (JUNTAR_AGENDA_MS) e sem
// outro projeto no meio, ficam num evento só, que vai sendo esticado (update_event) a cada
// pausa. Trocar de atividade dentro do projeto não quebra o bloco; outro projeto, uma pausa
// maior ou a virada do dia começam um bloco novo. Sem update_event (conector que não tem),
// cada uso vira um evento, como antes.
//
// Fica guardado só neste navegador ("phgcal"): ligado, bloco aberto (bloco), ids dos eventos
// criados (ids: chave do bloco → id no Google), fila de envio e falhas.
// Itens da fila: { k: chave do bloco, op: "criar" | "atualizar", p, t0, t1 }.

const SERVIDOR_AGENDA = "Google Calendar",
  // nomes possíveis da ferramenta de criar evento (o primeiro que o conector tiver é usado)
  FERRAMENTAS_AGENDA = ["create_event", "gcal_create_event", "create_calendar_event"],
  FERRAMENTAS_ATUALIZAR = ["update_event", "gcal_update_event", "patch_event", "update_calendar_event"],
  CHAVE_AGENDA = "phgcal",
  MINIMO_AGENDA = 60000; // usos de menos de 1 minuto não vão para a agenda

let ferramentaAgenda = null,
  ferramentaAtualizar = null, // null: o conector não sabe atualizar evento (cada uso vira um evento)
  agenda = { ligado: false, pendentes: [], falhas: [], enviados: [], erro: "", bloco: null, ids: {} },
  esquemaAgenda = null,
  esquemaAtualizar = null,
  enviandoAgenda = false;
try {
  Object.assign(agenda, JSON.parse(localStorage.getItem(CHAVE_AGENDA) || "{}"));
} catch (e) {}

agenda.ids = agenda.ids || {};
agenda.pendentes.forEach((x) => delete x.emEnvio); // a página fechou no meio de um envio

const salvarAgendaLocal = () => {
  agenda.enviados = agenda.enviados.slice(-50);
  // só guarda os ids dos blocos que ainda podem ser citados (enviados recentes e fila)
  const vivos = new Set([...agenda.enviados, ...agenda.pendentes, ...agenda.falhas].map((x) => x.k));
  if (agenda.bloco) vivos.add(agenda.bloco.k);
  for (const k in agenda.ids) if (!vivos.has(k)) delete agenda.ids[k];
  try {
    localStorage.setItem(CHAVE_AGENDA, JSON.stringify(agenda));
  } catch (e) {}
};

async function mcpAgenda() {
  try {
    return await claude.use("mcp");
  } catch (e) {
    return null;
  }
}

// Data e hora locais com fuso: 2026-10-29T08:00:00-03:00
function isoLocal(ms) {
  const d = new Date(ms),
    off = -d.getTimezoneOffset(),
    p = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  return (
    dataISO(d) +
    "T" +
    p(d.getHours()) +
    ":" +
    p(d.getMinutes()) +
    ":" +
    p(d.getSeconds()) +
    (off >= 0 ? "+" : "-") +
    p(off / 60) +
    ":" +
    p(off % 60)
  );
}

// Monta a entrada do create_event a partir do esquema que o conector informa
function montarEvento(esquema, titulo, t0, t1) {
  const props = (esquema && esquema.properties) || {},
    fuso = Intl.DateTimeFormat().resolvedOptions().timeZone,
    entrada = {},
    achar = (nomes) => nomes.find((n) => n in props);
  const kT = achar(["summary", "title", "name", "subject"]),
    kI = achar(["start", "start_time", "startTime", "start_datetime", "startDateTime", "start_date_time"]),
    kF = achar(["end", "end_time", "endTime", "end_datetime", "endDateTime", "end_date_time"]);
  if (kT) entrada[kT] = titulo;
  const hora = (k, ms) => {
    const p = props[k] || {};
    if (p.type === "object" || p.properties) {
      const sp = p.properties || {},
        o = {};
      o["date_time" in sp && !("dateTime" in sp) ? "date_time" : "dateTime"] = isoLocal(ms);
      if ("timeZone" in sp) o.timeZone = fuso;
      else if ("time_zone" in sp) o.time_zone = fuso;
      entrada[k] = o;
    } else entrada[k] = isoLocal(ms);
  };
  if (kI) hora(kI, t0);
  if (kF) hora(kF, t1);
  const kFuso = achar(["timezone", "time_zone", "timeZone"]);
  if (kFuso && (props[kFuso] || {}).type !== "object") entrada[kFuso] = fuso;
  const kC = achar(["calendar_id", "calendarId"]);
  if (kC) entrada[kC] = "primary";
  const kD = achar(["description", "details", "notes"]);
  if (kD) entrada[kD] = "Registrado pelo Planejamento de Horas";
  const kV = achar(["visibility"]);
  if (kV) {
    const en = (props[kV] || {}).enum;
    if (!en || en.includes("private")) entrada[kV] = "private";
  }
  const faltam = ((esquema && esquema.required) || []).filter((k) => !(k in entrada));
  if (!kT || !kI || !kF || faltam.length)
    throw {
      code: "formato",
      message:
        "o conector pede campos que a ferramenta não reconhece (" +
        (faltam.join(", ") || "título/início/fim") +
        ")",
    };
  return entrada;
}

// Mensagem para cada situação do conector
const SITE = !!window.SITE_PROPRIO,
  SEM_AGENDA = SITE
    ? "A agenda ainda não foi configurada neste site (falta o googleClientId no config.js — veja o LEIA-ME)."
    : "A agenda só funciona com a ferramenta aberta no claude.ai.";

function mensagemErroAgenda(e) {
  const c = e && e.code;
  if (SITE && (c === "server_not_connected" || c === "needs_reauth"))
    return "O Google não liberou o acesso à agenda agora. Clique em Vincular Google Agenda (ou Verificar conexão) e escolha a sua conta Google.";
  if (SITE && (c === "consent_required" || c === "not_in_manifest" || c === "approval_required"))
    return "É preciso permitir o acesso à agenda na janela do Google. Clique em Vincular e marque a permissão do Google Agenda.";
  if (c === "server_not_connected" || c === "server_not_found")
    return "O Google Agenda não está conectado. No claude.ai, abra Configurações → Conectores, conecte o Google Agenda (o login é feito na tela do Google) e clique em Vincular de novo.";
  if (c === "needs_reauth")
    return "A conexão com o Google Agenda expirou. Reconecte em claude.ai → Configurações → Conectores e clique em Vincular de novo.";
  if (c === "selection_required")
    return "Há mais de um Google Agenda conectado: escolha qual usar no aviso do claude.ai.";
  if (c === "not_in_manifest" || c === "approval_required" || c === "consent_required")
    return "A ferramenta precisa da sua permissão para usar o Google Agenda. Clique em Vincular e permita.";
  if (c === "blocked_by_policy") return "A sua organização não permite o uso do Google Agenda aqui.";
  if (c === "formato") return "Não foi possível montar o evento: " + e.message + ".";
  if (c === "not_granted" || c === "capability_disabled" || c === "capability_removed") return SEM_AGENDA;
  if (c === "tool_error") return "O Google Agenda recusou o evento: " + (e.message || "erro") + ".";
  return "Falha ao falar com o Google Agenda" + (c ? " (" + c + ")" : "") + ".";
}

// "Nunca chegou ao conector": pode tentar de novo sem risco de duplicar
const erroAntesDoEnvio = (c) =>
  [
    "server_not_connected",
    "server_not_found",
    "needs_reauth",
    "selection_required",
    "not_in_manifest",
    "approval_required",
    "consent_required",
    "blocked_by_policy",
    "not_granted",
    "capability_disabled",
    "capability_removed",
    "formato",
    "bad_request",
  ].includes(c);

// Formato do Google Calendar (usado se o conector não informar o seu)
const ESQUEMA_PADRAO_AGENDA = {
  properties: {
    calendar_id: {},
    summary: {},
    description: {},
    start: { type: "object", properties: { dateTime: {}, timeZone: {} } },
    end: { type: "object", properties: { dateTime: {}, timeZone: {} } },
    visibility: {},
  },
};

// Descobre qual ferramenta de criar evento o conector tem e o formato dela
async function prepararFerramentaAgenda(mcp) {
  const lista = await mcp.listTools(SERVIDOR_AGENDA);
  const srv = (lista.servers || []).find((x) => x.server === SERVIDOR_AGENDA);
  if (!srv) throw { code: "server_not_connected" };
  if (srv.authStatus === "needs_reauth") throw { code: "needs_reauth" };
  const nomes = (srv.tools || []).map((t) => t.name);
  ferramentaAgenda = FERRAMENTAS_AGENDA.find((n) => nomes.includes(n)) || FERRAMENTAS_AGENDA[0];
  ferramentaAtualizar = FERRAMENTAS_ATUALIZAR.find((n) => nomes.includes(n)) || null;
  esquemaAtualizar = null;
  if (ferramentaAtualizar)
    try {
      esquemaAtualizar = (await mcp.describeTool(SERVIDOR_AGENDA, ferramentaAtualizar)).inputSchema || null;
    } catch (e) {}
  // só junta blocos se der para dizer ao conector qual evento atualizar
  const pa = (esquemaAtualizar && esquemaAtualizar.properties) || {};
  if (!["event_id", "eventId", "id"].some((k) => k in pa)) ferramentaAtualizar = null;
  try {
    esquemaAgenda =
      (await mcp.describeTool(SERVIDOR_AGENDA, ferramentaAgenda)).inputSchema || ESQUEMA_PADRAO_AGENDA;
  } catch (e) {
    if (e && (e.code === "server_not_connected" || e.code === "needs_reauth")) throw e;
    esquemaAgenda = ESQUEMA_PADRAO_AGENDA;
  }
}

async function vincularAgenda() {
  const mcp = await mcpAgenda();
  if (!mcp) {
    agenda.erro = SEM_AGENDA;
    return desenharJanela();
  }
  agenda.erro = "Conectando…";
  desenharJanela();
  try {
    const perm = await claude.use("permissions").catch(() => null);
    if (perm) {
      const r = await perm.request(["mcp:" + SERVIDOR_AGENDA]).catch(() => ({}));
      if (r["mcp:" + SERVIDOR_AGENDA] === "denied") throw { code: "consent_required" };
    }
    await prepararFerramentaAgenda(mcp);
    montarEvento(esquemaAgenda, "teste", Date.now(), Date.now() + MINIMO_AGENDA); // confere o formato
    agenda.ligado = true;
    agenda.erro = "";
    salvarAgendaLocal();
    mostrarMensagem("Google Agenda vinculado. Os horários trabalhados passam a ir para a sua agenda.");
  } catch (e) {
    agenda.erro = mensagemErroAgenda(e);
  }
  desenharBotaoAgenda();
  if (janela && janela.kind === "gcal") desenharJanela();
  enviarPendentesAgenda();
}

// Chamado quando o cronômetro termina um uso (pausa, troca de atividade, concluir…)
function agendaSessao(pid, t0, t1) {
  if (!agenda.ligado) return;
  t0 = Math.round(t0);
  t1 = Math.round(t1);
  const pj = projetos[pid],
    p = pj ? pj.name : "Projeto",
    b = agenda.bloco;
  // continua o bloco aberto: mesmo projeto, pausa curta, mesmo dia
  if (b && b.pid === pid && t0 - b.t1 <= JUNTAR_AGENDA_MS && t0 >= b.t0 && diaDe(t0) === diaDe(b.t0)) {
    if (t1 <= b.t1) return;
    b.t1 = t1;
    b.p = p;
    juntarNaFila(b);
  } else {
    // outro projeto (mesmo um uso curto) fecha o bloco anterior
    agenda.bloco = null;
    if (!(t1 - t0 >= MINIMO_AGENDA)) return void salvarAgendaLocal();
    const k = "b" + t0.toString(36) + Math.random().toString(36).slice(2, 5);
    agenda.bloco = { k, pid, p, t0, t1 };
    agenda.pendentes.push({ k, op: "criar", p, t0, t1 });
  }
  salvarAgendaLocal();
  enviarPendentesAgenda();
}

// O bloco cresceu: ajusta o que ainda não foi enviado ou pede para atualizar o evento
function juntarNaFila(b) {
  // o item que está sendo enviado agora não muda (o pedido já saiu); entra uma atualização depois dele
  const naFila = [...agenda.pendentes, ...agenda.falhas].find((x) => x.k === b.k && !x.emEnvio),
    saindo = agenda.pendentes.some((x) => x.k === b.k && x.emEnvio);
  if (naFila) {
    naFila.t0 = b.t0;
    naFila.t1 = b.t1;
    naFila.p = b.p;
    return;
  }
  if ((agenda.ids[b.k] || saindo) && ferramentaAtualizarDisponivel())
    agenda.pendentes.push({ k: b.k, op: "atualizar", p: b.p, t0: b.t0, t1: b.t1 });
  else {
    // conector sem atualização (ou evento sem id): o pedaço novo vira um evento próprio
    const k = "b" + b.t1.toString(36) + Math.random().toString(36).slice(2, 5),
      ult = agenda.enviados.filter((x) => x.k === b.k).pop(),
      ini = ult ? ult.t1 : b.t0;
    agenda.bloco = { ...b, k, t0: ini };
    agenda.pendentes.push({ k, op: "criar", p: b.p, t0: ini, t1: b.t1 });
  }
}

// Antes de vincular nesta sessão do navegador ainda não se sabe; supõe que sim (o site tem)
const ferramentaAtualizarDisponivel = () => (esquemaAgenda ? !!ferramentaAtualizar : true);

// Acha o id do evento criado na resposta do conector
function idDoEvento(r) {
  const cands = [r && r.payload, r && r.structuredContent, r && r.result];
  for (const c of cands)
    if (c && typeof c === "object" && typeof (c.id || c.event_id || c.eventId) === "string")
      return c.id || c.event_id || c.eventId;
  try {
    const t = ((r && r.content) || []).map((x) => x.text || "").join(" "),
      j = JSON.parse(t);
    if (j && typeof j.id === "string") return j.id;
  } catch (e) {}
  return null;
}

function montarAtualizacao(s) {
  const base = montarEvento(esquemaAgenda, "⏱ " + s.p, s.t0, s.t1),
    pa = (esquemaAtualizar && esquemaAtualizar.properties) || {},
    entrada = {},
    kId = ["event_id", "eventId", "id"].find((k) => k in pa);
  entrada[kId] = agenda.ids[s.k];
  // manda só o que muda (início, fim) e o que o conector exige (agenda)
  for (const k in base)
    if (k in pa && !/summary|title|name|subject|description|details|notes|visibility/.test(k))
      entrada[k] = base[k];
  return entrada;
}

async function enviarPendentesAgenda() {
  if (enviandoAgenda || !agenda.ligado || !agenda.pendentes.length) return;
  enviandoAgenda = true;
  try {
    const mcp = await mcpAgenda();
    if (!mcp) throw { code: "not_granted" };
    if (!esquemaAgenda) await prepararFerramentaAgenda(mcp);
    while (agenda.pendentes.length) {
      const s = agenda.pendentes[0];
      if (!s.k) s.k = "b" + s.t0.toString(36); // fila de versões antigas
      const atualizar = !!(s.op === "atualizar" && agenda.ids[s.k] && ferramentaAtualizar);
      if (s.op === "atualizar" && !atualizar) {
        // não dá para esticar o evento: só o pedaço que ainda não está na agenda vira um evento novo
        const ult = agenda.enviados.filter((x) => x.k === s.k).pop(),
          k = "b" + s.t1.toString(36) + Math.random().toString(36).slice(2, 5);
        if (ult) s.t0 = Math.max(s.t0, ult.t1);
        if (agenda.bloco && agenda.bloco.k === s.k) agenda.bloco = { ...agenda.bloco, k, t0: s.t0 };
        s.k = k;
        s.op = "criar";
        if (!(s.t1 > s.t0)) {
          agenda.pendentes.shift();
          continue;
        }
      }
      s.emEnvio = true;
      try {
        const r = await mcp.callTool(
          SERVIDOR_AGENDA,
          atualizar ? ferramentaAtualizar : ferramentaAgenda,
          atualizar ? montarAtualizacao(s) : montarEvento(esquemaAgenda, "⏱ " + s.p, s.t0, s.t1),
          { cache: false },
        );
        if (!atualizar) {
          const id = idDoEvento(r);
          if (id) agenda.ids[s.k] = id;
        }
        // o bloco aparece uma vez só em "Últimos enviados", com o horário mais recente
        agenda.enviados = agenda.enviados.filter((x) => x.k !== s.k);
        agenda.enviados.push({ k: s.k, p: s.p, t0: s.t0, t1: s.t1 });
        agenda.erro = "";
        delete s.emEnvio;
      } catch (e) {
        delete s.emEnvio;
        if (erroAntesDoEnvio(e && e.code)) throw e; // fica na fila
        if (atualizar && e && e.code !== "tool_error") {
          // atualizar de novo com o mesmo horário não duplica nada: fica na fila para tentar depois
          agenda.erro = mensagemErroAgenda(e);
          salvarAgendaLocal();
          break;
        }
        if (atualizar) {
          // o evento sumiu da agenda (ex.: apagado à mão): cria o bloco de novo
          delete agenda.ids[s.k];
          s.op = "criar";
          continue;
        }
        // resultado incerto (o evento pode ter sido criado): só reenvia se você pedir
        agenda.falhas.push(s);
        agenda.erro = mensagemErroAgenda(e);
      }
      agenda.pendentes.shift();
      salvarAgendaLocal();
    }
  } catch (e) {
    agenda.erro = mensagemErroAgenda(e);
    salvarAgendaLocal();
  } finally {
    enviandoAgenda = false;
    desenharBotaoAgenda();
    if (janela && janela.kind === "gcal") desenharJanela();
  }
}

const horarioSessao = (s) => dataBR(diaDe(s.t0)) + " " + horaMin(s.t0) + "–" + horaMin(s.t1) + " · " + s.p;

function desenharBotaoAgenda() {
  const b = $("gcal");
  if (!b) return;
  const problema0 = agenda.ligado && (agenda.falhas.length || agenda.pendentes.length || agenda.erro),
    chip = $("gchip"),
    sts = document.querySelectorAll(".gcalst");
  // aviso pequeno no topo (todas as telas) e situação no menu ⚙ Configurações
  if (chip) {
    chip.hidden = !agenda.ligado;
    chip.textContent = problema0 ? "📅 Agenda: verificar" : "📅 Agenda vinculada";
    chip.classList.toggle("bad", !!problema0);
  }
  for (const st of sts) {
    st.textContent = !agenda.ligado ? "não vinculada" : problema0 ? "verificar" : "vinculada";
    st.style.color = agenda.ligado ? (problema0 ? "var(--bad)" : "var(--ok)") : "";
  }
  const problema = agenda.ligado && (agenda.falhas.length || agenda.pendentes.length || agenda.erro);
  b.textContent = agenda.ligado
    ? problema
      ? "📅 Agenda: verificar"
      : "📅 Agenda vinculada ✓"
    : "📅 Vincular Google Agenda";
  b.classList.toggle("on2", !!agenda.ligado && !problema);
  b.title = agenda.ligado
    ? "Os horários trabalhados vão para o seu Google Agenda"
    : "Enviar os horários trabalhados para o seu Google Agenda";
}

function janelaAgenda() {
  const ult = agenda.enviados.slice(-5).reverse();
  return [
    "Google Agenda",
    `<p class="note" style="margin:0">Com a agenda vinculada, cada vez que você usa o cronômetro o horário vai para o seu Google Agenda como um <b>evento particular</b>, só com o <b>nome do projeto</b> (ex.: “⏱ Edifício JBLUE · 08:00–10:00”). Usos seguidos do mesmo projeto, com pausas de até 6 min, viram <b>um bloco só</b> (ex.: o turno da manhã). Vale para a ferramenta inteira. O login é feito na tela do Google; a ferramenta nunca vê o seu e-mail nem a sua senha.</p>` +
      `<div class="df" style="justify-content:flex-start;flex-wrap:wrap"><b>Situação:</b> ${
        agenda.ligado ? '<span class="stc ok">Vinculada</span>' : '<span class="stc mut">Não vinculada</span>'
      }${
        agenda.ligado && window.contaAgenda && window.contaAgenda()
          ? ` <span class="note" style="margin:0">· agenda de <b>${escaparHtml(window.contaAgenda())}</b></span>`
          : ""
      }</div>` +
      (agenda.ligado && SITE
        ? `<p class="note" style="margin:0">Para usar a agenda de outro e-mail, clique em <b>Desvincular</b> e depois em <b>Vincular Google Agenda</b>, e escolha a outra conta na janela do Google.</p>`
        : "") +
      (agenda.ligado
        ? ""
        : SITE
          ? `<ol class="note" style="margin:0;padding-left:18px"><li>Clique em <b>Vincular Google Agenda</b>.</li><li>Na janela do Google, escolha a conta da agenda — pode ser um e-mail diferente do login do site (use “Usar outra conta”, se ela não aparecer) — e permita o acesso ao <b>Google Agenda</b>.</li><li>Pronto: ao pausar ou trocar de atividade no cronômetro, o horário aparece na sua agenda.</li></ol>`
          : `<ol class="note" style="margin:0;padding-left:18px"><li>No claude.ai, abra <b>Configurações → Conectores</b> e conecte o <b>Google Agenda</b>. Lá você entra com o <b>e-mail e a senha</b> do seu Google, na tela do próprio Google.</li><li>Volte aqui e clique em <b>Vincular Google Agenda</b>; permita o acesso quando o claude.ai perguntar.</li><li>Pronto: ao pausar ou trocar de atividade no cronômetro, o horário aparece na sua agenda.</li></ol>`) +
      (agenda.erro
        ? `<p class="note" style="margin:0;color:var(--bad)">${escaparHtml(agenda.erro)}</p>`
        : "") +
      (agenda.pendentes.length
        ? `<p class="note" style="margin:0">Aguardando envio: ${agenda.pendentes.length} horário(s).</p>`
        : "") +
      (agenda.falhas.length
        ? `<div><b>Não confirmados (${agenda.falhas.length})</b><p class="note" style="margin:2px 0">Podem ter sido criados ou não. Confira a agenda antes de reenviar, para não duplicar.</p>` +
          agenda.falhas
            .map((s) => `<div class="note" style="margin:0">${escaparHtml(horarioSessao(s))}</div>`)
            .join("") +
          `<div class="df" style="justify-content:flex-start;margin-top:6px"><button data-gcre>Reenviar</button><button data-gcdesc>Descartar</button></div></div>`
        : "") +
      (ult.length
        ? `<div><b>Últimos enviados</b>${ult.map((s) => `<div class="note" style="margin:0">${escaparHtml(horarioSessao(s))}</div>`).join("")}</div>`
        : "") +
      `<div class="df" style="justify-content:flex-end">` +
      (agenda.ligado
        ? `<button data-gcoff title="Para de enviar os horários para a agenda">Desvincular</button><button class="p" data-gcon>Verificar conexão</button>`
        : `<button data-dclose>Agora não</button><button class="p" data-gcon>Vincular Google Agenda</button>`) +
      `</div>`,
  ];
}

acao("#gcal", () => abrirJanela("gcal"));
acao("#gchip", () => abrirJanela("gcal"));
acao("data-gcon", () => vincularAgenda(), { janela: true });
acao(
  "data-gcoff",
  () => {
    agenda.ligado = false;
    agenda.erro = "";
    agenda.pendentes = [];
    agenda.bloco = null;
    if (window.esquecerContaAgenda) window.esquecerContaAgenda(); // a próxima vinculação pede a conta de novo
    salvarAgendaLocal();
    desenharBotaoAgenda();
    desenharJanela();
  },
  { janela: true },
);
acao(
  "data-gcre",
  () => {
    agenda.pendentes.push(...agenda.falhas.map((x) => ({ ...x, op: "criar" })));
    agenda.falhas = [];
    salvarAgendaLocal();
    enviarPendentesAgenda();
    desenharJanela();
  },
  { janela: true },
);
acao(
  "data-gcdesc",
  () => {
    agenda.falhas = [];
    agenda.erro = "";
    salvarAgendaLocal();
    desenharBotaoAgenda();
    desenharJanela();
  },
  { janela: true },
);

desenharBotaoAgenda();
// ao abrir a ferramenta, envia o que ficou na fila (usos que nunca chegaram ao Google)
setTimeout(enviarPendentesAgenda, 3000);
