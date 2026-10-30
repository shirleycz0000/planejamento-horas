// Constantes, status e funções utilitárias (datas, horas, textos)

const RESPONSAVEIS_PADRAO = ["Shirley", "Milene", "Thalles", "Fabi"],
  NOMES_CORES = [
    "Cinza claro",
    "Azul claro",
    "Azul",
    "Verde",
    "Cinza escuro",
    "Amarelo",
    "Laranja",
    "Vermelho",
    "Roxo",
  ],
  COMPORTAMENTOS = {
    pend: "Em aberto (como Pendente)",
    and: "Em andamento",
    fp: "Falta publicar",
    ok: "Concluído (conta como feito)",
    sa: "Sem ação (fora dos totais)",
  };

const statusPadrao = () => [
  { n: "Pendente", r: "pend", c: 0 },
  { n: "Em andamento", r: "and", c: 1 },
  { n: "Falta publicar", r: "fp", c: 2 },
  { n: "Concluído", r: "ok", c: 3 },
  { n: "Sem ação", r: "sa", c: 4 },
];

let statusAtuais = statusPadrao(),
  nomesStatus = statusAtuais.map((q) => q.n);

const definirStatus = (a) => {
    statusAtuais = a && a.length ? a : statusPadrao();
    nomesStatus = statusAtuais.map((q) => q.n);
  },
  comportamentoDo = (n) => {
    const x = statusAtuais.find((q) => q.n === n);
    return x ? x.r : "pend";
  },
  estaConcluido = (n) => comportamentoDo(n) === "ok",
  estaSemAcao = (n) => comportamentoDo(n) === "sa",
  faltaPublicar = (n) => comportamentoDo(n) === "fp",
  estaEmAndamento = (n) => comportamentoDo(n) === "and",
  statusComComportamento = (r) =>
    (statusAtuais.find((q) => q.r === r) || statusAtuais.find((q) => q.r === "pend") || statusAtuais[0]).n,
  classeCorStatus = (n) => {
    const x = statusAtuais.find((q) => q.n === n);
    return "pc" + (x ? x.c : 0);
  };

const ehBlocoApontamentos = (n) => /^apontamento/i.test(n),
  campoDescricao = (i) =>
    `<input data-f="d" data-i="${i.id}" placeholder="Descrição" value="${escaparHtml(i.d)}">`;

const normalizarLink = (u) => {
  u = String(u || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    u = "https://" + u;
  }
  try {
    return new URL(u).href;
  } catch (e) {
    return "";
  }
};

const dataHoraBR = (t) =>
  t
    ? new Date(t)
        .toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
        .replace(",", "")
    : "";

const hoje = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};

const dataBR = (c) => (c ? c.split("-").reverse().join("/") : "");

const dataParaExcel = (c) => {
  if (!c) return "";
  const [y, m, d] = c.split("-").map(Number);
  return {
    t: "n",
    v: Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5),
    z: "dd/mm/yyyy",
  };
};

const REGEX_LINK = /(https?:\/\/\S+|\b(?:[\w-]+\.)+[a-z]{2,}\/\S+)/i,
  idDoApontamento = (h) => {
    try {
      return new URL(h).searchParams.get("issueId") || "";
    } catch (e) {
      return "";
    }
  };

const nomeDeArquivo = (n) =>
  String(n || "projeto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "projeto";

let contadorIds = 0;

const novoIdAtividade = () => "a" + Date.now().toString(36) + (++contadorIds).toString(36),
  novoIdEtapa = () => "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
  novoIdDisciplina = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

const normalizar = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const $ = (x) => document.getElementById(x),
  escaparHtml = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const fmtHoras = (h) => {
  const m = Math.round(Math.abs(h) * 60);
  return (
    (h < 0 ? "-" : "") + String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0")
  );
};

const fmtHorasSeg = (h) => {
  const t = Math.max(0, Math.floor(h * 3600)),
    f = (n) => String(n).padStart(2, "0");
  return f(Math.floor(t / 3600)) + ":" + f(Math.floor((t % 3600) / 60)) + ":" + f(t % 60);
};

const lerHoras = (v) => {
  v = String(v).trim();
  if (v.includes(":")) {
    const [a, b] = v.split(":");
    return Math.max(0, (+a || 0) + (+b || 0) / 60);
  }
  return Math.max(0, parseFloat(v.replace(",", ".")) || 0);
};

const emDias = (h) => (Math.round((h / estado.hd) * 2) / 2).toFixed(1).replace(".", ",");

const PRIORIDADES = { a: ["▲", "Alta", "pr-a"], m: ["●", "Média", "pr-m"], b: ["▼", "Baixa", "pr-b"] },
  ORDEM_PRIORIDADE = { a: 0, m: 1, b: 2 };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const dataISO = (d) =>
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0"),
  lerDataISO = (x) => new Date(x + "T12:00:00"),
  somarDias = (x, n) => {
    const d = lerDataISO(x);
    d.setDate(d.getDate() + n);
    return dataISO(d);
  },
  diasEntre = (a, b) => Math.round((lerDataISO(b) - lerDataISO(a)) / 864e5);

const DIAS_SEMANA = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
  ],
  NOMES_MESES = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ],
  DIAS_ABREV = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
