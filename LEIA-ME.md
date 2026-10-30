# Planejamento de Horas: como colocar o site no ar

Você vai criar duas contas gratuitas: **Firebase**, onde ficam o login e os dados, e **GitHub**,
onde fica o site. Leva uns 30 minutos, e só precisa ser feito uma vez. Nada aqui é pago: o plano
gratuito do Firebase ("Spark") e o GitHub Pages bastam.

Nos passos abaixo, onde estiver `SEU-USUARIO`, use o seu nome de usuário do GitHub.

---

## Passo 1: criar o projeto no Firebase

1. Abra **https://console.firebase.google.com** e entre com a sua conta Google.
2. Clique em **Criar um projeto** (ou "Adicionar projeto").
3. Nome: `planejamento-horas`. Clique em **Continuar**.
4. Desative o **Google Analytics** (não é necessário) e clique em **Criar projeto**.

## Passo 2: registrar o site e preencher o `config.js`

1. Na página inicial do projeto, clique no ícone **`</>`** (Web).
2. Apelido: `site`. **Não** marque "Firebase Hosting". Clique em **Registrar app**.
3. Vai aparecer um bloco `const firebaseConfig = { apiKey: "...", authDomain: "...", ... }`.
4. Abra o arquivo **`config.js`** desta pasta num editor de texto (Bloco de Notas serve).
5. Troque cada `COLE_AQUI` pelos valores do bloco do Firebase (`apiKey`, `authDomain`,
   `projectId`, `storageBucket`, `messagingSenderId`, `appId`). Mantenha as aspas.
6. Salve o arquivo.

> Esses dados não são senha: eles só dizem qual projeto do Firebase o site usa. Quem protege
> os dados são as regras do passo 4.

## Passo 3: ligar o login

1. No menu à esquerda: **Criação → Authentication → Vamos começar**.
2. Aba **Método de login**:
   - **E-mail/senha**: ative a primeira chave e clique em **Salvar**.
   - **Adicionar novo provedor → Google**: ative, escolha o seu e-mail de suporte e clique em **Salvar**.

## Passo 4: criar o banco de dados

1. No menu à esquerda: **Criação → Firestore Database → Criar banco de dados**.
2. Local: **southamerica-east1 (São Paulo)**. Clique em **Avançar**.
3. Escolha **Iniciar no modo de produção** e clique em **Criar**.
4. Abra a aba **Regras**, apague o que estiver lá, cole todo o conteúdo do arquivo
   **`firestore.rules`** desta pasta e clique em **Publicar**.

Com essas regras, cada login só enxerga e grava os próprios dados.

## Passo 5: colocar o site no ar (GitHub Pages)

1. Crie uma conta em **https://github.com**, se ainda não tiver.
2. Clique em **+ → New repository**.
   - Nome: `planejamento-horas`.
   - Deixe **Public**, porque o GitHub Pages gratuito exige repositório público. Só o código fica
     público; os seus dados ficam no Firebase, protegidos pelo login.
   - Clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**.
4. Arraste **todo o conteúdo desta pasta** (os arquivos e as pastas `js` e `testes`) e clique em
   **Commit changes**.
5. Vá em **Settings → Pages**. Em "Branch", escolha **main** e **/ (root)** e clique em **Save**.
6. Em 1 ou 2 minutos aparece o endereço do site: `https://SEU-USUARIO.github.io/planejamento-horas/`

## Passo 6: autorizar o endereço do site no Firebase

1. No Firebase: **Authentication → Configurações → Domínios autorizados → Adicionar domínio**.
2. Digite `SEU-USUARIO.github.io` e clique em **Adicionar**.

Pronto! Abra o endereço do site, clique em **Criar uma conta** (ou **Entrar com Google**) e use.

---

## Passo 7 (opcional): enviar os horários para o Google Agenda

1. Abra **https://console.cloud.google.com**. No topo, selecione o projeto **planejamento-horas**
   (é o mesmo do Firebase).
2. **APIs e serviços → Biblioteca**: procure **Google Calendar API** e clique em **Ativar**.
3. **Google Auth Platform** (ou "Tela de permissão OAuth"):
   - Se pedir, clique em **Vamos começar**: nome do app `Planejamento de Horas`, seu e-mail,
     público **Externo**, e conclua.
   - **Público-alvo → Usuários de teste → Adicionar usuários**: coloque o e-mail da sua agenda.
   - **Acesso a dados → Adicionar ou remover escopos**: marque
     `.../auth/calendar.events` (ou digite `https://www.googleapis.com/auth/calendar.events`)
     e salve.
4. **Clientes** (ou "Credenciais"): abra o **Web client (auto created by Google Service)**.
   - Em **Origens JavaScript autorizadas**, adicione `https://SEU-USUARIO.github.io` e salve.
   - Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`).
5. No `config.js`, cole esse ID em `googleClientId: "..."` e envie o `config.js` de novo para o
   GitHub (**Add file → Upload files**).
6. No site, clique em **📅 Vincular Google Agenda → Vincular** e permita o acesso.

> Como o app é só seu e não passou pela verificação do Google, a janela do Google pode avisar
> "O Google não verificou este app". Clique em **Continuar**: é esperado para um app pessoal em
> modo de teste.

---

## Passo 8: trazer os seus dados do claude.ai

1. Abra a ferramenta no **claude.ai**: **💾 Backup ▾ → Baixar backup de tudo (.json)**.
2. Abra o **site**, entre com o seu login e clique em **💾 Backup ▾ → Restaurar um backup…**.
   Escolha o arquivo e confirme.

O backup leva os projetos, os modelos e os cadastros das etapas. Use o mesmo botão de vez em
quando para guardar uma cópia no computador.

---

## Atualizações

- **Pelo chat:** em claude.ai → Configurações → Conectores, conecte o **GitHub** e me diga o nome
  do repositório (ex.: `SEU-USUARIO/planejamento-horas`). Eu faço a mudança, rodo os testes e envio;
  o site se atualiza sozinho em 1 ou 2 minutos.
- **Manual:** envie os arquivos alterados pelo GitHub (**Add file → Upload files**).

Os dados ficam no Firebase, separados do código: atualizar o site não apaga nada.

## Perguntas comuns

- **Outras pessoas podem usar?** Sim. Cada pessoa cria o próprio login e vê só os próprios projetos.
- **Quero que só e-mails específicos entrem:** no passo 4, troque a linha `allow read, write` das
  regras por:
  `allow read, write: if request.auth != null && request.auth.uid == uid && request.auth.token.email in ["voce@exemplo.com"];`
- **Esqueci a senha:** na tela de login, digite o e-mail e clique em **Esqueci a senha**.
- **Erro "Este endereço não está autorizado":** falta o passo 6.
- **Erro "Este tipo de login não está ativado":** falta ativar o provedor no passo 3.
