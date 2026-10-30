// Configuração do site próprio (veja o LEIA-ME.md, passo 2).
// Copie os dados do seu projeto no Firebase: Configurações do projeto → Seus apps → app da Web.
// Estes dados não são senha: podem ficar no site. Quem protege os dados são as regras do Firestore.
window.CONFIG_SITE = {
  firebase: {
    apiKey: "AIzaSyBPXFAqAf7szVwvslCZMnYvocc1lD-Stag",
    authDomain: "planejamento-horas.firebaseapp.com",
    projectId: "planejamento-horas",
    storageBucket: "planejamento-horas.firebasestorage.app",
    messagingSenderId: "118183933457",
    appId: "1:118183933457:web:9629e8ccdda27782eca3b0",
  },
  // Opcional, para enviar os horários ao Google Agenda (LEIA-ME, passo 5).
  // Ex.: "1234567890-abc123.apps.googleusercontent.com". Deixe "" para não usar a agenda.
  googleClientId: "",
};
