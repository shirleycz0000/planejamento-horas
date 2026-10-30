// Tabela de ações dos botões.
//
// Todo botão da página é ligado a uma ação pelo id (ex.: <button id="newp">)
// ou por um atributo data-* (ex.: <button data-del="ID da atividade">).
// Para criar um botão novo, registre a ação no arquivo do assunto:
//   acao("#meu-botao", () => { ... });
//   acao("data-minha-acao", (valor, botao) => { ... });
//
// Opções:
//   { salvar: true }  depois da ação, redesenha a tela da etapa e salva o projeto
//                     (a ação pode devolver false para pular esse passo);
//   { janela: true }  a ação só roda com uma janela (diálogo) aberta;
//   { salvar: true, linha: (valor) => idDaAtividade }  em vez de redesenhar a tela
//                     inteira, atualiza só a linha dessa atividade (mais rápido).
const ACOES = { id: {}, dado: {} };
const SALVA = { salvar: true };
const SALVA_LINHA = { salvar: true, linha: (v) => String(v).split(":")[0] }; // valor "id" ou "id:índice"

function acao(chave, fn, opc = {}) {
  const a = { chave, fn, salvar: !!opc.salvar, janela: !!opc.janela, linha: opc.linha || null };
  if (chave[0] === "#") ACOES.id[chave.slice(1)] = a;
  else ACOES.dado[chave.replace(/^data-/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = a;
}

function acaoDoBotao(t) {
  if (t.id && ACOES.id[t.id]) return { a: ACOES.id[t.id], v: undefined };
  for (const k in t.dataset) if (ACOES.dado[k]) return { a: ACOES.dado[k], v: t.dataset[k] };
  return null;
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  const r = acaoDoBotao(t);
  if (!r || (r.a.janela && !janela)) return;
  if (r.a.fn(r.v, t, e) !== false && r.a.salvar) {
    if (r.a.linha) atualizarAtividade(r.a.linha(r.v));
    else desenhar();
    salvar();
  }
});
