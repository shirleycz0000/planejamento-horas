// Versão "site próprio" (fora do claude.ai): login e dados na nuvem com o Firebase.
//
// Só é carregado pelo index.html do site (bloco "site:inicio … site:fim"). Ele cria um
// window.claude com o mesmo jeito de usar que o claude.ai oferece, para o resto da
// ferramenta funcionar igual nas duas versões:
//   claude.use("db")          → Firestore, em users/<id do usuário>/... (cada login vê só os seus dados)
//   claude.use("downloads")   → baixa o arquivo pelo navegador
//   claude.use("mcp")         → Google Agenda direto pela API do Google (create_event)
//   claude.use("permissions") → pede ao Google a permissão da agenda
// A configuração (chaves do Firebase e o id do cliente Google) fica em config.js.

(function () {
  "use strict";
  const cfg = window.CONFIG_SITE || {},
    fb = cfg.firebase || {},
    configurado = !!(window.firebase && fb.apiKey && fb.projectId && !/COLE/i.test(fb.apiKey));
  window.SITE_PROPRIO = true;

  // Chaves do navegador que guardam dados de um usuário (o tema fica)
  const CHAVES_DO_USUARIO =
    /^(ph|phs2|phtpl|phcad|phcad-ini|phcad3|phcad3-ini|phcopias|phgcal|phgcal-conta)$/;
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
      if (cfg.googleClientId) carregarGoogle().catch(() => {}); // deixa pronta a janela da agenda
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

  // ---------- Google Agenda (direto pela API do Google) ----------
  const ESCOPO_AGENDA = "https://www.googleapis.com/auth/calendar.events",
    SERVIDOR = "Google Calendar";
  let clienteToken = null,
    token = null,
    validade = 0;
  try {
    const t = JSON.parse(sessionStorage.getItem("phgtok") || "null");
    if (t && t.v > Date.now() + 60000) {
      token = t.t;
      validade = t.v;
    }
  } catch (e) {}

  const erro = (code, message) => Object.assign(new Error(message || code), { code });

  // Conta Google da agenda: pode ser diferente do e-mail do login do site
  const lerConta = () => {
    try {
      return localStorage.getItem("phgcal-conta") || "";
    } catch (e) {
      return "";
    }
  };
  window.contaAgenda = lerConta;
  window.esquecerContaAgenda = () => {
    if (token && window.google && google.accounts && google.accounts.oauth2)
      try {
        google.accounts.oauth2.revoke(token, () => {});
      } catch (e) {}
    token = null;
    validade = 0;
    try {
      localStorage.removeItem("phgcal-conta");
      sessionStorage.removeItem("phgtok");
    } catch (e) {}
  };
  // Descobre o e-mail da agenda principal da conta autorizada (o id dela é o e-mail)
  async function guardarConta(tk) {
    try {
      const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
        headers: { Authorization: "Bearer " + tk },
      });
      if (r.ok) {
        const c = await r.json();
        if (c && c.id) localStorage.setItem("phgcal-conta", c.id);
      }
    } catch (e) {}
  }

  function carregarGoogle() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    return new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.onload = () => ok();
      s.onerror = () => falha(erro("server_unavailable", "não carregou o login do Google"));
      document.head.appendChild(s);
    });
  }

  // Pede um token da agenda ao Google; interativo = pode mostrar a tela de permissão
  // interativo: abre a escolha de conta do Google (pode ser outra conta, diferente do login do site)
  async function pedirToken(interativo) {
    if (!interativo && token && validade > Date.now() + 60000) return token;
    if (!cfg.googleClientId) throw erro("server_not_connected");
    await carregarGoogle();
    return new Promise((ok, falha) => {
      clienteToken = google.accounts.oauth2.initTokenClient({
        client_id: cfg.googleClientId,
        scope: ESCOPO_AGENDA,
        hint: interativo ? undefined : lerConta() || undefined,
        callback: (r) => {
          if (r && r.access_token) {
            token = r.access_token;
            validade = Date.now() + (Number(r.expires_in) || 3600) * 1000;
            try {
              sessionStorage.setItem("phgtok", JSON.stringify({ t: token, v: validade }));
            } catch (e) {}
            if (interativo) guardarConta(token).then(() => ok(token));
            else ok(token);
          } else falha(erro(interativo ? "consent_required" : "needs_reauth"));
        },
        error_callback: () => falha(erro(interativo ? "consent_required" : "needs_reauth")),
      });
      clienteToken.requestAccessToken({ prompt: interativo ? "select_account consent" : "" });
    });
  }

  const ESQUEMA_EVENTO = {
    type: "object",
    properties: {
      calendar_id: { type: "string" },
      summary: { type: "string" },
      description: { type: "string" },
      start: { type: "object", properties: { dateTime: { type: "string" }, timeZone: { type: "string" } } },
      end: { type: "object", properties: { dateTime: { type: "string" }, timeZone: { type: "string" } } },
      visibility: { type: "string", enum: ["default", "public", "private", "confidential"] },
    },
    required: ["summary", "start", "end"],
  };

  // create_event: POST de um evento novo; update_event: PATCH (só os campos enviados) do evento event_id
  async function criarEvento(input, atualizar) {
    const tk = await pedirToken(false);
    const { calendar_id, event_id, ...corpo } = input,
      agenda = encodeURIComponent(calendar_id || "primary");
    if (atualizar && !event_id) throw erro("bad_request", "falta o event_id");
    let r;
    try {
      r = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/" +
          agenda +
          "/events" +
          (atualizar ? "/" + encodeURIComponent(event_id) : ""),
        {
          method: atualizar ? "PATCH" : "POST",
          headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        },
      );
    } catch (e) {
      throw erro("upstream_error", "sem resposta do Google");
    }
    if (r.status === 401) {
      token = null;
      throw erro("needs_reauth");
    }
    if (r.status === 403)
      throw erro("tool_error", "o Google recusou (a API do Google Agenda está ativada no projeto?)");
    if (r.status >= 500) throw erro("upstream_error", "erro " + r.status + " no Google");
    if (!r.ok) {
      let m = "erro " + r.status;
      try {
        m = (await r.json()).error.message || m;
      } catch (e) {}
      throw erro("tool_error", m);
    }
    return { content: [{ type: "text", text: "ok" }], payload: await r.json() };
  }

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
            ...ESQUEMA_EVENTO,
            properties: { event_id: { type: "string" }, ...ESQUEMA_EVENTO.properties },
            required: ["event_id"],
          },
        };
      return { name: t, inputSchema: ESQUEMA_EVENTO };
    },
    callTool: async (s, t, input) => {
      if (s !== SERVIDOR || (t !== "create_event" && t !== "update_event")) throw erro("not_in_manifest");
      return criarEvento(input, t === "update_event");
    },
  };
  const permissoes = {
    request: async (lista) => {
      const r = {};
      for (const k of lista) {
        if (k !== "mcp:" + SERVIDOR) {
          r[k] = "unavailable";
          continue;
        }
        try {
          await pedirToken(true);
          r[k] = "granted";
        } catch (e) {
          r[k] = "denied";
        }
      }
      return r;
    },
    state: async () => ({ ["mcp:" + SERVIDOR]: token ? "granted" : "prompt" }),
  };

  window.claude = {
    use: async (nome) => {
      if (nome === "db") return configurado ? dbPronto : new Promise(() => {}); // sem config: fica na tela de login
      if (nome === "downloads") return downloads;
      if (nome === "mcp") return cfg.googleClientId ? mcp : null;
      if (nome === "permissions") return cfg.googleClientId ? permissoes : null;
      return null;
    },
  };
})();
