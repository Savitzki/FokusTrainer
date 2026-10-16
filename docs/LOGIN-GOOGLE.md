# Entrar ou criar conta com Google

O botão **Continuar com Google** usa a conta Google para entrar ou criar o cadastro no FokusTrainer. A pessoa escolhe sua conta, autoriza e volta ao app para salvar nick e avatar. O app solicita somente identidade, e-mail e perfil básico; não pede acesso à caixa de entrada do Gmail. O cadastro com e-mail e senha continua disponível.

O código do botão já está preparado. Para funcionar no site, o proprietário precisa habilitar o provedor conforme os passos abaixo. A chave Publishable do Supabase e as tabelas criadas no banco não ativam esse provedor automaticamente.

## 1. Criar as credenciais no Google

1. Abra o [Google Cloud Console](https://console.cloud.google.com/) e escolha ou crie um projeto para o FokusTrainer.
2. Abra **Google Auth Platform** (em alguns painéis, **APIs & Services → OAuth consent screen**). Configure o nome **FokusTrainer**, e-mail de suporte, público e informações solicitadas. Use um público que permita os usuários pretendidos; **Internal** fica restrito à organização Google Workspace.
3. Em **Clients / Credentials**, crie um **OAuth client ID** do tipo **Web application**.
4. Em **Authorized JavaScript origins**, use a origem do site, sem a pasta:

   ```text
   https://savitzki.github.io
   ```

5. Em **Authorized redirect URIs**, use exatamente a URL de callback do seu projeto Supabase:

   ```text
   https://qfzoeshhogoilsmvxlif.supabase.co/auth/v1/callback
   ```

6. Guarde o **Client ID** e o **Client secret**. Eles pertencem ao Google e são diferentes das chaves do Supabase. Coloque o secret somente no provedor do Supabase, na etapa seguinte.
7. Se o aplicativo OAuth estiver em **Testing**, adicione os e-mails que farão o teste em **Audience / Test users**. Para disponibilizar aos demais usuários, ajuste o status de publicação e siga as exigências indicadas pelo Google para o seu caso. Não amplie os escopos para APIs do Gmail.

## 2. Habilitar no Supabase

1. Abra seu projeto → **Authentication → Sign In / Providers → Google**. O menu pode aparecer como **Providers** em outras versões do painel.
2. Ative **Enable Sign in with Google**.
3. Cole o **Client ID** e o **Client secret** criados no Google e salve. Mantenha as verificações de segurança padrão do provedor.
4. Confira se a **Callback URL** exibida é exatamente a cadastrada no Google.
5. Em **Authentication → URL Configuration**, defina **Site URL** e adicione a **Redirect URLs**:

   ```text
   https://savitzki.github.io/FokusTrainer/
   ```

   Essa é a página à qual o Supabase devolve a pessoa após entrar; o callback do Google termina em `/auth/v1/callback`. São endereços diferentes, com funções diferentes.

Se usar domínio próprio, configure a origem do site no Google e o endereço completo do app no Supabase. Para testar em desenvolvimento, autorize também a origem e o endereço locais realmente usados. Não são necessárias novas tabelas para habilitar o login Google.

## 3. Publicar e testar

1. No GitHub, execute **Actions → Publicar no GitHub Pages → Run workflow → main**.
2. Conecte o celular à internet, abra o app, feche todas as janelas antigas e abra novamente para atualizar a PWA.
3. Toque no avatar → **Cadastro / entrar → Continuar com Google**.
4. Escolha sua conta. O Google retorna ao FokusTrainer e a sessão deve estar conectada.
5. Salve nick e avatar. Confira a aba **Juntos** e tente sair e entrar de novo com a mesma conta.

O mesmo botão aparece tanto em cadastro quanto em login. O Supabase gerencia as identidades e o vínculo de e-mails verificados; não criamos uma segunda conta manualmente. Se já utiliza e-mail e senha, use a mesma conta Google com o mesmo e-mail verificado e confira o perfil após entrar. Registros sem login permanecem separados.

Em uma PWA, o sistema pode abrir o Google em uma aba externa. Termine o login no navegador de origem; se a janela instalada continuar sem sessão, abra o app instalado e entre por ele novamente. A sessão depende do armazenamento que cada navegador e modo instalado compartilham.

## Se aparecer um erro

- **“O login com Google ainda está sendo ativado” / provider is not enabled:** habilite Google no Supabase e confira se salvou as credenciais. O app verifica o estado do provedor antes de redirecionar e mantém a entrada por e-mail disponível.
- **redirect_uri_mismatch:** compare o callback do Google com `https://qfzoeshhogoilsmvxlif.supabase.co/auth/v1/callback`.
- **Acesso bloqueado / app em teste:** adicione sua conta em **Test users** ou conclua a publicação do aplicativo OAuth.
- **Retorna a outro site:** confira **Site URL / Redirect URLs** no Supabase, incluindo `/FokusTrainer/`.
- **Pessoa cancelou a autorização:** o app mostra uma mensagem de cancelamento e permite tentar novamente.

Os testes automatizados simulam o provedor e verificam o redirecionamento, o retorno, o cancelamento e o formulário. Um login real com Google depende da configuração acima e precisa ser confirmado com uma conta de teste do proprietário. Não envie Client secret, senha Google ou tokens administrativos no chat ou no GitHub.
