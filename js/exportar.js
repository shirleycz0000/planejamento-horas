// Exportação do projeto em PDF e Excel

// Pares etapa/disciplina do projeto aberto, em ordem: [{ e, d, ei, di, rot }]
const paresDoProjeto = () =>
  estado.etapas.flatMap((e, ei) =>
    e.disciplinas.map((d, di) => ({ e, d, ei, di, rot: e.nome + " · " + d.nome })),
  );

// Nome de aba do Excel: sem caracteres proibidos e com até 31 caracteres
const nomeDeAba = (t) =>
  String(t)
    .replace(/[\\\/\?\*\[\]:]/g, "")
    .slice(0, 31);

const textoPdf = (t) =>
  String(t == null ? "" : t)
    .replace(/→/g, "->")
    .replace(/[✓✔]/g, "v")
    .replace(/≥/g, ">=")
    .replace(/[\n\t]/g, " ")
    .replace(/[^\x20-\x7E\u00A0-\u00FF–—‘’“”•…€™]/g, "");

async function exportarPdf() {
  if (!idProjetoAberto) return;
  if (typeof PDFLib === "undefined") {
    mostrarMensagem("A biblioteca de PDF não carregou. Recarregue a página e tente de novo.");
    return;
  }
  mostrarMensagem("Gerando PDF…");
  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib,
      doc = await PDFDocument.create(),
      F = await doc.embedFont(StandardFonts.Helvetica),
      B = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 841.89,
      H = 595.28,
      M = 36,
      TOP = H - 48,
      BOT = 42,
      CW = W - 2 * M,
      col = (c) => rgb(c[0] / 255, c[1] / 255, c[2] / 255);
    const INK = [20, 38, 61],
      MUT = [93, 107, 124],
      OK = [29, 122, 77],
      BAD = [192, 57, 43],
      WARN = [160, 100, 20],
      ACC = [31, 95, 191],
      LN = [217, 224, 232],
      WH = [255, 255, 255];
    const proj = projetos[idProjetoAberto];
    let pg,
      y,
      hdr = null;
    const tw = (t, s, b) => (b ? B : F).widthOfTextAtSize(textoPdf(t), s);
    const tx = (t, x, yy, o = {}) =>
      pg.drawText(textoPdf(t), { x, y: yy, size: o.s || 8.5, font: o.b ? B : F, color: col(o.c || INK) });
    const rt = (t, xr, yy, o = {}) => tx(t, xr - tw(t, o.s || 8.5, o.b), yy, o);
    const np = () => {
      pg = doc.addPage([W, H]);
      y = TOP;
      tx(proj.name, M, H - 26, { s: 8, c: MUT });
      pg.drawLine({
        start: { x: M, y: H - 32 },
        end: { x: W - M, y: H - 32 },
        thickness: 0.5,
        color: col(LN),
      });
      if (hdr) hdr();
    };
    const ens = (h) => {
      if (y - h < BOT) np();
    };
    const wrap = (t, s, w, b) => {
      const f = b ? B : F,
        out = [];
      let line = "";
      for (let word of textoPdf(t).split(" ")) {
        while (f.widthOfTextAtSize(word, s) > w) {
          let k = word.length;
          while (k > 1 && f.widthOfTextAtSize(word.slice(0, k), s) > w) k--;
          if (line) {
            out.push(line);
            line = "";
          }
          out.push(word.slice(0, k));
          word = word.slice(k);
        }
        const tr = line ? line + " " + word : word;
        if (f.widthOfTextAtSize(tr, s) <= w) line = tr;
        else {
          out.push(line);
          line = word;
        }
      }
      if (line || !out.length) out.push(line);
      return out;
    };
    const head = (cols) => {
      ens(20);
      pg.drawRectangle({ x: M, y: y - 16, width: CW, height: 16, color: col(INK) });
      let x = M;
      cols.forEach(([n, w, r]) => {
        r ? rt(n, x + w - 6, y - 11, { b: 1, c: WH }) : tx(n, x + 6, y - 11, { b: 1, c: WH });
        x += w;
      });
      y -= 16;
    };
    const link = (url, x, yy, w) => {
      try {
        const a = doc.context.register(
          doc.context.obj({
            Type: "Annot",
            Subtype: "Link",
            Rect: [x, yy - 2, x + w, yy + 9],
            Border: [0, 0, 0],
            A: { Type: "Action", S: "URI", URI: PDFLib.PDFString.of(url) },
          }),
        );
        pg.node.addAnnot(a);
      } catch (e) {}
    };
    const stc = { ok: OK, fp: WARN, and: ACC };
    const fh = (h) => fmtHoras(h);
    // ----- capa / resumo -----
    np();
    tx("Relatório de planejamento de horas", M, y - 14, { s: 18, b: 1 });
    y -= 34;
    tx(
      proj.name +
        "  |  " +
        estado.etapas
          .map(
            (e) => e.nome + (e.disciplinas.length ? ": " + e.disciplinas.map((d) => d.nome).join(", ") : ""),
          )
          .join("  ·  "),
      M,
      y,
      { s: 12, c: MUT },
    );
    y -= 15;
    tx("Emitido em " + dataBR(hoje()) + "  |  Horas produtivas por dia: " + estado.hd + "h", M, y, {
      s: 9,
      c: MUT,
    });
    y -= 24;
    tx("Resumo geral", M, y, { s: 12, b: 1 });
    y -= 8;
    const GC = [
      ["Etapa · Disciplina", 200, 0],
      ["Estimado", 90, 1],
      ["Usado", 90, 1],
      ["Restante", 90, 1],
      ["Dias estimados", 100, 1],
      ["Dias restantes", 100, 1],
      ["Avanço", 100, 1],
    ];
    y -= 4;
    head(GC);
    const T = { E: 0, U: 0, R: 0, D: 0 },
      grow = (n, z, bold) => {
        ens(18);
        if (bold) pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.2, color: col(INK) });
        const v = [
          n,
          fh(z.E),
          fh(z.U),
          fh(z.R),
          emDias(z.E),
          emDias(z.R),
          (z.E ? Math.round((z.D / z.E) * 100) : 0) + "%",
        ];
        let x = M;
        GC.forEach(([, w, r], k) => {
          r ? rt(v[k], x + w - 6, y - 12, { b: bold }) : tx(v[k], x + 6, y - 12, { b: bold });
          x += w;
        });
        y -= 18;
        pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: col(LN) });
      };
    estado.etapas.forEach((e) => {
      e.disciplinas.forEach((d) => grow(e.nome + " · " + d.nome, totaisEtapa(d)));
      const Te = totaisEtapa(e);
      for (const q in T) T[q] += Te[q];
      if (e.disciplinas.length > 1) grow("Subtotal " + e.nome, Te, 1);
      else if (!e.disciplinas.length) grow(e.nome + " (sem disciplinas)", Te);
    });
    grow("Total do projeto", T, 1);
    y -= 18;
    ens(40);
    tx("Datas das etapas", M, y, { s: 12, b: 1 });
    y -= 14;
    head([
      ["Etapa", 230, 0],
      ["Início", 120, 0],
      ["Fim", 120, 0],
      ["Situação", 300, 0],
    ]);
    estado.etapas.forEach((et) => {
      ens(18);
      const rot =
          et.nome + (et.disciplinas.length ? " (" + et.disciplinas.map((d) => d.nome).join(", ") + ")" : ""),
        z = totaisEtapa(et),
        fin = z.n && z.nd === z.n,
        atr = !!(et.fim && et.fim < hoje() && !fin);
      tx(rot, M + 6, y - 12);
      tx(dataBR(et.ini) || "-", M + 236, y - 12);
      tx(dataBR(et.fim) || "-", M + 356, y - 12, { c: atr ? BAD : INK, b: atr });
      tx(atr ? "Fim ultrapassado" : situacaoEtapa(z)[0], M + 476, y - 12, { c: atr ? BAD : INK });
      y -= 18;
      pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: col(LN) });
    });
    // ----- pontos de atenção -----
    y -= 22;
    ens(40);
    tx("Pontos de atenção (tempo usado acima do estimado)", M, y, { s: 12, b: 1 });
    y -= 14;
    const over = [];
    paresDoProjeto().forEach(({ d: dObj, rot }) => {
      dObj.blocos.forEach((b) =>
        b.it.forEach((i) => {
          if (!estaSemAcao(i.s) && i.e > 0 && usadoAtual(i) > i.e + 1 / 120) over.push({ d: rot, b: b.n, i });
        }),
      );
    });
    if (!over.length) {
      tx("Nenhuma atividade acima do estimado.", M, y, { c: OK });
      y -= 14;
    } else {
      const OC = [
        ["Atividade", 490, 0],
        ["Estimado", 90, 1],
        ["Usado", 90, 1],
        ["Excedeu", 100, 1],
      ];
      head(OC);
      over.slice(0, 25).forEach(({ d, b, i }) => {
        const ls = wrap(
            d + " / " + b + " - " + (ehBlocoApontamentos(b) ? nomeApontamento(i) : i.d),
            8.5,
            478,
          ),
          h = ls.length * 11 + 7;
        ens(h);
        ls.forEach((l, k) => tx(l, M + 6, y - 10 - k * 11));
        let x = M + 490;
        rt(fh(i.e), x + 84, y - 10);
        rt(fh(usadoAtual(i)), x + 174, y - 10);
        rt("+" + fh(usadoAtual(i) - i.e), x + 274, y - 10, { c: BAD, b: 1 });
        y -= h;
        pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: col(LN) });
      });
      if (over.length > 25) {
        tx("… e mais " + (over.length - 25) + " atividade(s).", M, y - 12, { s: 8, c: MUT });
        y -= 16;
      }
    }
    // ----- detalhamento -----
    const AC = [
      ["Atividade", 326, 0],
      ["Responsável", 92, 0],
      ["Status", 80, 0],
      ["Estimado", 60, 1],
      ["Usado", 60, 1],
      ["Restante", 60, 1],
      ["Conclusão", 92, 0],
    ];
    const UNITS = paresDoProjeto(),
      pos0 = [estado.ei, estado.di];
    for (const u of UNITS) {
      estado.ei = u.ei;
      estado.di = u.di;
      const d = estado.tab;
      const z = totaisDisciplina(d);
      hdr = null;
      np();
      pg.drawRectangle({ x: M, y: y - 22, width: CW, height: 22, color: col(INK) });
      tx(u.rot, M + 8, y - 15, { s: 13, b: 1, c: WH });
      rt("Estimado " + fh(z.E) + "   Usado " + fh(z.U) + "   Restante " + fh(z.R), W - M - 8, y - 14, {
        s: 9,
        c: WH,
      });
      y -= 34;
      let any = false;
      for (const b of estado.disc[d]) {
        if (!b.it.length) continue;
        any = true;
        const act = b.it.filter((i) => !estaSemAcao(i.s)),
          be = act.reduce((a, i) => a + i.e, 0),
          bu = b.it.reduce((a, i) => a + usadoAtual(i), 0),
          br = act
            .filter((i) => !estaConcluido(i.s))
            .reduce((a, i) => a + Math.max(0, i.e - usadoAtual(i)), 0),
          nd = b.it.filter((i) => estaConcluido(i.s)).length;
        const title = (cont) => {
          tx(b.n + (cont ? " (continuação)" : ""), M, y - 10, { s: 10, b: 1 });
          rt(
            nd +
              "/" +
              b.it.length +
              " concluídas   |   Estimado " +
              fh(be) +
              "   Usado " +
              fh(bu) +
              "   Restante " +
              fh(br),
            W - M,
            y - 10,
            { s: 8.5, c: MUT },
          );
          y -= 16;
          head(AC);
        };
        ens(70);
        hdr = null;
        title(false);
        hdr = () => title(true);
        for (const i of b.it) {
          const ap = ehBlocoApontamentos(b.n),
            ls = wrap(ap ? nomeApontamento(i) : i.d, 8.5, 314),
            as = (i.pr ? [["Prioridade: " + PRIORIDADES[i.pr][1]]] : [])
              .flatMap((a) => wrap(a[0], 7.5, 300))
              .concat((i.l || []).flatMap((a) => wrap((a.c ? "[x] " : "[ ] ") + a.t, 7.5, 300)))
              .concat(
                (i.cm || []).flatMap((c) => wrap("Comentário " + dataHoraBR(c.d) + ": " + c.t, 7.5, 300)),
              ),
            h = ls.length * 11 + as.length * 10 + 8;
          ens(h);
          const done = estaConcluido(i.s),
            gray = done || estaSemAcao(i.s),
            top = y;
          let yy = top - 10;
          ls.forEach((l) => {
            const c = ap && i.h ? ACC : gray ? MUT : INK;
            tx(l, M + 6, yy, { c });
            const w = tw(l, 8.5);
            if (done)
              pg.drawLine({
                start: { x: M + 6, y: yy + 3 },
                end: { x: M + 6 + w, y: yy + 3 },
                thickness: 0.6,
                color: col(MUT),
              });
            if (ap && i.h) {
              pg.drawLine({
                start: { x: M + 6, y: yy - 1.5 },
                end: { x: M + 6 + w, y: yy - 1.5 },
                thickness: 0.5,
                color: col(ACC),
              });
              link(i.h, M + 6, yy, w);
            }
            yy -= 11;
          });
          as.forEach((l) => {
            tx(l, M + 16, yy, { s: 7.5, c: MUT });
            yy -= 10;
          });
          let x = M + 326;
          tx(i.r || "-", x + 6, top - 10, { c: gray ? MUT : INK });
          x += 92;
          tx(i.s, x + 6, top - 10, { c: stc[comportamentoDo(i.s)] || (gray ? MUT : INK), b: done });
          x += 80;
          rt(fh(i.e), x + 54, top - 10, { c: gray ? MUT : INK });
          x += 60;
          rt(fh(usadoAtual(i)), x + 54, top - 10, { c: gray ? MUT : INK });
          x += 60;
          if (estaSemAcao(i.s)) rt("-", x + 54, top - 10, { c: MUT });
          else rt(fh(restante(i)), x + 54, top - 10, { c: restante(i) < 0 ? BAD : OK, b: 1 });
          x += 60;
          tx(dataBR(i.c) || "-", x + 6, top - 10, { c: gray ? MUT : INK });
          y -= h;
          pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: col(LN) });
        }
        y -= 14;
        hdr = null;
      }
      if (!any) {
        tx("Nenhuma atividade cadastrada.", M, y - 10, { c: MUT });
        y -= 16;
      }
    }
    [estado.ei, estado.di] = pos0;
    const pgs = doc.getPages();
    pgs.forEach((p, k) => {
      p.drawText("Página " + (k + 1) + " de " + pgs.length, {
        x: W - M - 60,
        y: 20,
        size: 8,
        font: F,
        color: col(MUT),
      });
      p.drawText("Emitido em " + dataBR(hoje()), { x: M, y: 20, size: 8, font: F, color: col(MUT) });
    });
    const bytes = await doc.save(),
      dl = await claude.use("downloads");
    if (!dl) {
      mostrarMensagem("Exportação indisponível nesta visualização.");
      return;
    }
    await dl.save({ filename: "relatorio-" + nomeDeArquivo(proj.name) + ".pdf", data: bytes });
    mostrarMensagem("PDF exportado.");
  } catch (e) {
    mostrarMensagem(
      e && e.code === "declined"
        ? "Exportação cancelada."
        : "Não foi possível gerar o PDF" + (e && e.code ? " (" + e.code + ")" : "") + ".",
    );
    console.error(e);
  }
}

async function exportarExcel() {
  if (typeof XLSX === "undefined") {
    $("sv").textContent = "A biblioteca do Excel não carregou. Recarregue a página e tente de novo.";
    return;
  }
  const hv = (h) => ({ t: "n", v: h / 24, z: "[h]:mm" }),
    res = [
      ["Etapa · Disciplina", "Estimado", "Usado", "Restante", "Dias estimados", "Dias restantes", "Avanço"],
    ],
    shs = [],
    T = { E: 0, U: 0, R: 0, D: 0 };
  const pos0 = [estado.ei, estado.di];
  const Tet = {}; // subtotais por etapa
  const linha = (rot, z) => [
    rot,
    hv(z.E),
    hv(z.U),
    hv(z.R),
    Math.round((z.E / estado.hd) * 2) / 2,
    Math.round((z.R / estado.hd) * 2) / 2,
    { t: "n", v: z.E ? z.D / z.E : 0, z: "0%" },
  ];
  estado.etapas.forEach((et, ei) => {
    if (!et.disciplinas.length) res.push(linha(et.nome + " (sem disciplinas)", { E: 0, U: 0, R: 0, D: 0 }));
    et.disciplinas.forEach((dObj, di) => {
      estado.ei = ei;
      estado.di = di;
      for (const d in estado.disc) {
        const rows = [
          [
            "Bloco",
            "Atividade",
            "Responsável",
            "Status",
            "Estimado",
            "Usado",
            "Restante",
            "Conclusão",
            "Prioridade",
            "Ações",
            "Comentários",
            "Registro diário",
          ],
        ];
        let E = 0,
          U = 0,
          R = 0,
          D = 0;
        estado.disc[d].forEach((b) => {
          if (!b.it.length) rows.push([b.n]);
          b.it.forEach((i) => {
            const u = usadoAtual(i);
            rows.push([
              b.n,
              i.h
                ? { t: "s", v: nomeApontamento(i), l: { Target: i.h, Tooltip: "Abrir no Construflow" } }
                : i.d,
              i.r || "",
              i.s,
              hv(i.e),
              hv(u),
              estaSemAcao(i.s) ? "" : i.e - u >= -1 / 120 ? hv(Math.max(0, i.e - u)) : fmtHoras(i.e - u),
              dataParaExcel(i.c),
              i.pr ? PRIORIDADES[i.pr][1] : "",
              (i.l || []).map((x) => (x.c ? "[x] " : "[ ] ") + x.t).join("\n"),
              (i.cm || []).map((c) => dataHoraBR(c.d) + " - " + c.t).join("\n"),
              textoRegistro(i),
            ]);
            if (!estaSemAcao(i.s)) {
              E += i.e;
              U += u;
              if (estaConcluido(i.s)) D += i.e;
              else R += Math.max(0, i.e - u);
            }
          });
        });
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [
          { wch: 26 },
          { wch: 60 },
          { wch: 14 },
          { wch: 16 },
          { wch: 11 },
          { wch: 11 },
          { wch: 11 },
          { wch: 13 },
          { wch: 11 },
          { wch: 50 },
          { wch: 50 },
          { wch: 24 },
        ];
        ws["!autofilter"] = { ref: "A1:L" + rows.length };
        {
          let nm = nomeDeAba(et.nome + " · " + d),
            c = 1;
          while (shs.some((x) => x[0] === nm)) nm = nm.slice(0, 28) + "~" + ++c;
          shs.push([nm, ws]);
        }
        T.E += E;
        T.U += U;
        T.R += R;
        T.D += D;
        res.push(linha(et.nome + " · " + d, { E, U, R, D }));
        const te = (Tet[ei] = Tet[ei] || { E: 0, U: 0, R: 0, D: 0 });
        te.E += E;
        te.U += U;
        te.R += R;
        te.D += D;
        // depois da última disciplina da etapa, o subtotal dela (se tiver mais de uma)
        if (di === et.disciplinas.length - 1 && et.disciplinas.length > 1)
          res.push(linha("Subtotal " + et.nome, te));
      }
    });
  });
  [estado.ei, estado.di] = pos0;
  res.push([
    "Total do projeto",
    hv(T.E),
    hv(T.U),
    hv(T.R),
    Math.round((T.E / estado.hd) * 2) / 2,
    Math.round((T.R / estado.hd) * 2) / 2,
    { t: "n", v: T.E ? T.D / T.E : 0, z: "0%" },
  ]);
  const wr = XLSX.utils.aoa_to_sheet(res);
  wr["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 10 }];
  const we = XLSX.utils.aoa_to_sheet(
    [["Etapa", "Disciplina", "Início", "Fim", "Estimado", "Usado", "Restante", "Origem"]].concat(
      // uma linha por disciplina (as datas são as da etapa); etapa sem disciplinas também entra
      estado.etapas.flatMap((et) =>
        (et.disciplinas.length ? et.disciplinas : [null]).map((d) => {
          const z = totaisEtapa(d || et);
          return [
            et.nome,
            d ? d.nome : "",
            dataParaExcel(et.ini),
            dataParaExcel(et.fim),
            hv(z.E),
            hv(z.U),
            hv(z.R),
            d ? d.escopo || "" : "",
          ];
        }),
      ),
    ),
  );
  we["!cols"] = [
    { wch: 20 },
    { wch: 14 },
    { wch: 13 },
    { wch: 13 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 44 },
  ];
  const cl = calendario(),
    wc = XLSX.utils.aoa_to_sheet(
      [
        ["Configuração", "Valor"],
        ["Horas por dia", estado.hd],
        ["Dias de trabalho", cl.dias.map((d) => DIAS_ABREV[d]).join(", ")],
        ["Responsáveis", (estado.pe || []).join("; ")],
        [],
        ["Status", "Comportamento", "Cor"],
      ].concat(
        statusAtuais.map((q) => [
          q.n,
          NOMES_COMPORTAMENTO[q.r] || NOMES_COMPORTAMENTO.pend,
          NOMES_CORES[q.c] || NOMES_CORES[0],
        ]),
        [[]],
        [["Feriado / folga", "Início", "Fim"]],
        [...cl.ev]
          .sort((a, b) => String(a.ini).localeCompare(String(b.ini)))
          .map((e) => [e.nome, dataParaExcel(e.ini), dataParaExcel(e.fim || e.ini)]),
      ),
    );
  wc["!cols"] = [{ wch: 30 }, { wch: 44 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wr, "Resumo");
  XLSX.utils.book_append_sheet(wb, we, "Etapas");
  shs.forEach(([n, w]) => XLSX.utils.book_append_sheet(wb, w, n));
  XLSX.utils.book_append_sheet(wb, wc, ABA_CONFIG);
  try {
    const dl = await claude.use("downloads");
    if (!dl) {
      $("sv").textContent = "Exportação indisponível nesta visualização.";
      return;
    }
    await dl.save({
      filename: "planejamento-" + nomeDeArquivo(projetos[idProjetoAberto].name) + ".xlsx",
      data: XLSX.write(wb, { bookType: "xlsx", type: "array" }),
    });
    $("sv").textContent = "Excel exportado.";
  } catch (e) {
    $("sv").textContent =
      e && e.code === "declined"
        ? "Exportação cancelada."
        : "Não foi possível salvar o .xlsx (" +
          ((e && e.code) || "erro") +
          "). Tente de novo ou use Exportar PDF.";
  }
}

// ---------- Ações dos botões: exportar ----------
acao("#expx", () => exportarExcel());
acao("#expp", () => exportarPdf());
acao("data-exp", (v) => (v === "pdf" ? exportarPdf() : exportarExcel())); // menu Exportar da tela do projeto
