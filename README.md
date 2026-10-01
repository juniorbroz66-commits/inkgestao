# INKGestão — Prévia local

Prévia local do app de gestão e finanças para empresa de comunicação visual, baseada no componente fornecido no briefing.

## Executar

```bash
npm install
npm run dev -- --port 4173
```

Depois abra `http://localhost:4173`.

## Acesso de demonstração

- E-mail: `juniorbroz66@gmail.com`
- Senha: `809080`

## Escopo atual

- Login e solicitação de cadastro
- Dashboard financeiro com metas e gráfico
- Lançamentos e vendas
- Filtros no histórico por data inicial/final, usuário e pedidos com valor restante a pagar
- Controle de caixa e sangrias
- Relatórios demonstrativos
- Relatório pronto para impressão / PDF pelo navegador
- Gestão de equipe para usuário Master
- Edição de cadastro da equipe: nome, e-mail e senha
- Recuperação de senha pelo e-mail cadastrado com revelação da senha atual na tela
- Persistência local via `localStorage`
- Persistência compartilhada via Firebase Firestore quando as variáveis `VITE_FIREBASE_*` forem configuradas

## Banco compartilhado entre computadores

O app já possui listeners em tempo real para as coleções `transactions`, `users`, `cashControl/general` e `settings/goals`. Para ativar o banco central:

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Ative o **Cloud Firestore**.
3. Cadastre um aplicativo Web e copie as configurações para um arquivo `.env.local`, usando `.env.example` como modelo:

```bash
cp .env.example .env.local
```

4. Preencha `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN` e `VITE_FIREBASE_PROJECT_ID`.
5. Em **Authentication → Método de login**, habilite o provedor **Anônimo**.
6. Reinicie o servidor (`npm run dev -- --port 4173`). A tela de login deverá exibir **Firestore conectado**.

O app faz autenticação anônima do Firebase antes de abrir os listeners. O arquivo `firestore.rules` permite leitura e gravação somente para sessões autenticadas. A tela de login da aplicação continua controlando o acesso funcional por vendedor; em uma próxima etapa, recomenda-se migrar também os cadastros para Firebase Authentication com e-mail/senha e regras baseadas em usuário/role.

## Impressão

Os botões de impressão das seções Visão Geral, Lançamentos, Controle de Caixa, Relatórios Automáticos e Relatórios PDF chamam a impressão nativa do navegador (`window.print()`). Na janela de impressão, escolha a impressora ou **Salvar como PDF**.

## Publicação permanente no Firebase Hosting

O projeto inclui `firebase.json` com publicação da pasta `dist`, fallback de SPA e cache para assets versionados. Para publicar:

```bash
npm install
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc
# edite .firebaserc e substitua SEU_FIREBASE_PROJECT_ID pelo ID real
npm run build
firebase deploy --only firestore:rules,hosting
```

Antes do build, configure também o `.env.local` com as variáveis Firebase. O site publicado usará o Firestore como banco compartilhado entre os computadores.

Sem `.env.local`, a prévia permanece local usando `localStorage`; com as variáveis Firebase preenchidas, passa a sincronizar os dados pelo Firestore. O fluxo de recuperação foi simplificado para validar o e-mail e revelar a senha atual na tela, conforme solicitado para esta prévia.
