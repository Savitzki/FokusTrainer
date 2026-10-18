# Abrir o Capibora para testes

O endereço esperado do app é **https://savitzki.github.io/FokusTrainer/**. Ele pode continuar hospedado durante os dias de teste; cada pessoa abre esse link no próprio celular e pode instalar pelo botão do app.

## 1. Confirmar a hospedagem

No [GitHub Pages do repositório](https://github.com/Savitzki/FokusTrainer/settings/pages), deixe **Source → GitHub Actions**. Em [Actions](https://github.com/Savitzki/FokusTrainer/actions/workflows/pages.yml), confira se a execução mais recente de **Publicar no GitHub Pages** tem **build** e **deploy** verdes. O endereço só está confirmado quando o deploy termina e o site abre.

O envio de alterações para `main` inicia uma publicação automaticamente. Para repetir, use **Run workflow → main**. O GitHub Pages serve o app; o Supabase mantém as contas e os dados online.

## 2. Tirar localhost da confirmação de e-mail

Abra [Supabase → Authentication → URL Configuration](https://supabase.com/dashboard/project/qfzoeshhogoilsmvxlif/auth/url-configuration):

| Campo         | Valor                                               |
| ------------- | --------------------------------------------------- |
| Site URL      | `https://savitzki.github.io/FokusTrainer/`          |
| Redirect URLs | Adicione `https://savitzki.github.io/FokusTrainer/` |

Salve. O endereço deve incluir `/FokusTrainer/`, com a mesma capitalização. Se o template de confirmação foi editado, o botão precisa apontar para `{{ .ConfirmationURL }}`. Um endereço direto ao app não confirma o cadastro.

No app atualizado, toque no avatar → **Cadastro / entrar**, informe seu e-mail e toque em **Reenviar confirmação**. Não precisa preencher a senha para reenviar. Abra a mensagem mais recente. Um link antigo não é corrigido retroativamente; se o cadastro já estiver confirmado, use **Já tenho conta**.

O código de produção também usa esse endereço fixo como `emailRedirectTo`, inclusive ao reenviar. Isso evita que uma prévia local seja enviada como destino. Essa proteção precisa da autorização correspondente no painel do Supabase.

## 3. Permitir cadastro dos convidados

Em **Authentication → Providers → Email**, mantenha e-mail e confirmação ativados, com novos cadastros permitidos. Configure **SMTP Settings** com um provedor de e-mail, por exemplo Resend ou Brevo, e um remetente verificado. Host, porta e credenciais ficam no Supabase, nunca no GitHub nem em variáveis `VITE_`.

O serviço padrão de e-mail do Supabase tem limites baixos e restringe o envio a endereços autorizados da equipe do projeto. Isso pode funcionar para o proprietário e falhar para amigos. Para convidar pessoas externas por e-mail, configure SMTP antes de divulgar o cadastro e observe os limites do provedor e do Supabase.

O login Google é outra opção, após ativar o provedor conforme [LOGIN-GOOGLE.md](LOGIN-GOOGLE.md). Enquanto o OAuth estiver em modo de teste no Google, adicione os convidados como usuários de teste. O botão do app explica quando o provedor ainda não foi ativado.

## 4. Fazer um teste antes de compartilhar

1. Abra o endereço público numa janela privada e crie uma conta com um endereço de teste sob seu controle.
2. Confira se o e-mail chega e se a confirmação volta ao app público, sem localhost.
3. Salve nick/avatar, registre um treino e entre na mesma conta em outro navegador para verificar a sincronização.
4. Compartilhe o link com o grupo de teste. Duas contas podem adicionar amizade e criar uma ofensiva compartilhada.

Não é necessário tornar os dados do banco públicos: mantenha as políticas RLS. Perfil, novos treinos e pesos sincronizam por conta após [atualizar o banco para pesos e horários](PESO-E-HORARIOS.md). Pesos são privados e não entram no compartilhamento nem nos grupos. Push com o app fechado ainda exige [a ativação do serviço de envio](PUSH-E-GRUPOS.md).

Depois de publicar uma atualização, feche todas as abas e janelas do app e abra novamente com internet para ativar a versão nova do cache offline.
