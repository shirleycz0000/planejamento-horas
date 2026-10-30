// Dias úteis, feriados, previsão de término e cronograma (Gantt)

const calendario = () => estado.cal || { dias: [1, 2, 3, 4, 5], ev: [] };

const ehDiaUtil = (x) => {
  const c = calendario();
  return (
    c.dias.includes(lerDataISO(x).getDay()) && !c.ev.some((e) => e.ini && e.ini <= x && x <= (e.fim || e.ini))
  );
};

const proximoDiaUtil = (x) => {
    let g = 0;
    while (!ehDiaUtil(x) && g++ < 800) x = somarDias(x, 1);
    return x;
  },
  somarDiasUteis = (x, n) => {
    x = proximoDiaUtil(x);
    while (n > 0) {
      x = proximoDiaUtil(somarDias(x, 1));
      n--;
    }
    return x;
  },
  fimPelasHoras = (x, h) => somarDiasUteis(x, Math.max(1, Math.ceil(h / estado.hd - 1e-9)) - 1),
  contarDiasUteis = (a, b) => {
    let c = 0,
      x = a,
      g = 0;
    while (x <= b && g++ < 4000) {
      if (ehDiaUtil(x)) c++;
      x = somarDias(x, 1);
    }
    return c;
  };

function pascoa(y) {
  const a = y % 19,
    b = Math.floor(y / 100),
    c = y % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31),
    da = ((h + l - 7 * m + 114) % 31) + 1;
  return y + "-" + String(mo).padStart(2, "0") + "-" + String(da).padStart(2, "0");
}

function feriados(y) {
  const e = pascoa(y);
  return [
    ["Confraternização Universal", y + "-01-01"],
    ["Carnaval (segunda)", somarDias(e, -48)],
    ["Carnaval (terça)", somarDias(e, -47)],
    ["Sexta-feira Santa", somarDias(e, -2)],
    ["Tiradentes", y + "-04-21"],
    ["Dia do Trabalho", y + "-05-01"],
    ["Corpus Christi", somarDias(e, 60)],
    ["Independência do Brasil", y + "-09-07"],
    ["Nossa Senhora Aparecida", y + "-10-12"],
    ["Finados", y + "-11-02"],
    ["Proclamação da República", y + "-11-15"],
    ["Consciência Negra", y + "-11-20"],
    ["Natal", y + "-12-25"],
  ].map(([n, d]) => ({ id: "v" + Math.random().toString(36).slice(2, 8), nome: n, ini: d, fim: d }));
}

function previsaoTermino(e) {
  const z = totaisEtapa(e);
  if (!z.n) return null;
  if (z.nd === z.n) return { done: true };
  // sem horas restantes estimadas (ex.: atividades ainda sem estimativa): não há como prever
  if (z.R <= 1 / 120) return null;
  const t = hoje(),
    ini = e.ini || "";
  let rate = estado.hd,
    real = false;
  if (z.U > 0 && ini && ini <= t) {
    const w = Math.max(1, contarDiasUteis(ini, t)),
      r = z.U / w;
    if (r >= 0.05) {
      rate = r;
      real = true;
    }
  }
  const dias = Math.max(1, Math.ceil(z.R / rate - 1e-9));
  return { date: somarDiasUteis(proximoDiaUtil(t), dias - 1), rate, real, dias };
}

function htmlCronograma(rows) {
  const ds = rows.flatMap((r) => [r.s, r.e].filter(Boolean)).concat([hoje()]);
  let from = ds.reduce((a, b) => (a < b ? a : b)),
    to = ds.reduce((a, b) => (a > b ? a : b));
  from = somarDias(from, -2);
  to = somarDias(to, 6);
  const n = diasEntre(from, to) + 1,
    px = Math.max(5, Math.min(20, Math.floor(1000 / n))),
    W = n * px,
    RH = 26;
  let hdr = "",
    bands = "";
  for (let k = 0; k < n; k++) {
    const d = somarDias(from, k);
    if (!ehDiaUtil(d)) bands += `<i class="nw" style="left:${k * px}px;width:${px}px"></i>`;
    const dt = lerDataISO(d);
    if (dt.getDate() === 1 || k === 0)
      hdr += `<span style="left:${k * px}px">${MESES[dt.getMonth()]}/${String(dt.getFullYear()).slice(2)}</span>`;
    else if (px >= 12 && dt.getDay() === 1)
      hdr += `<span class="wk" style="left:${k * px}px">${dt.getDate()}</span>`;
  }
  const lab = rows
    .map(
      (r) =>
        `<div class="gln${r.sub ? " sub" : ""}" style="height:${RH}px" title="${escaparHtml(r.l)}">${escaparHtml(r.l)}</div>`,
    )
    .join("");
  const bars = rows
    .map((r, k) => {
      if (!r.s && !r.e) return "";
      const a = r.s || r.e,
        b2 = r.e || r.s,
        l = diasEntre(from, a) * px,
        w = Math.max(px, (diasEntre(a, b2) + 1) * px);
      return `<div class="gb ${r.k || ""}" style="top:${k * RH + 5}px;left:${l}px;width:${w}px" title="${escaparHtml(r.t || r.l)}"></div>`;
    })
    .join("");
  return (
    `<div class="gantt"><div class="gcol"><div class="ghd"></div>${lab}</div>` +
    `<div class="gscr"><div style="width:${W}px;position:relative"><div class="ghd">${hdr}</div>` +
    `<div class="gbody" style="height:${rows.length * RH}px">${bands}${bars}<i class="gtd" style="left:${diasEntre(from, hoje()) * px + Math.floor(px / 2)}px" title="Hoje"></i></div></div></div></div>`
  );
}
