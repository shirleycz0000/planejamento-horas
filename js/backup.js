// Backup de tudo (.json): projetos, modelos e cadastros.
//
// Botão "💾 Backup ▾" da tela inicial. Serve para guardar uma cópia no computador e para
// levar os dados de uma versão da ferramenta para outra (ex.: do claude.ai para o site próprio).
// Restaurar junta com o que já existe: projeto ou modelo com o mesmo id fica com a versão
// mais recente; cadastro com o mesmo nome de etapa é substituído pelo do backup.

const FORMATO_BACKUP = "planejamento-horas-backup";

function montarBackup() {
  const copia = (o) => JSON.parse(JSON.stringify(o));
  return {
    formato: FORMATO_BACKUP,
    versao: 1,
    criadoEm: new Date().toISOString(),
    projetos: Object.values(projetos).map((p) => ({
      id: p.id,
      name: p.name,
      etapa: p.etapa || "",
      j: p.j,
      upd: p.upd || 0,
    })),
    modelos: Object.values(modelosSalvos).map(copia),
    cadastros: cadastros.map(copia),
  };
}

async function baixarBackup() {
  await salvarAoSair();
  const b = montarBackup(),
    nome = "backup-planejamento-" + hoje() + ".json",
    texto = JSON.stringify(b);
  try {
    const dl = await claude.use("downloads");
    if (!dl) throw new Error("sem downloads");
    await dl.save({ filename: nome, data: texto });
    mostrarMensagem(
      `Backup baixado: ${plural(b.projetos.length, "projeto", "projetos")}, ` +
        `${plural(b.modelos.length, "modelo", "modelos")} e ${plural(b.cadastros.length, "etapa", "etapas")} do cadastro.`,
    );
  } catch (e) {
    mostrarMensagem("Não foi possível baixar o backup.");
  }
}

// Confere o arquivo e devolve o backup (ou uma mensagem de erro)
function lerBackup(texto) {
  let b;
  try {
    b = JSON.parse(texto);
  } catch (e) {
    return { erro: "O arquivo não é um backup válido (JSON com erro)." };
  }
  if (!b || b.formato !== FORMATO_BACKUP || !Array.isArray(b.projetos))
    return { erro: "Este arquivo não é um backup do Planejamento de Horas." };
  const ok = (p) => p && typeof p.id === "string" && typeof p.j === "string";
  if (!b.projetos.every(ok)) return { erro: "O backup tem projetos com dados incompletos." };
  return { b };
}

async function restaurarBackup(b) {
  let np = 0,
    nm = 0,
    nc = 0;
  for (const p of b.projetos) {
    const atual = projetos[p.id];
    if (atual && (atual.upd || 0) >= (p.upd || 0)) continue;
    if (p.id === idProjetoAberto) continue; // não troca o projeto que está aberto
    projetos[p.id] = { id: p.id, name: p.name || "Projeto", etapa: p.etapa || "", j: p.j, upd: p.upd || 0 };
    await gravarProjeto(p.id);
    np++;
  }
  for (const m of b.modelos || []) {
    if (!m || !m.id || typeof m.j !== "string") continue;
    const atual = modelosSalvos[m.id];
    if (atual && (atual.upd || 0) >= (m.upd || 0)) continue;
    await salvarModelo({
      id: m.id,
      nome: m.nome || "Modelo",
      tipo: m.tipo || "pavimento",
      j: m.j,
      upd: m.upd || 0,
    });
    nm++;
  }
  for (const c of b.cadastros || []) {
    if (!c || !c.id || !c.nome || !Array.isArray(c.disciplinas)) continue;
    // a mesma etapa com outro id (ex.: criada sozinha no primeiro acesso) dá lugar à do backup
    for (const x of cadastros.filter((x) => x.id !== c.id && normalizar(x.nome) === normalizar(c.nome)))
      await apagarCadastro(x.id);
    const i = cadastros.findIndex((x) => x.id === c.id),
      novo = { id: c.id, nome: c.nome, ordem: c.ordem || 0, disciplinas: c.disciplinas, upd: Date.now() };
    if (i >= 0) cadastros[i] = novo;
    else cadastros.push(novo);
    cadastros.sort((a, x) => (a.ordem || 0) - (x.ordem || 0));
    salvarCadastrosLocal();
    await gravarCadastro(novo);
    nc++;
  }
  historicoDesatualizado = true;
  if (!idProjetoAberto) desenharInicio();
  return { np, nm, nc };
}

acao("#bkdown", () => baixarBackup());
acao("#bkup", () => $("bkfile").click());

$("bkfile").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!f) return;
  const { b, erro } = lerBackup(await f.text());
  if (erro) return void mostrarMensagem(erro);
  confirmar(
    `Restaurar o backup de ${b.criadoEm ? new Date(b.criadoEm).toLocaleString("pt-BR") : "data desconhecida"}? ` +
      `Ele tem ${plural(b.projetos.length, "projeto", "projetos")}, ${plural((b.modelos || []).length, "modelo", "modelos")} ` +
      `e ${plural((b.cadastros || []).length, "etapa", "etapas")} do cadastro. Os dados atuais continuam; ` +
      "projetos e modelos que já existem ficam com a versão mais recente.",
    async () => {
      const r = await restaurarBackup(b);
      mostrarMensagem(
        `Backup restaurado: ${plural(r.np, "projeto", "projetos")}, ${plural(r.nm, "modelo", "modelos")} e ` +
          `${plural(r.nc, "etapa", "etapas")} do cadastro.`,
      );
    },
    "Restaurar",
  );
});
