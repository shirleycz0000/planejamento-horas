// Menus suspensos (Exportar ▾, ⚙ Configurações ▾, Cadastro ▾, ⋯ da disciplina e do pavimento).
//
// Marcação:
//   <span class="dd">
//     <button data-dd aria-expanded="false">Título ▾</button>
//     <div class="ddm" hidden> ...botões com as ações de sempre... </div>
//   </span>
// O menu abre por cima da página (position: fixed), alinhado à direita do botão
// (ou à esquerda, com a classe "l"). Clicar num item roda a ação normal do botão e fecha
// o menu; itens com data-ddkeep deixam o menu aberto (ex.: Tema, Carregar do cadastro).
// Clicar fora, Esc ou redesenhar a parte da tela onde está o menu também fecham.

let menuAberto = null;

function fecharMenus() {
  if (!menuAberto) return;
  const { btn, m } = menuAberto;
  m.hidden = true;
  btn.setAttribute("aria-expanded", "false");
  menuAberto = null;
}

function posicionarMenu() {
  if (!menuAberto) return;
  const { btn, m } = menuAberto;
  if (!btn.isConnected || !btn.offsetParent) return fecharMenus();
  const r = btn.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return fecharMenus(); // botão saiu da tela
  const w = m.offsetWidth,
    h = m.offsetHeight;
  let left = m.classList.contains("l") ? r.left : r.right - w,
    top = r.bottom + 6;
  left = Math.max(8, Math.min(left, innerWidth - w - 8));
  if (top + h > innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
  m.style.left = left + "px";
  m.style.top = top + "px";
}

function abrirMenu(btn) {
  fecharMenus();
  const m = btn.nextElementSibling;
  if (!m || !m.classList.contains("ddm")) return;
  m.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  menuAberto = { btn, m };
  posicionarMenu();
  const primeiro = m.querySelector("button:not([disabled]), input, select");
  if (primeiro && document.activeElement === btn) primeiro.focus({ preventScroll: true });
}

// Registrado depois de acoes.js: a ação do item já rodou quando o menu fecha
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-dd]");
  if (b) {
    if (menuAberto && menuAberto.btn === b) fecharMenus();
    else abrirMenu(b);
    return;
  }
  if (!menuAberto) return;
  const dentro = e.target.closest(".ddm");
  if (!dentro || !dentro.isConnected) return fecharMenus();
  if (e.target.closest("button") && !e.target.closest("[data-ddkeep]")) fecharMenus();
});

document.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "Escape" || !menuAberto) return;
    const b = menuAberto.btn;
    fecharMenus();
    b.focus();
    e.stopPropagation();
  },
  true,
);

addEventListener("scroll", posicionarMenu, true);
addEventListener("resize", posicionarMenu);
