// Ambiente de teste: abre a ferramenta num Chromium sem janela, com as bibliotecas
// de Excel e PDF locais, um banco de dados simulado (guardado no localStorage do
// navegador de teste) e os downloads capturados em window.__dl.
//
// Pasta da ferramenta: a pasta acima desta (index.html, app.css, js/), ou a variável DIR.
// Navegador: o do Playwright, ou o executável indicado na variável CHROME.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const PASTA = process.env.DIR || path.join(__dirname, "..");
const XLSXJS = fs.readFileSync(require.resolve("xlsx/dist/xlsx.full.min.js"), "utf8");
const PDFJS = fs.readFileSync(require.resolve("pdf-lib/dist/pdf-lib.min.js"), "utf8");
const CHROME = process.env.CHROME || ["/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"].find((p) => fs.existsSync(p));

// Substitui o window.claude da página publicada: banco ("db") e downloads simulados
const INIT = `
(()=>{
 window.__dl=[];window.__errs=[];
 addEventListener("error",e=>window.__errs.push(String(e.message)));
 addEventListener("unhandledrejection",e=>window.__errs.push("rej:"+String(e.reason&&e.reason.message||e.reason)));
 const K="__fakedb",ld=()=>{try{return JSON.parse(localStorage.getItem(K)||"{}")}catch(e){return{}}},sv=s=>localStorage.setItem(K,JSON.stringify(s));
 const L={};
 const snap=c=>{const s=ld(),docs=Object.keys(s).filter(k=>k.startsWith(c+"/")&&k.split("/").length===2).map(k=>({id:k.split("/")[1],data:()=>JSON.parse(JSON.stringify(s[k]))}));return{docs,empty:!docs.length,metadata:{fromCache:false,hasPendingWrites:false}}};
 const notify=p=>{const c=p.split("/")[0];(L[c]||[]).forEach(cb=>setTimeout(()=>cb(snap(c)),5))};
 const db={doc:p=>({set:async v=>{const s=ld();s[p]=JSON.parse(JSON.stringify(v));sv(s);notify(p)},get:async()=>{const s=ld();return{exists:p in s,data:()=>s[p]}},delete:async()=>{const s=ld();delete s[p];sv(s);notify(p)}}),
  collection:c=>({onSnapshot:(cb,err)=>{(L[c]=L[c]||[]).push(cb);setTimeout(()=>cb(snap(c)),10);return()=>{}}})};
 const b64=u8=>{let s="";for(let i=0;i<u8.length;i+=8192)s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));return btoa(s)};
 const dl={save:async({filename,data})=>{let b;if(typeof data==="string")b=b64(new TextEncoder().encode(data));else b=b64(new Uint8Array(data instanceof ArrayBuffer?data:data.buffer?data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength):data));window.__dl.push({filename,b})}};
 // Google Agenda simulado: __mcpmodo = "nc" (não conectado), "falha" (upstream_error), vazio = ok
 window.__cal=[];
 const modo=()=>localStorage.getItem("__mcpmodo")||"";
 const ESQ={type:"object",properties:{calendar_id:{type:"string"},summary:{type:"string"},description:{type:"string"},start:{type:"object",properties:{dateTime:{type:"string"},timeZone:{type:"string"}}},end:{type:"object",properties:{dateTime:{type:"string"},timeZone:{type:"string"}}},visibility:{type:"string",enum:["default","public","private"]}},required:["summary","start","end"]};
 const erro=c=>Object.assign(new Error(c),{code:c});
 const mcp={listTools:async s=>({servers:modo()==="nc"?[]:[{server:"Google Calendar",authStatus:"connected",tools:[{name:"create_event"}]}]}),describeTool:async(s,t)=>{if(modo()==="nc")throw erro("server_not_connected");return{name:t,inputSchema:ESQ}},
  callTool:async(s,t,i)=>{if(modo()==="nc")throw erro("server_not_connected");if(modo()==="falha")throw erro("upstream_error");window.__cal.push(JSON.parse(JSON.stringify(i)));return{content:[{type:"text",text:"ok"}]}}};
 const perm={request:async k=>Object.fromEntries(k.map(x=>[x,"granted"])),state:async()=>({})};
 window.claude={use:async n=>{await new Promise(r=>setTimeout(r,5));if(n==="db")return localStorage.getItem("__nodb")?null:db;if(n==="downloads")return dl;if(n==="mcp")return mcp;if(n==="permissions")return perm;return null}};
})();`;

const TIPOS = { ".js": "application/javascript", ".css": "text/css", ".html": "text/html; charset=utf-8" };

// Firebase simulado (só para o teste do site próprio): login e Firestore guardados no
// localStorage do navegador de teste. __fakefs = documentos; __fakeusers = contas.
const FIREBASE_FALSO = `
(()=>{
 const ld=k=>{try{return JSON.parse(localStorage.getItem(k)||"{}")}catch(e){return{}}},sv=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
 const err=c=>Object.assign(new Error(c),{code:c});
 let cur=null;try{cur=JSON.parse(localStorage.getItem("__fakeauth")||"null")}catch(e){}
 const obs=[];const setCur=u=>{cur=u;localStorage.setItem("__fakeauth",JSON.stringify(u));obs.forEach(f=>setTimeout(()=>f(u),5))};
 const auth={languageCode:"",onAuthStateChanged(f){obs.push(f);setTimeout(()=>f(cur),5)},
  async signInWithEmailAndPassword(e,p){const us=ld("__fakeusers");if(!us[e]||us[e].p!==p)throw err("auth/invalid-credential");setCur({uid:us[e].uid,email:e})},
  async createUserWithEmailAndPassword(e,p){const us=ld("__fakeusers");if(us[e])throw err("auth/email-already-in-use");if(p.length<6)throw err("auth/weak-password");us[e]={p,uid:"u"+Object.keys(us).length+"x"};sv("__fakeusers",us);setCur({uid:us[e].uid,email:e})},
  async signInWithPopup(){setCur({uid:"g1",email:"google@exemplo.com"})},async signInWithRedirect(){},
  async signOut(){setCur(null)},async sendPasswordResetEmail(e){window.__reset=e}};
 const L={};const K="__fakefs";
 const snap=c=>{const s=ld(K),docs=Object.keys(s).filter(k=>k.startsWith(c+"/")&&!k.slice(c.length+1).includes("/")).map(k=>({id:k.slice(c.length+1),data:()=>JSON.parse(JSON.stringify(s[k]))}));return{docs,empty:!docs.length,metadata:{fromCache:false,hasPendingWrites:false}}};
 const notify=p=>{const c=p.slice(0,p.lastIndexOf("/"));(L[c]||[]).forEach(cb=>setTimeout(()=>cb(snap(c)),5))};
 const limpar=v=>JSON.parse(JSON.stringify(v));
 const fsx={settings(){},enablePersistence(){return Promise.resolve()},
  doc:p=>({set:async v=>{const s=ld(K);s[p]=limpar(v);sv(K,s);notify(p)},get:async()=>{const s=ld(K);return{exists:p in s,data:()=>s[p]}},delete:async()=>{const s=ld(K);delete s[p];sv(K,s);notify(p)}}),
  collection:c=>({onSnapshot:(o,cb,er)=>{(L[c]=L[c]||[]).push(cb);setTimeout(()=>cb(snap(c)),10);return()=>{}}})};
 function GoogleAuthProvider(){}GoogleAuthProvider.prototype.setCustomParameters=function(){};
 const a=()=>auth;a.GoogleAuthProvider=GoogleAuthProvider;
 window.firebase={initializeApp(c){window.__fbcfg=c},auth:a,firestore:()=>fsx};
})();`;

// Login do Google para a agenda (Google Identity Services) simulado: __gismodo = "nega" recusa
const GIS_FALSO = `window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:(x)=>{window.__gisPedidos=(window.__gisPedidos||[]).concat([x&&x.prompt]);setTimeout(()=>{if(localStorage.getItem("__gismodo")==="nega")o.error_callback&&o.error_callback({type:"popup_closed"});else o.callback({access_token:"tk-teste",expires_in:3600})},5)}})}}};`;

const CONFIG_TESTE = (clienteGoogle) =>
  `window.CONFIG_SITE={firebase:{apiKey:"teste",authDomain:"teste.firebaseapp.com",projectId:"teste",appId:"1"},googleClientId:${JSON.stringify(clienteGoogle || "")}};`;

// opc.site: abre como o site próprio (com login); opc.config: conteúdo do config.js
// (padrão: configurado); opc.calendario(route): responde às chamadas da API do Google Agenda.
async function open(opc = {}) {
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  await page.route("**/*", (r) => {
    const u = r.request().url();
    if (u.startsWith("http://app.test/")) {
      const p = new URL(u).pathname.slice(1) || "index.html", f = path.join(PASTA, p);
      if (opc.site && p === "config.js")
        return r.fulfill({ contentType: TIPOS[".js"], body: opc.config !== undefined ? opc.config : CONFIG_TESTE(opc.clienteGoogle) });
      if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: "" });
      let corpo = fs.readFileSync(f);
      // a versão do claude.ai não tem o bloco do site próprio
      if (p === "index.html" && !opc.site) corpo = corpo.toString().replace(/<!-- site:inicio[\s\S]*?<!-- site:fim -->/, "");
      return r.fulfill({ contentType: TIPOS[path.extname(p)] || "application/octet-stream", body: corpo });
    }
    if (opc.site && u.includes("firebase-app-compat.js")) return r.fulfill({ contentType: TIPOS[".js"], body: FIREBASE_FALSO });
    if (opc.site && u.includes("gstatic.com/firebasejs/")) return r.fulfill({ contentType: TIPOS[".js"], body: "" });
    if (opc.site && u.includes("accounts.google.com/gsi/client")) return r.fulfill({ contentType: TIPOS[".js"], body: GIS_FALSO });
    if (opc.calendario && u.startsWith("https://www.googleapis.com/calendar/")) return opc.calendario(r);
    if (u.includes("xlsx.full.min.js")) return r.fulfill({ contentType: "application/javascript", body: XLSXJS });
    if (u.includes("pdf-lib.min.js")) return r.fulfill({ contentType: "application/javascript", body: PDFJS });
    return r.abort(); // fontes e demais endereços externos ficam de fora
  });
  page.on("pageerror", (e) => (page.__perr = page.__perr || []).push(e.stack.split("\n").slice(0, 3).join(" | ")));
  page.on("dialog", (d) => d.accept());
  await page.goto("http://app.test/");
  await page.waitForTimeout(400);
  return { browser, ctx, page };
}
// Cria um projeto de teste com o Modelo JBLUE (ELT e TEL, etapa PP, com pavimentos e atividades)
// e abre a tela dele. A opção não existe mais na tela, mas é uma boa massa de teste.
async function criarProjetoModelo(page, nome, tipo = "jblue") {
  await page.evaluate(([nome, tipo]) => {
    const id = novoIdProjeto();
    projetos[id] = { id, name: nome, etapa: "PP", j: JSON.stringify(dadosNovoProjeto(tipo, "PP")), upd: Date.now() };
    gravarProjeto(id);
    abrirProjeto(id);
  }, [nome, tipo]);
  await page.waitForTimeout(300);
}
module.exports = { open, criarProjetoModelo, CONFIG_TESTE };
