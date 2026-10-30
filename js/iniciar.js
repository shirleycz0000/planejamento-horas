// Inicialização: conexão com a conta e carregamento dos projetos

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") salvarAoSair();
});

addEventListener("pagehide", salvarAoSair);

(async () => {
  let db = null;
  try {
    db = await claude.use("db");
  } catch (e) {}
  if (!db) {
    projetos = lerLocal(true);
    salvarLocal();
    mostrarStatusNuvem("local");
    prepararCadastrosSemConta();
    desenharInicio();
    return;
  }
  banco = db;
  let ready = false,
    metaSet = false;
  db.collection("templates").onSnapshot(
    (snap) => {
      if (snap.metadata.fromCache && snap.empty) return;
      const seen = {};
      snap.docs.forEach((d) => {
        const v = d.data() || {},
          c = modelosSalvos[d.id];
        seen[d.id] = 1;
        if (!c || (v.upd || 0) > (c.upd || 0))
          modelosSalvos[d.id] = {
            id: d.id,
            nome: v.nome || "Modelo",
            tipo: v.tipo || "pavimento",
            j: v.j,
            upd: v.upd || 0,
          };
      });
      if (!snap.metadata.fromCache && !snap.metadata.hasPendingWrites) {
        if (!modelosSincronizados) {
          modelosSincronizados = true;
          for (const id in modelosSalvos) if (!seen[id]) salvarModelo(modelosSalvos[id]);
        } else for (const id in modelosSalvos) if (!seen[id]) delete modelosSalvos[id];
      }
      salvarModelosLocal();
      if (janela && janela.kind === "tpl") desenharJanela();
      if (telaAtual === "etapa") atualizarSeletorModelos();
    },
    () => {},
  );
  db.collection("cadetapas").onSnapshot(receberCadastros, () => {});
  db.collection("cadastros").onSnapshot(receberCadastrosAntigos, () => {
    cadastrosAntigos = [];
    prepararCadastrosIniciais();
  });
  db.collection("projects").onSnapshot(
    (snap) => {
      const def = !snap.metadata.fromCache;
      if (!def && snap.empty) return;
      if (!ready && def) {
        ready = true;
        if (snap.empty && !Object.keys(projetos).length) {
          mostrarStatusNuvem("ok");
          migrar();
          return;
        }
      }
      if (def && !snap.empty && !metaSet) {
        metaSet = true;
        banco
          .doc("meta/migrated")
          .set({ t: Date.now() })
          .catch(() => {});
      }
      const seen = {};
      snap.docs.forEach((d) => {
        const v = d.data() || {},
          c = projetos[d.id];
        seen[d.id] = 1;
        historicoDesatualizado = true;
        if (!c || (v.upd || 0) > (c.upd || 0)) {
          projetos[d.id] = {
            id: d.id,
            name: v.name || "Projeto",
            etapa: v.etapa || "",
            j: v.j,
            upd: v.upd || 0,
          };
          if (d.id === idProjetoAberto && c && !estado.run) {
            const aberta = [estado.di, estado.ei];
            try {
              estado = carregarEstado(v.j, projetos[d.id].etapa);
            } catch (e) {
              return;
            }
            abrirPosicao(aberta);
            pilhaDesfazer = [];
            pilhaRefazer = [];
            ultimoJson = JSON.stringify(estado);
            ultimaChave = chaveDoEstado(estado);
            desenhar();
          }
        }
      });
      if (def && !snap.metadata.hasPendingWrites)
        for (const id in projetos)
          if (!seen[id]) {
            delete projetos[id];
            if (id === idProjetoAberto) idProjetoAberto = null;
          }
      salvarLocal();
      procurarCronometro();
      atualizarBarraCronometro();
      if (!idProjetoAberto) desenharInicio();
      if (def) mostrarStatusNuvem("ok");
    },
    (e) => {
      banco = null;
      projetos = lerLocal(true);
      mostrarStatusNuvem("local");
      desenharInicio();
    },
  );
})();
