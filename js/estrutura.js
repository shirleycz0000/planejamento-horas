// Estrutura dos dados de um projeto e conversão entre formatos.
//
// Formato atual (versão 3) — Projeto > Etapa > Disciplina > Blocos > Atividades
//   { versao: 3, hd, run, pe, status, cal,
//     etapas: [{ id, nome, cadastroId, ini, fim,
//       disciplinas: [{ id, nome, escopo, escopoId,
//         blocos: [{ n: nome, tipo?: "escopo", it: [atividade] }] }] }] }
//   As datas (início e fim) ficam só na etapa. O primeiro bloco de cada disciplina é o
//   "Escopo + Geral" (tipo "escopo"): recebe as atividades do cadastro e aceita
//   atividades manuais. Depois vêm os pavimentos e, no fim, "Apontamentos a atender".
//
// Formatos antigos (convertidos ao abrir o projeto, com cópia de segurança):
//   versão 2 (out/2026) — Projeto > Disciplina > Etapa:
//     { versao: 2, disciplinas: [{ id, nome, etapas: [{ id, nome, escopo, ini, fim, blocos }] }] }
//   formato 1 — Projeto > Etapa > Disciplina, com as disciplinas num objeto:
//     { etapas: [{ id, nome, escopo, escopoId, ini, fim, tab, disc: { ELT: [bloco] } }] }
//   formato 0 (o primeiro de todos) — uma etapa só: { hd, run, tab, disc: { ELT: [bloco] } }
//
// As atividades são iguais em todos os formatos (id, d, r, s, e, u, c, pr, cm, l, h, lg).

const VERSAO_DADOS = 3;
const NOME_BLOCO_ESCOPO = "Escopo + Geral";

const ehFormatoNovo = (d) =>
  !!d && d.versao >= 3 && Array.isArray(d.etapas) && d.etapas.every((e) => Array.isArray(e.disciplinas));
const ehFormato2 = (d) => !!d && Array.isArray(d.disciplinas);
const ehBlocoEscopo = (b) => b.tipo === "escopo" || normalizar(b.n) === normalizar(NOME_BLOCO_ESCOPO);

// Etapas no formato 1 (o formato 0 vira uma etapa só)
function etapasFormato1(d, nomeEtapa) {
  if (Array.isArray(d.etapas)) return d.etapas;
  return [{ id: "e1", nome: nomeEtapa || "", escopo: "", disc: d.disc || {} }];
}

// Garante o bloco "Escopo + Geral" no topo: o antigo "Geral" vira esse bloco;
// se não houver, cria um vazio.
function blocosComEscopo(blocos) {
  const bs = (blocos || []).slice();
  let k = bs.findIndex(ehBlocoEscopo);
  if (k < 0) k = bs.findIndex((b) => normalizar(b.n) === "geral");
  let escopo;
  if (k >= 0) {
    escopo = bs.splice(k, 1)[0];
    // o antigo "Geral" ganha o nome novo; um bloco de escopo renomeado pelo usuário mantém o nome
    if (escopo.tipo !== "escopo") Object.assign(escopo, { n: NOME_BLOCO_ESCOPO, tipo: "escopo" });
  } else escopo = { n: NOME_BLOCO_ESCOPO, tipo: "escopo", it: [] };
  return [escopo, ...bs];
}

// Junta datas: o início mais cedo e o fim mais tarde
const menorData = (a, b) => (!a ? b || "" : !b ? a : a < b ? a : b);
const maiorData = (a, b) => (!a ? b || "" : !b ? a : a > b ? a : b);

// Qualquer formato antigo → formato 3. Não altera o objeto recebido.
function converterParaNovo(dados, nomeEtapa) {
  if (ehFormatoNovo(dados)) return dados;
  const antigo = JSON.parse(JSON.stringify(dados)),
    novo = {};
  for (const k in antigo)
    if (!["etapas", "disc", "tab", "disciplinas", "versao"].includes(k)) novo[k] = antigo[k];
  novo.versao = VERSAO_DADOS;
  novo.etapas = [];
  if (ehFormato2(antigo)) {
    // versão 2: as etapas de mesmo nome em disciplinas diferentes viram uma etapa só
    const porNome = new Map();
    for (const d of antigo.disciplinas)
      for (const e of d.etapas || []) {
        const k = normalizar(e.nome);
        let et = porNome.get(k);
        if (!et) {
          et = {
            id: "e" + (porNome.size + 1),
            nome: e.nome || "",
            cadastroId: "",
            ini: "",
            fim: "",
            disciplinas: [],
          };
          porNome.set(k, et);
          novo.etapas.push(et);
        }
        et.ini = menorData(et.ini, e.ini);
        et.fim = maiorData(et.fim, e.fim);
        et.disciplinas.push({
          id: e.id || d.id + "-" + et.id,
          nome: d.nome,
          escopo: e.escopo || "",
          escopoId: e.escopoId || "",
          blocos: blocosComEscopo(e.blocos),
        });
      }
    return novo;
  }
  etapasFormato1(antigo, nomeEtapa).forEach((et, ke) => {
    const id = et.id || "e" + (ke + 1);
    novo.etapas.push({
      id,
      nome: et.nome || "",
      cadastroId: "",
      ini: et.ini || "",
      fim: et.fim || "",
      disciplinas: Object.keys(et.disc || {}).map((nd, kd) => ({
        id: id + "-d" + (kd + 1),
        nome: nd,
        escopo: et.escopo || "",
        escopoId: et.escopoId || "",
        blocos: blocosComEscopo(et.disc[nd]),
      })),
    });
  });
  return novo;
}

// Formato 3 → formato 1 (caminho de volta, usado nos testes)
function converterParaFormato1(dados) {
  if (!ehFormatoNovo(dados)) return dados;
  const novo = JSON.parse(JSON.stringify(dados)),
    antigo = {};
  for (const k in novo) if (k !== "etapas" && k !== "versao") antigo[k] = novo[k];
  antigo.etapas = novo.etapas.map((e) => {
    const d0 = e.disciplinas[0] || {},
      et = {
        id: e.id,
        nome: e.nome,
        escopo: d0.escopo || "",
        escopoId: d0.escopoId || "",
        ini: e.ini,
        fim: e.fim,
        tab: d0.nome,
        disc: {},
      };
    e.disciplinas.forEach((d) => {
      et.disc[d.nome] = d.blocos.map((b) => {
        if (b.tipo !== "escopo") return b;
        const { tipo, ...resto } = b;
        return { ...resto, n: "Geral" };
      });
    });
    return et;
  });
  return antigo;
}

// ---------- Leitura (qualquer formato; os antigos são lidos numa cópia convertida) ----------

// Percorre os blocos: fn(bloco, { etapa, disc, disciplina, ei, di, bi, ie }).
// etapa = objeto da etapa; disc = objeto da disciplina; disciplina = nome dela;
// ei / di = posição da etapa e da disciplina dentro dela; ie = posição do par etapa/disciplina.
// Se fn devolver true, para e devolve o bloco.
function percorrerBlocos(dados, fn, nomeEtapa) {
  if (!dados) return null;
  const x = converterParaNovo(dados, nomeEtapa);
  let ie = 0;
  for (let ei = 0; ei < x.etapas.length; ei++) {
    const e = x.etapas[ei];
    for (let di = 0; di < e.disciplinas.length; di++) {
      const d = e.disciplinas[di];
      for (let bi = 0; bi < d.blocos.length; bi++)
        if (fn(d.blocos[bi], { etapa: e, disc: d, disciplina: d.nome, ei, di, bi, ie }) === true)
          return d.blocos[bi];
      ie++;
    }
  }
  return null;
}

// Percorre as atividades: fn(atividade, { ...contexto do bloco, bloco }).
// Se fn devolver true, para e devolve a atividade.
function percorrerAtividades(dados, fn, nomeEtapa) {
  let achada = null;
  percorrerBlocos(
    dados,
    (b, c) => {
      for (const i of b.it)
        if (fn(i, { ...c, bloco: b }) === true) {
          achada = i;
          return true;
        }
    },
    nomeEtapa,
  );
  return achada;
}

// Pares etapa/disciplina em ordem: [{ etapa, disc, disciplina, ei, di, rot }]
function listarPares(dados, nomeEtapa) {
  const x = converterParaNovo(dados, nomeEtapa);
  return x.etapas.flatMap((e, ei) =>
    e.disciplinas.map((d, di) => ({
      etapa: e,
      disc: d,
      disciplina: d.nome,
      ei,
      di,
      rot: e.nome + " · " + d.nome,
    })),
  );
}

// Etapas do projeto (qualquer formato)
const listarEtapas = (dados, nomeEtapa) => converterParaNovo(dados, nomeEtapa).etapas;

// Cópia de segurança do formato antigo, guardada à parte (coleção "copias" do banco e
// navegador) quando o projeto é convertido. Guarda só a primeira cópia de cada formato.
// A cópia da versão 2 fica em "<id>-v2"; a dos formatos anteriores, em "<id>".
async function guardarCopiaFormatoAntigo(idProjeto, nome, json) {
  let v2 = false;
  try {
    v2 = ehFormato2(JSON.parse(json));
  } catch (e) {}
  const id = idProjeto + (v2 ? "-v2" : ""),
    copia = { nome, j: json, em: Date.now() };
  try {
    const c = JSON.parse(localStorage.getItem("phcopias") || "{}");
    if (!c[id]) {
      c[id] = copia;
      localStorage.setItem("phcopias", JSON.stringify(c));
    }
  } catch (e) {}
  if (banco)
    try {
      const atual = await banco.doc("copias/" + id).get();
      if (!atual.exists) await banco.doc("copias/" + id).set(copia);
    } catch (e) {}
}
