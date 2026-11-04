// Versão "site próprio" (fora do claude.ai): login e dados na nuvem com o Firebase.
//
// Só é carregado pelo index.html do site (bloco "site:inicio … site:fim"). Ele cria um
// window.claude com o mesmo jeito de usar que o claude.ai oferece, para o resto da
// ferramenta funcionar igual nas duas versões:
//   claude.use("db")          → Firestore, em users/<id do usuário>/... (cada login vê só os seus dados)
//   claude.use("downloads")   → baixa o arquivo pelo navegador
//   claude.use("mcp")         → Google Agenda pelo app da Web do Google Apps Script da usuária
//                                (create_event / update_event; veja "Google Agenda" abaixo)
// A configuração (chaves do Firebase) fica em config.js.

(function () {
  "use strict";
  const cfg = window.CONFIG_SITE || {},
    fb = cfg.firebase || {},
    configurado = !!(window.firebase && fb.apiKey && fb.projectId && !/COLE/i.test(fb.apiKey));
  window.SITE_PROPRIO = true;

  // Chaves do navegador que guardam dados de um usuário (o tema fica)
  const CHAVES_DO_USUARIO =
    /^(ph|phs2|phtpl|phcad|phcad-ini|phcad3|phcad3-ini|phcopias|phgcal|phgcal-conta|phgcal-site)$/;
  function limparDadosLocais() {
    try {
      Object.keys(localStorage)
        .filter((k) => CHAVES_DO_USUARIO.test(k))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
  }

  // ---------- Tela de login ----------
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const tela = document.createElement("div");
  tela.id = "login";
  tela.className = "login";
  tela.setAttribute("role", "dialog");
  tela.setAttribute("aria-labelledby", "lgt");
  tela.innerHTML = `<form class="lgc" id="lgf" novalidate>
      <h1 id="lgt">Planejamento de Horas</h1>
      <p class="note" id="lgsub">Entre para ver os seus projetos.</p>
      <button type="button" class="lgg" id="lggoogle"><span aria-hidden="true">G</span> Entrar com Google</button>
      <div class="lgou"><span>ou com e-mail</span></div>
      <label>E-mail<input id="lgemail" type="email" autocomplete="email" required></label>
      <label>Senha<input id="lgsenha" type="password" autocomplete="current-password" minlength="6" required></label>
      <label id="lgsenha2l" hidden>Repita a senha<input id="lgsenha2" type="password" autocomplete="new-password" minlength="6"></label>
      <button type="submit" class="p" id="lgentrar">Entrar</button>
      <p class="lgmsg" id="lgmsg" role="alert"></p>
      <div class="lglinks">
        <button type="button" class="lnk" id="lgmodo">Criar uma conta</button>
        <button type="button" class="lnk" id="lgesqueci">Esqueci a senha</button>
      </div>
    </form>`;
  document.body.appendChild(tela);
  document.body.classList.add("sem-login");
  const $l = (id) => document.getElementById(id);
  let criando = false;
  const msg = (t, ok) => {
    $l("lgmsg").textContent = t || "";
    $l("lgmsg").classList.toggle("ok", !!ok);
  };
  function modoCriar(v) {
    criando = v;
    $l("lgsenha2l").hidden = !v;
    $l("lgentrar").textContent = v ? "Criar conta" : "Entrar";
    $l("lgmodo").textContent = v ? "Já tenho conta" : "Criar uma conta";
    $l("lgsenha").autocomplete = v ? "new-password" : "current-password";
    msg("");
  }
  const ocupado = (v) => tela.querySelectorAll("button, input").forEach((x) => (x.disabled = v));

  const ERROS = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/missing-password": "Digite a senha.",
    "auth/email-already-in-use": "Já existe uma conta com este e-mail. Use “Já tenho conta”.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos e tente de novo.",
    "auth/network-request-failed": "Sem conexão com a internet.",
    "auth/popup-closed-by-user": "A janela do Google foi fechada antes de terminar.",
    "auth/cancelled-popup-request": "",
    "auth/operation-not-allowed": "Este tipo de login não está ativado no Firebase (veja o LEIA-ME).",
    "auth/unauthorized-domain":
      "Este endereço não está autorizado no Firebase (Authentication → Configurações → Domínios autorizados).",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/invalid-api-key": "A apiKey do config.js está errada. Confira letra por letra com a do Firebase.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      "A apiKey do config.js está errada. Confira letra por letra com a do Firebase.",
  };
  const erroLogin = (e) =>
    e && e.code in ERROS
      ? ERROS[e.code]
      : "Não foi possível entrar" + (e && e.code ? " (" + e.code + ")" : "") + ".";

  if (!configurado) {
    $l("lgsub").innerHTML =
      "<b>Configuração pendente.</b> Preencha o arquivo <code>config.js</code> com os dados do seu projeto no Firebase (veja o LEIA-ME).";
    ocupado(true);
  }

  // ---------- Firebase ----------
  let auth = null,
    fs = null,
    usuario = null,
    resolverDb;
  const dbPronto = new Promise((r) => (resolverDb = r));

  if (configurado) {
    firebase.initializeApp(fb);
    auth = firebase.auth();
    auth.languageCode = "pt";
    fs = firebase.firestore();
    try {
      fs.settings({ ignoreUndefinedProperties: true, merge: true });
    } catch (e) {}
    try {
      fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    } catch (e) {}

    $l("lggoogle").addEventListener("click", async () => {
      msg("");
      const p = new firebase.auth.GoogleAuthProvider();
      p.setCustomParameters({ prompt: "select_account" });
      try {
        await auth.signInWithPopup(p);
      } catch (e) {
        if (e && e.code === "auth/popup-blocked") return auth.signInWithRedirect(p);
        msg(erroLogin(e));
      }
    });
    $l("lgf").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const email = $l("lgemail").value.trim(),
        senha = $l("lgsenha").value;
      if (!email) return msg("Digite o e-mail.");
      if (!senha) return msg("Digite a senha.");
      if (criando && senha !== $l("lgsenha2").value) return msg("As duas senhas não são iguais.");
      ocupado(true);
      try {
        if (criando) await auth.createUserWithEmailAndPassword(email, senha);
        else await auth.signInWithEmailAndPassword(email, senha);
      } catch (e) {
        msg(erroLogin(e));
      } finally {
        ocupado(false);
      }
    });
    $l("lgmodo").addEventListener("click", () => modoCriar(!criando));
    $l("lgesqueci").addEventListener("click", async () => {
      const email = $l("lgemail").value.trim();
      if (!email) return msg("Digite o seu e-mail acima e clique de novo em “Esqueci a senha”.");
      try {
        await auth.sendPasswordResetEmail(email);
        msg("Enviamos um e-mail para " + email + " com o link para criar uma nova senha.", true);
      } catch (e) {
        msg(erroLogin(e));
      }
    });

    auth.onAuthStateChanged((u) => {
      if (!u) {
        if (usuario) return void location.reload(); // saiu: recomeça limpo
        document.body.classList.add("sem-login");
        tela.hidden = false;
        return;
      }
      if (usuario) return;
      usuario = u;
      // outro usuário neste navegador: não aproveita a cópia local de quem saiu
      try {
        if (localStorage.getItem("site-uid") !== u.uid) {
          limparDadosLocais();
          localStorage.setItem("site-uid", u.uid);
        }
      } catch (e) {}
      tela.hidden = true;
      document.body.classList.remove("sem-login");
      mostrarConta(u);
      resolverDb(bancoDoUsuario(u.uid));
      carregarVinculo();
    });
  }

  // Mesmo formato do banco do claude.ai, guardado em users/<uid>/
  function bancoDoUsuario(uid) {
    const raiz = "users/" + uid + "/";
    return {
      doc: (p) => fs.doc(raiz + p),
      collection: (c) => {
        const ref = fs.collection(raiz + c);
        return { onSnapshot: (cb, err) => ref.onSnapshot({ includeMetadataChanges: true }, cb, err) };
      },
    };
  }

  // ---------- Conta (canto de cima) ----------
  function mostrarConta(u) {
    const top = document.querySelector(".topbar");
    if (!top || document.getElementById("conta")) return;
    const nome = u.email || u.displayName || "Conta";
    const s = document.createElement("span");
    s.className = "dd conta";
    s.id = "conta";
    s.innerHTML =
      `<button data-dd aria-haspopup="menu" aria-expanded="false" title="${esc(nome)}">👤 <span class="cnome">${esc(nome)}</span> ▾</button>` +
      `<div class="ddm" role="menu" hidden><div class="ddt">Conectado como</div><div class="ddk" style="padding:0 10px 6px">${esc(nome)}</div>` +
      `<div class="dds"></div><button id="sitesair" role="menuitem">Sair</button></div>`;
    const ref = document.getElementById("gchip");
    top.insertBefore(s, ref || null);
    document.getElementById("sitesair").addEventListener("click", sair);
  }

  async function sair() {
    try {
      if (typeof salvarAoSair === "function") await salvarAoSair();
    } catch (e) {}
    limparDadosLocais();
    try {
      localStorage.removeItem("site-uid");
    } catch (e) {}
    await auth.signOut();
  }

  // ---------- Downloads ----------
  const downloads = {
    save: async ({ filename, data }) => {
      const blob =
        data instanceof Blob
          ? data
          : new Blob([
              typeof data === "string"
                ? data
                : data instanceof ArrayBuffer
                  ? data
                  : data.buffer
                    ? data
                    : String(data),
            ]);
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return { saved: true };
    },
  };

  // ---------- Google Agenda (pelo Google Apps Script da própria conta) ----------
  // O acesso direto do site à API do Google dura só 1 hora e, para renovar, abre a janela do
  // Google. Por isso a agenda usa um pequeno "app da Web" do Google Apps Script, criado uma vez
  // na conta Google da agenda (CODIGO_SCRIPT). Ele roda como a dona da conta, não expira e só
  // aceita pedidos com a chave do vínculo. O vínculo { url, chave, conta } fica no banco do
  // usuário (users/<uid>/meta/agenda), então vale em qualquer computador ou celular.
  const SERVIDOR = "Google Calendar";
  let vinculo = null,
    resolverVinculo;
  const vinculoPronto = new Promise((r) => (resolverVinculo = r));
  try {
    vinculo = JSON.parse(localStorage.getItem("phgcal-site") || "null");
  } catch (e) {}

  const erro = (code, message) => Object.assign(new Error(message || code), { code });
  const docVinculo = () => fs.doc("users/" + usuario.uid + "/meta/agenda");

  async function carregarVinculo() {
    try {
      const d = await docVinculo().get();
      vinculo = d.exists && d.data() && d.data().url ? d.data() : null;
      localStorage.setItem("phgcal-site", JSON.stringify(vinculo));
    } catch (e) {} // sem rede: fica com a cópia do navegador
    resolverVinculo();
    document.dispatchEvent(new CustomEvent("agenda-site"));
  }

  // Manda um pedido ao script. Erros de rede são "incertos" (o evento pode ter sido criado).
  async function chamarScript(dados, v = vinculo) {
    if (!v || !v.url) throw erro("server_not_connected");
    let r;
    try {
      r = await fetch(v.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // pedido simples (sem pré-verificação CORS)
        body: JSON.stringify({ ...dados, chave: v.chave }),
      });
    } catch (e) {
      throw erro("upstream_error", "sem resposta do Google");
    }
    let j = null;
    try {
      j = await r.json();
    } catch (e) {
      // o Google devolveu uma página em vez do resultado: implantação errada ou sem acesso
      throw erro("script_invalido");
    }
    if (!j || !j.ok) {
      if (j && j.erro === "chave") throw erro("script_chave");
      if (j && j.erro === "nao_encontrado") throw erro("tool_error", "o evento não está mais na agenda");
      throw erro("tool_error", (j && j.mensagem) || "erro no script");
    }
    return j;
  }

  const ms = (x) => Date.parse((x && (x.dateTime || x.date_time)) || x);

  window.agendaSite = {
    pronto: () => vinculoPronto,
    obter: () => vinculo,
    // confere um script novo; devolve a conta (e-mail) da agenda
    testar: async (url, chave) => {
      const j = await chamarScript({ acao: "testar" }, { url, chave });
      return { conta: j.conta || "", versao: Number(j.versao) || 1 };
    },
    salvar: async (v) => {
      vinculo = v;
      localStorage.setItem("phgcal-site", JSON.stringify(v));
      await docVinculo().set({ ...v, upd: Date.now() });
    },
    apagar: async () => {
      vinculo = null;
      localStorage.removeItem("phgcal-site");
      try {
        await docVinculo().delete();
      } catch (e) {}
    },
  };
  window.contaAgenda = () => (vinculo && vinculo.conta) || "";

  const ESQUEMA_EVENTO = {
    type: "object",
    properties: {
      summary: { type: "string" },
      description: { type: "string" },
      start: { type: "object", properties: { dateTime: { type: "string" }, timeZone: { type: "string" } } },
      end: { type: "object", properties: { dateTime: { type: "string" }, timeZone: { type: "string" } } },
    },
    required: ["summary", "start", "end"],
  };

  const mcp = {
    listTools: async () => ({
      servers: [
        {
          server: SERVIDOR,
          authStatus: "connected",
          tools: [
            { name: "create_event", description: "" },
            { name: "update_event", description: "" },
          ],
        },
      ],
    }),
    describeTool: async (s, t) => {
      if (s !== SERVIDOR || (t !== "create_event" && t !== "update_event")) throw erro("bad_request");
      if (t === "update_event")
        return {
          name: t,
          inputSchema: {
            type: "object",
            properties: {
              event_id: { type: "string" },
              start: ESQUEMA_EVENTO.properties.start,
              end: ESQUEMA_EVENTO.properties.end,
              description: { type: "string" },
            },
            required: ["event_id", "start", "end"],
          },
        };
      return { name: t, inputSchema: ESQUEMA_EVENTO };
    },
    callTool: async (s, t, input) => {
      if (s !== SERVIDOR) throw erro("not_in_manifest");
      await vinculoPronto;
      if (t === "create_event") {
        const j = await chamarScript({
          acao: "criar",
          titulo: input.summary,
          descricao: input.description || "",
          t0: ms(input.start),
          t1: ms(input.end),
        });
        return { content: [{ type: "text", text: "ok" }], payload: { id: j.id } };
      }
      if (t === "update_event") {
        await chamarScript({
          acao: "atualizar",
          id: input.event_id,
          t0: ms(input.start),
          t1: ms(input.end),
          ...(typeof input.description === "string" ? { descricao: input.description } : {}),
        });
        return { content: [{ type: "text", text: "ok" }], payload: { id: input.event_id } };
      }
      throw erro("not_in_manifest");
    },
  };

  window.claude = {
    use: async (nome) => {
      if (nome === "db") return configurado ? dbPronto : new Promise(() => {}); // sem config: fica na tela de login
      if (nome === "downloads") return downloads;
      if (nome === "mcp") return configurado ? mcp : null;
      return null;
    },
  };
})();
