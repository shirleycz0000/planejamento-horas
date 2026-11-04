// Cronômetro, barra do cronômetro e registro de horas por dia

function pararCronometro() {
  if (estado.run) {
    const x = acharAtividade(estado.run.id),
      t1 = Date.now();
    if (x) {
      const h = (t1 - estado.run.t0) / 36e5;
      x.u += h;
      registrarIntervalo(x, h, estado.run.t0, t1);
      registrarSessao(x, estado.run.t0, t1);
      agendaSessao(idProjetoAberto, estado.run.t0, t1, x.id);
    }
    estado.run = null;
  }
}

const diaDe = (ms) => dataISO(new Date(ms));

function registrarHoras(x, d, h) {
  x.lg = x.lg || [];
  const e = x.lg.find((l) => l.d === d);
  if (e) e.h += h;
  else x.lg.push({ d, h });
}

// Horário de cada sessão do cronômetro (início e fim, em ms): ss = [[t0, t1], ...].
// Usado na agenda (blocos de horário); sessões de menos de 30 s são ignoradas.
function registrarSessao(x, t0, t1) {
  if (!(t1 - t0 >= 30000)) return;
  (x.ss = x.ss || []).push([Math.round(t0), Math.round(t1)]);
}

function registrarIntervalo(x, h, t0, t1) {
  if (!(h > 0)) return;
  const d0 = diaDe(t0),
    d1 = diaDe(t1);
  if (d0 === d1 || !(t1 > t0)) {
    registrarHoras(x, d1, h);
    return;
  }
  let c = t0,
    left = h,
    g = 0;
  const tot = t1 - t0;
  while (diaDe(c) !== d1 && g++ < 400) {
    const e = new Date(c);
    e.setHours(24, 0, 0, 0);
    const part = (h * (e.getTime() - c)) / tot;
    registrarHoras(x, diaDe(c), part);
    left -= part;
    c = e.getTime();
  }
  registrarHoras(x, d1, Math.max(0, left));
}

function ajustarRegistro(x, dl) {
  x.lg = x.lg || [];
  if (Math.abs(dl) < 1e-6) return;
  if (dl > 0) {
    registrarHoras(x, hoje(), dl);
    return;
  }
  let r = -dl;
  x.lg.sort((a, b) => b.d.localeCompare(a.d));
  for (const l of x.lg) {
    if (r <= 1e-9) break;
    const t = Math.min(l.h, r);
    l.h -= t;
    r -= t;
  }
  x.lg = x.lg.filter((l) => l.h > 0.0005).sort((a, b) => a.d.localeCompare(b.d));
}

let cronometroForaDaTela = null,
  tique = 0;

const cronometroAtivo = () =>
  idProjetoAberto && estado.run
    ? { pid: idProjetoAberto, id: estado.run.id, t0: estado.run.t0 }
    : cronometroForaDaTela;

function descreverAtividade(pid, id) {
  const pj = projetos[pid];
  if (!pj) return null;
  let x;
  try {
    x = pid === idProjetoAberto && estado.etapas ? estado : JSON.parse(pj.j);
  } catch (e) {
    return null;
  }
  let r = null;
  percorrerAtividades(
    x,
    (i, c) => {
      if (i.id !== id) return;
      const e = c.etapa,
        d = c.disciplina,
        b = c.bloco;
      r = {
        p: pj.name,
        e: e.nome,
        a: i.d || "(sem nome)",
        loc: d + " › " + b.n,
        key: e.nome + "|" + d + "|" + b.n + "|" + i.id,
        ei: c.ei,
        di: c.di,
        bn: b.n,
        d,
        bi: c.bi,
      };
      return true;
    },
    pj.etapa || "",
  );
  return r;
}

function encerrarCronometro(o) {
  editarProjetoSalvo(o.pid, (x) => {
    const i = acharAtividadeEm(x, o.id),
      t1 = Date.now();
    if (i && x.run) {
      const h = (t1 - x.run.t0) / 36e5;
      i.u = (i.u || 0) + h;
      registrarIntervalo(i, h, x.run.t0, t1);
      registrarSessao(i, x.run.t0, t1);
      agendaSessao(o.pid, x.run.t0, t1, i.id);
    }
    x.run = null;
  });
}

function procurarCronometro() {
  if (idProjetoAberto && estado.run) {
    cronometroForaDaTela = null;
    return;
  }
  let f = null;
  Object.values(projetos).forEach((pj) => {
    if (pj.id === idProjetoAberto) return;
    const m = /"run":\{"id":"([^"]+)","t0":(\d+)\}/.exec(pj.j || "");
    if (!m) return;
    const o = { pid: pj.id, id: m[1], t0: +m[2] };
    if (!f) f = o;
    else if (o.t0 > f.t0) {
      encerrarCronometro(f);
      f = o;
    } else encerrarCronometro(o);
  });
  if (f) f.lab = descreverAtividade(f.pid, f.id);
  cronometroForaDaTela = f;
}

function atualizarBarraCronometro() {
  const r = cronometroAtivo(),
    b = $("runbar");
  if (!r) {
    if (!b.hidden) b.hidden = true;
    return;
  }
  const lab = r.lab || descreverAtividade(r.pid, r.id);
  if (!lab) {
    b.hidden = true;
    return;
  }
  if (b.hidden) b.hidden = false;
  const tx = lab.a + " · " + lab.p + " › " + lab.e;
  if ($("rtl").textContent !== tx) $("rtl").textContent = tx;
  $("rtt").textContent = fmtHorasSeg((Date.now() - r.t0) / 36e5);
}

async function pausarCronometro() {
  const r = cronometroAtivo();
  if (!r) return;
  if (idProjetoAberto && estado.run && r.pid === idProjetoAberto) {
    pararCronometro();
    cronometroForaDaTela = null;
    desenhar();
    salvar();
  } else {
    encerrarCronometro(r);
    cronometroForaDaTela = null;
    if (!idProjetoAberto) desenharInicio();
  }
  atualizarBarraCronometro();
}

function avisarCronometroAtivo(r) {
  const lab = r.lab || descreverAtividade(r.pid, r.id);
  confirmar(
    "Já existe um cronômetro rodando" +
      (lab ? ": “" + lab.a + "” (" + lab.p + " › " + lab.e + ")" : "") +
      ". Só um cronômetro pode ficar ativo por vez. Pause o atual antes de iniciar outro.",
    irParaCronometro,
    "Ir para a atividade",
  );
}

async function irParaCronometro() {
  const r = cronometroAtivo();
  if (!r) return;
  const lab = r.lab || descreverAtividade(r.pid, r.id);
  if (!lab) return;
  if (idProjetoAberto !== r.pid) {
    if (idProjetoAberto) {
      clearInterval(timerTela);
      await salvar();
    }
    idProjetoAberto = null;
    abrirProjeto(r.pid);
  }
  // descreve de novo com o projeto aberto (já no formato novo) para achar etapa e disciplina
  const pos = descreverAtividade(r.pid, r.id);
  if (!pos) return;
  abrirDisciplina(pos.ei, pos.di);
  const bl = estado.disc[estado.tab] && estado.disc[estado.tab][pos.bi];
  if (bl) {
    pavimentosRecolhidos.delete(chaveRecolhido(bl));
    salvarRecolhidos();
  }
  desenhar();
  setTimeout(() => {
    const tr = document.querySelector(`tr[data-rid="${r.id}"]`);
    if (tr) {
      tr.scrollIntoView({ block: "center" });
      tr.classList.add("flash");
      setTimeout(() => tr.classList.remove("flash"), 2200);
    }
  }, 80);
}

setInterval(() => {
  atualizarBarraCronometro();
  tique++;
  if (
    telaAtual === "etapas" &&
    idProjetoAberto &&
    estado.run &&
    tique % 15 === 0 &&
    !/INPUT|SELECT/.test((document.activeElement || {}).tagName || "")
  )
    desenhar();
}, 1000);

// ---------- Ações dos botões: cronômetro ----------
// Play/pausa de cada atividade (botão ▶/⏸) e a barra do cronômetro
acao(
  "data-run",
  (rid) => {
    const r0 = cronometroAtivo();
    if (r0 && r0.id !== rid) {
      // só um cronômetro por vez; um cronômetro de atividade que não existe mais é descartado
      if (descreverAtividade(r0.pid, r0.id)) {
        avisarCronometroAtivo(r0);
        return false;
      }
      if (idProjetoAberto && estado.run && r0.pid === idProjetoAberto) estado.run = null;
      else {
        editarProjetoSalvo(r0.pid, (x) => {
          x.run = null;
        });
        cronometroForaDaTela = null;
      }
    }
    if (estado.run && estado.run.id === rid) pararCronometro();
    else {
      estado.run = { id: rid, t0: Date.now() };
      const x = acharAtividade(rid);
      if (comportamentoDo(x.s) === "pend") x.s = statusComComportamento("and");
    }
  },
  SALVA,
);
acao("#rpause", () => pausarCronometro());
acao("#rgo", () => irParaCronometro());
