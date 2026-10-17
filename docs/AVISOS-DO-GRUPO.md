# Aviso opcional depois do treino

Depois de **Confirmar treino**, quem participa de um grupo ativo vê **Avisar o time?**. A pessoa escolhe **Avisar o grupo** ou **Agora não**; com vários grupos, escolhe quais recebem o aviso. Fechar a tela também dispensa o envio. Essa escolha só aparece depois de um registro novo neste aparelho, nunca ao carregar histórico ou recuperar um treino de outro celular.

O treino precisa confirmar online para liberar o envio. O botão **Sincronizar** tenta essa confirmação sem enviar notificação. A escolha de avisar é independente da confirmação do treino: falhar o aviso ou escolher Agora não mantém a chama e o registro.

A notificação usa o nick e o nome do grupo, por exemplo:

> **dani.treina acendeu a chama 🔥**  
> Chama das nove: treino registrado. Bora manter essa chama viva?

Recebem os demais integrantes aceitos de grupos ativos, nos aparelhos com push autorizado e habilitado. O remetente não recebe seu próprio aviso. Peso, nome usado nas frases e preferências de tratamento não são incluídos. Desativar o push ou sair da conta desativa a assinatura desse aparelho. A autorização de push do remetente não é necessária para avisar os amigos.

## Ativar no Supabase

Publicar no GitHub Pages atualiza a tela. O envio exige também banco, chaves e funções no Supabase.

1. Confira se as migrações 001–004 já foram aplicadas, conforme [Banco de dados](BANCO-DE-DADOS.md) e [Peso e horários](PESO-E-HORARIOS.md).
2. Abra o [SQL Editor do projeto](https://supabase.com/dashboard/project/qfzoeshhogoilsmvxlif/sql/new) e execute **todo** o arquivo [202610170005_group_workout_notifications.sql](../supabase/migrations/202610170005_group_workout_notifications.sql). Ele pode ser reaplicado e não apaga os registros existentes.
3. Configure as chaves VAPID, o contato do remetente, o segredo do cron e a variável pública do frontend conforme [PUSH-E-GRUPOS.md](PUSH-E-GRUPOS.md). Não coloque chaves administrativas ou privadas no frontend.
4. Publique as duas funções, usando o `supabase/config.toml` do repositório:

```sh
supabase login
supabase link --project-ref qfzoeshhogoilsmvxlif
supabase secrets set --env-file .env.push-secrets
supabase functions deploy group-notify
supabase functions deploy push-dispatch
```

5. Mantenha o agendador existente da função `push-dispatch` a cada 15 minutos, descrito no guia de push. Ele retoma os avisos de grupo que ficaram na fila; não crie outro agendamento com o mesmo propósito.
6. Publique o site com a variável pública VAPID configurada. Cada destinatário precisa ativar push em **Avisos → Ativar push neste aparelho**. No iPhone, use o app instalado na Tela de Início.

A função `group-notify` verifica o token da conta no Supabase Auth e cria a fila usando essa sessão. O banco verifica a propriedade do treino, o dia no fuso do grupo e a participação do remetente. Os destinatários são definidos pelo banco; o navegador não envia endpoints nem uma lista de pessoas. A fila tem uma entrada por treino/grupo/aparelho, com lease e proteção contra cliques repetidos.

O primeiro lote é enviado na própria solicitação, até 24 aparelhos. O agendador retoma o restante e falhas temporárias, até três tentativas. Avisos expiram após 30 minutos ou quando o treino deixa de corresponder ao dia atual do grupo. Antes de cada envio há nova checagem de grupo ativo, assinatura habilitada, dono da assinatura e participação de remetente/destinatário. Provedores podem atrasar ou repetir a entrega em uma falha de rede após aceitar a mensagem; a tag identifica o mesmo evento para o navegador substituí-lo.

O app distingue aviso enviado, aviso na fila, nenhum aparelho autorizado e serviço ainda não ativado. Não confirma entrega no celular sem confirmação do provedor de push.

## Validar sem enviar a pessoas reais

```sh
npm test
npm run build
bash scripts/test-profiles-db.sh
deno check --node-modules-dir=none --lock=deno.lock supabase/functions/group-notify/index.ts supabase/functions/push-dispatch/index.ts
deno test --allow-env --node-modules-dir=none --lock=deno.lock supabase/functions/group-notify/core.test.ts supabase/functions/push-dispatch/core.test.ts
```

Os testes do banco usam PostgreSQL descartável. Os testes das funções simulam os envios e nunca notificam usuários reais.
