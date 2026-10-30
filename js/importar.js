// Importação de planilhas Excel

const horasDoExcel = (v) => (typeof v === "number" ? Math.round(v * 1440) / 60 : 0);

const lerHorasExcel = (v) => {
  if (typeof v === "number") return horasDoExcel(v);
  const m = String(v || "").match(/^(\d+):(\d{2})/);
  return m ? +m[1] + m[2] / 60 : 0;
};

const statusDoTexto = (v) => {
  const raw = String(v || "").trim(),
    f = statusAtuais.find((q) => normalizar(q.n) === normalizar(raw));
  if (f) return f.n;
  const t = normalizar(raw);
  return t.includes("conclu")
    ? statusComComportamento("ok")
    : t.includes("falta")
      ? statusComComportamento("fp")
      : t.includes("sem a") || t.startsWith("ok")
        ? statusComComportamento("sa")
        : t.includes("andamento")
          ? statusComComportamento("and")
          : statusComComportamento("pend");
};

const maiusculaInicial = (t) => {
  t = String(t).replace(/\s+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : t;
};

const dataDoExcel = (v) => {
  if (v && typeof v === "object" && v.getTime) v = Math.round(v.getTime() / 864e5) + 25569;
  if (typeof v === "number" && v > 30000)
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5).toISOString().slice(0, 10);
  return "";
};

const NOMES_COMPORTAMENTO = {
    pend: "Em aberto",
    and: "Em andamento",
    fp: "Falta publicar",
    ok: "Concluído",
    sa: "Sem ação",
  },
  ABA_CONFIG = "Configurações";

const textoRegistro = (i) =>
  (i.lg || [])
    .filter((l) => l.h > 0)
    .sort((a, b) => a.d.localeCompare(b.d))
    .map((l) => dataBR(l.d) + " " + fmtHorasSeg(l.h))
    .join("\n");

const lerRegistro = (v) => {
  const o = { lg: [] };
  String(v || "")
    .split(/\n|;/)
    .forEach((s) => {
      const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d+):(\d{2})(?::(\d{2}))?$/);
      if (m) {
        const h = +m[4] + m[5] / 60 + +(m[6] || 0) / 3600;
        if (h > 0) registrarHoras(o, m[3] + "-" + m[2] + "-" + m[1], h);
      }
    });
  return o.lg.sort((a, b) => a.d.localeCompare(b.d));
};

function lerConfiguracoes(wb) {
  const ws = wb.Sheets[ABA_CONFIG];
  if (!ws || !ws["!ref"]) return null;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }),
    cfg = { status: [], ev: [], dias: null, hd: 0, pe: null };
  let mode = "kv";
  rows.forEach((r) => {
    const a = String(r[0]).trim(),
      k = normalizar(a);
    if (!a) {
      mode = "";
      return;
    }
    if (k === "status" && normalizar(r[1]) === "comportamento") {
      mode = "st";
      return;
    }
    if (k === "feriado / folga") {
      mode = "ev";
      return;
    }
    if (k === "configuracao") {
      mode = "kv";
      return;
    }
    if (mode === "st") {
      const rl =
          Object.keys(NOMES_COMPORTAMENTO).find(
            (x) => normalizar(NOMES_COMPORTAMENTO[x]) === normalizar(r[1]),
          ) || "pend",
        c = NOMES_CORES.findIndex((p) => normalizar(p) === normalizar(r[2]));
      if (!cfg.status.some((s) => normalizar(s.n) === k)) cfg.status.push({ n: a, r: rl, c: c < 0 ? 0 : c });
      return;
    }
    if (mode === "ev") {
      const ini = dataDoExcel(r[1]);
      if (ini)
        cfg.ev.push({
          id: "v" + Math.random().toString(36).slice(2, 8),
          nome: a,
          ini,
          fim: dataDoExcel(r[2]) || ini,
        });
      return;
    }
    if (k === "horas por dia") cfg.hd = Math.max(0, +String(r[1]).replace(",", ".") || 0);
    else if (k === "dias de trabalho") {
      const ds = String(r[1])
        .split(/[,;]/)
        .map((x) => DIAS_ABREV.findIndex((d) => normalizar(d) === normalizar(x).slice(0, 3)))
        .filter((x) => x >= 0);
      if (ds.length) cfg.dias = [...new Set(ds)].sort();
    } else if (k === "responsaveis")
      cfg.pe = String(r[1])
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean);
  });
  if (!cfg.status.some((s) => s.r === "pend") || !cfg.status.some((s) => s.r === "ok")) cfg.status = [];
  return cfg;
}

function lerPlanilha(wb) {
  const cfg = lerConfiguracoes(wb),
    k0 = statusAtuais;
  definirStatus(cfg && cfg.status.length ? cfg.status : null);
  try {
    const r = lerPlanilhaInterno(wb);
    if (r) r.cfg = cfg;
    return r;
  } finally {
    statusAtuais = k0;
    nomesStatus = k0.map((q) => q.n);
  }
}

function lerPlanilhaInterno(wb) {
  const ets = {},
    DPD = {},
    pe = new Set(),
    EDT = {},
    EORD = [],
    PARES = []; // pares etapa/disciplina da aba "Etapas"
  let ordemNova = true; // abas "Etapa · Disciplina" (a partir da versão 3)
  let count = 0,
    k = 0;
  const nid = () => "i" + ++k + Date.now().toString(36).slice(-3);
  const addAp = (it, txt) => {
    const m = String(txt).split(/\s*A[çc][ãa]o:\s*/i);
    it.d = m[0].replace(/\s+/g, " ").trim();
    const a = (m[1] || "").replace(/\s+/g, " ").trim();
    it.l = a ? [{ t: a, c: false }] : [];
  };
  wb.SheetNames.forEach((sn) => {
    const ws = wb.Sheets[sn];
    if (!ws || !ws["!ref"]) return;
    const rg = XLSX.utils.decode_range(ws["!ref"]);
    const V = (r, c) => {
        const x = ws[XLSX.utils.encode_cell({ r, c })];
        return x ? x.v : undefined;
      },
      T = (r, c) => {
        const v = V(r, c);
        return v == null ? "" : String(v).replace(/\s+/g, " ").trim();
      },
      LK = (r, c) => {
        const x = ws[XLSX.utils.encode_cell({ r, c })];
        return x && x.l && x.l.Target ? x.l.Target : "";
      };
    let en = "",
      dn = "",
      blocks = [],
      cur = null;
    const tool = T(rg.s.r, 0).toLowerCase() === "bloco",
      pre = EORD.filter((x) => sn.startsWith(x + " - ")).sort((a, b) => b.length - a.length)[0];
    if (tool && sn.includes(" · ")) {
      // Excel exportado por esta ferramenta: abas "Etapa · Disciplina" (versão atual) ou
      // "Disciplina · Etapa" (out/2026). O par certo vem da aba "Etapas"; um nome de aba
      // cortado em 31 caracteres é completado por ela.
      const base = sn.replace(/~\d+$/, ""),
        rotulo = (p) => nomeDeAba(ordemNova ? p.e + " · " + p.d : p.d + " · " + p.e),
        par = PARES.find((p) => rotulo(p) === sn) || PARES.find((p) => rotulo(p).startsWith(base));
      if (par) {
        en = par.e;
        dn = par.d;
      } else {
        const k = sn.indexOf(" · "),
          a = sn.slice(0, k).trim(),
          b = sn.slice(k + 3).trim();
        [en, dn] = ordemNova ? [a, b] : [b, a];
      }
    } else if (tool && pre) {
      en = pre;
      dn = sn.slice(pre.length + 3).trim();
    } else {
      const pp = sn.split("|");
      if (pp.length > 1) {
        dn = pp[0].trim().toUpperCase();
        en = pp.slice(1).join("|").trim();
      } else {
        const q = sn.split(" - ");
        if (q.length > 1) {
          en = q[0].trim();
          dn = q.slice(1).join(" - ").trim().toUpperCase();
        } else dn = sn.trim().toUpperCase();
      }
    }
    dn = dn || sn;
    // aba "Etapas": colunas pelo título (Disciplina, Etapa, Início, Fim, Origem/Escopo)
    const colEtapas = {};
    if (/^etapas$/i.test(sn)) for (let c = rg.s.c; c <= rg.e.c; c++) colEtapas[normalizar(T(rg.s.r, c))] = c;
    if (/^etapas$/i.test(sn) && colEtapas.etapa !== undefined) {
      const ce =
          colEtapas.origem !== undefined
            ? colEtapas.origem
            : colEtapas.escopo !== undefined
              ? colEtapas.escopo
              : -1,
        cd = colEtapas.disciplina !== undefined ? colEtapas.disciplina : -1,
        cn = colEtapas.etapa;
      ordemNova = cd < 0 || cn < cd; // "Etapa" antes de "Disciplina": formato atual
      const ci = colEtapas.inicio !== undefined ? colEtapas.inicio : cn + 1,
        cf = colEtapas.fim !== undefined ? colEtapas.fim : cn + 2;
      for (let r = rg.s.r + 1; r <= rg.e.r; r++) {
        const nm = T(r, cn),
          dt = { ini: dataDoExcel(V(r, ci)), fim: dataDoExcel(V(r, cf)), escopo: ce >= 0 ? T(r, ce) : "" };
        if (!nm) continue;
        if (!EDT[nm]) {
          EDT[nm] = dt;
          EORD.push(nm);
        }
        // Excel exportado depois de out/2026: uma linha por disciplina
        if (cd >= 0 && T(r, cd)) {
          DPD[normalizar(T(r, cd)) + "|" + normalizar(nm)] = dt;
          PARES.push({ e: nm, d: T(r, cd) });
        }
      }
      return;
    }
    if (T(rg.s.r, 0).toLowerCase() === "bloco") {
      // exportado por esta ferramenta
      if (/^resumo$/i.test(sn)) return;
      const by = {},
        HC = {};
      for (let c = rg.s.c; c <= rg.e.c; c++) HC[T(rg.s.r, c)] = c;
      const cc = (nm, df) => (HC[nm] !== undefined ? HC[nm] : df);
      for (let r = rg.s.r + 1; r <= rg.e.r; r++) {
        const bn = T(r, 0),
          d = T(r, 1);
        if (!bn) continue;
        if (!by[bn]) {
          by[bn] = { n: bn, it: [] };
          blocks.push(by[bn]);
        }
        if (!d) {
          let any = false;
          for (let c = 2; c <= rg.e.c; c++) if (T(r, c)) any = true;
          if (!any) continue;
        }
        const it = {
          id: nid(),
          d,
          r: T(r, 2),
          s: statusDoTexto(T(r, 3)),
          e: lerHorasExcel(V(r, 4)),
          u: lerHorasExcel(V(r, 5)),
          c: dataDoExcel(V(r, cc("Conclusão", 7))),
        };
        const h = LK(r, 1);
        if (h) it.h = h;
        if (HC["Prioridade"] !== undefined) {
          const pv = normalizar(T(r, HC["Prioridade"]));
          if (pv === "alta") it.pr = "a";
          else if (pv === "media") it.pr = "m";
          else if (pv === "baixa") it.pr = "b";
        }
        it.l = String(V(r, cc("Ações", 8)) || "")
          .split(/\n|\s\|\s/)
          .map((x) => x.match(/^\[( |x)\]\s*(.*)$/i))
          .filter(Boolean)
          .map((m) => ({ t: m[2], c: m[1].toLowerCase() === "x" }));
        it.cm = String(V(r, cc("Comentários", 9)) || "")
          .split("\n")
          .map((x) => x.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?\s+-\s+(.*)$/))
          .filter(Boolean)
          .map((m) => ({
            t: m[6],
            d: new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime(),
          }));
        if (HC["Registro diário"] !== undefined) {
          it.lg = lerRegistro(V(r, HC["Registro diário"]));
          const sl = it.lg.reduce((a, l) => a + l.h, 0);
          if (sl > 0 && Math.abs(sl - it.u) < 1 / 60) it.u = sl;
        }
        if (it.r) pe.add(it.r);
        by[bn].it.push(it);
        count++;
      }
    } else {
      // planilha de planejamento original
      for (let r = rg.s.r; r <= rg.e.r; r++) {
        const B = T(r, 1),
          Cx = T(r, 2),
          D = T(r, 3),
          E = V(r, 4),
          F = V(r, 5),
          G = V(r, 6);
        const head =
          Cx &&
          !/^descri/i.test(Cx) &&
          (B.toUpperCase() === "RESPONSÁVEL" ||
            (String(E || "").toUpperCase() === "ESTIMADO" && String(F || "").toUpperCase() === "USADO"));
        if (head) {
          cur = { n: maiusculaInicial(Cx.replace(/\bPAVIMENTO PAVIMENTO\b/i, "PAVIMENTO")), it: [] };
          blocks.push(cur);
          continue;
        }
        if (
          !cur ||
          !Cx ||
          /^descri/i.test(Cx) ||
          /^x{3,}\b/i.test(Cx) ||
          /^apontamento\s+a[cç][aã]o/i.test(Cx) ||
          /^observa/i.test(Cx)
        )
          continue;
        if (!D && E == null) continue;
        const it = {
          id: nid(),
          d: Cx,
          r: B && B !== "-" ? B : "",
          s:
            typeof E === "string" && /n[ãa]o faz parte/i.test(E)
              ? statusComComportamento("sa")
              : statusDoTexto(D || "Pendente"),
          e: horasDoExcel(E),
          u: horasDoExcel(F),
          c: dataDoExcel(G),
        };
        if (ehBlocoApontamentos(cur.n)) addAp(it, Cx);
        if (!estaConcluido(it.s)) it.c = "";
        if (it.r) pe.add(it.r);
        cur.it.push(it);
        count++;
      }
    }
    if (!blocks.length && !tool) return;
    const dd = ets[en] || (ets[en] = {});
    let n = dn,
      z = 2;
    while (dd[n]) n = dn + " " + z++;
    dd[n] = blocks;
  });
  const names = EORD.concat(Object.keys(ets).filter((n) => !EORD.includes(n)));
  return count || EORD.length
    ? {
        etapas: names.map((nome) => ({
          nome,
          disc: ets[nome] || {},
          ini: (EDT[nome] || {}).ini || "",
          fim: (EDT[nome] || {}).fim || "",
          escopo: (EDT[nome] || {}).escopo || "",
        })),
        pe: [...pe],
        count,
        datasPorDisciplina: DPD,
      }
    : null;
}

async function importarProjeto(n) {
  const f = $("pf").files[0];
  if (!f) {
    avisoNovoProjeto("Escolha o arquivo Excel para importar.");
    $("pf").hidden = false;
    return;
  }
  if (typeof XLSX === "undefined") {
    avisoNovoProjeto("A biblioteca do Excel não carregou. Recarregue a página e tente de novo.");
    return;
  }
  try {
    const r = lerPlanilha(XLSX.read(await f.arrayBuffer(), { type: "array" }));
    if (!r) {
      avisoNovoProjeto(
        "Não encontrei atividades nesse arquivo. Use a planilha de planejamento ou um Excel exportado por esta ferramenta.",
      );
      return;
    }
    const id = novoIdProjeto(),
      fb = "Etapa 1",
      cf = r.cfg || {},
      ets = r.etapas.map((e) => ({
        id: novoIdEtapa(),
        nome: e.nome || fb,
        escopo: e.escopo || "",
        ini: e.ini || "",
        fim: e.fim || "",
        tab: Object.keys(e.disc)[0],
        disc: e.disc,
      })),
      pe0 = [...new Set([...(cf.pe || []), ...r.pe])],
      x = {
        hd: cf.hd || 7,
        run: null,
        pe: pe0.length ? pe0 : RESPONSAVEIS_PADRAO.slice(),
        status: cf.status && cf.status.length ? cf.status : statusPadrao(),
        cal: { dias: cf.dias || [1, 2, 3, 4, 5], ev: cf.ev || [] },
        etapas: ets,
      },
      // grava já no formato atual; com datas e origem por disciplina (Excel de out/2026),
      // a etapa fica com o início mais cedo e o fim mais tarde
      novo = converterParaNovo(x);
    novo.etapas.forEach((e) => {
      const dts = e.disciplinas
        .map((d) => [d, (r.datasPorDisciplina || {})[normalizar(d.nome) + "|" + normalizar(e.nome)]])
        .filter(([, dt]) => dt);
      if (!dts.length) return;
      e.ini = dts.reduce((a, [, dt]) => menorData(a, dt.ini), "");
      e.fim = dts.reduce((a, [, dt]) => maiorData(a, dt.fim), "");
      dts.forEach(([d, dt]) => dt.escopo && (d.escopo = dt.escopo));
    });
    projetos[id] = {
      id,
      name: n,
      etapa: ets.map((e) => e.nome).join(", "),
      j: JSON.stringify(novo),
      upd: Date.now(),
    };
    gravarProjeto(id);
    fecharFormularioProjeto();
    abrirProjeto(id);
    const nb = ets.reduce((a, e) => a + Object.values(e.disc).reduce((q, w) => q + w.length, 0), 0);
    $("imp").textContent =
      "Planilha importada: " +
      r.count +
      " atividades em " +
      nb +
      " blocos (etapas: " +
      ets.map((e) => e.nome).join(", ") +
      "). Confira os dados e ajuste o que precisar.";
    $("imp").hidden = false;
  } catch (e) {
    avisoNovoProjeto("Não foi possível ler o arquivo. Ele precisa ser uma planilha .xlsx válida.");
  }
}
