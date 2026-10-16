# Amigos, ofensivas coletivas e Web Push

O código está preparado; esses recursos online só ficam ativos depois da configuração abaixo. GitHub Pages hospeda o site. **Supabase** guarda confirmações, amizades e grupos e executa o agendador de push. Não há assinatura paga obrigatória no código; confira os limites e custos atuais do seu projeto antes de ampliar o uso.

## O que significa ativar o push

Há duas ativações:

| Onde | O que precisa acontecer |
| --- | --- |
| **Servidor, uma vez para o app** | Gerar as chaves de envio, publicar a função `push-dispatch` e configurar o agendador no Supabase. |
| **Cada celular** | Entrar na conta, escolher horário/tom em **Avisos**, tocar em **Ativar push neste aparelho** e permitir notificações. No iPhone, instalar na Tela de Início antes. |

O fluxo é: **o agendador verifica o treino → a função envia o aviso → o navegador entrega ao celular**, mesmo com o app fechado. Se o treino de hoje já sincronizou, o servidor suprime o aviso. O sistema do celular pode atrasar ou bloquear a entrega conforme suas configurações.

Se você recebeu **“Pronto! Banco atualizado…”** no SQL Editor, as tabelas já estão criadas. Ainda faltam as chaves, a função de envio, o agendador e a autorização do aparelho. Instalar a PWA ou permitir notificações, isoladamente, não publica esse serviço.

Para o Codex realizar a configuração administrativa, o campo seguro **`SUPABASE_ACCESS_TOKEN`** do ambiente precisa estar preenchido e a configuração do ambiente precisa estar salva e publicada. Esse token é criado em [Supabase → Account → Access Tokens](https://supabase.com/dashboard/account/tokens). Ele autoriza configurar o projeto; não é a chave pública do app nem uma chave VAPID. Nunca deve entrar no chat, no GitHub ou no frontend. Depois da configuração, pode ser revogado: o agendador usa seu próprio segredo e as chaves do serviço.

O caminho manual está nas etapas 2 a 5 abaixo e permite configurar pelo seu computador sem fornecer esse token ao Codex.

## 1. Ativar amigos e grupos

Primeiro configure cadastro, e-mail e as duas variáveis públicas conforme [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md).

**Se você já executou o primeiro SQL e só criou a tabela de perfis**, use o arquivo único [ATUALIZAR-BANCO.sql](../supabase/ATUALIZAR-BANCO.sql). Abra o arquivo no GitHub, clique em **Raw**, copie todo o conteúdo, entre no **SQL Editor → New query** do seu projeto e cole. Clique em **Run**. Ele aplica apenas as duas atualizações abaixo, em uma única transação, sem recriar a tabela de perfis. Ao terminar aparece a mensagem **“Pronto! Banco atualizado…”**. Execute esse arquivo uma vez; se já houver parte das atualizações, ele interrompe sem alterar os dados e orienta a usar as migrações individuais. Depois de usá-lo, não execute novamente os arquivos 002 e 003.

Esse arquivo prepara as tabelas de push; a ativação dos envios continua nas etapas 2 a 5 deste guia.

No **SQL Editor** do Supabase, execute cada arquivo inteiro, uma única vez, nesta ordem:

1. [202610160001_profiles.sql](../supabase/migrations/202610160001_profiles.sql), **somente se ainda não foi aplicado**.
2. [202610160002_social.sql](../supabase/migrations/202610160002_social.sql).
3. [202610160003_push.sql](../supabase/migrations/202610160003_push.sql).

Os arquivos já incluem uma transação (`BEGIN`/`COMMIT`) para evitar migração parcial caso ocorra erro. Não execute arquivos de `supabase/tests/` no projeto real. Se já usa Supabase CLI com histórico de migrações, aplique pelo seu fluxo habitual, sem reaplicar as migrações já executadas pelo painel.

Para manter o arquivo único alinhado às migrações, execute `node scripts/build-database-update.mjs`. O teste do banco verifica que o arquivo gerado corresponde às fontes e executa o mesmo SQL fornecido ao usuário.

No aplicativo, entre na conta e salve o perfil. Em **Juntos**, copie seu código e envie ao amigo pelo canal que preferir. O amigo cola o código e envia o pedido; você aceita. Depois, qualquer um cria um grupo e convida os amigos aceitos. Cada participante aceita também o convite do grupo.

- Grupos têm **2 a 8 participantes** e começam no dia em que o último convite é aceito, usando o **fuso do criador**, exibido no card. As confirmações de treino feitas antes do aceite, dentro desse mesmo dia, contam.
- Cada pessoa confirma o treino no app. Quando todas tiverem uma confirmação recebida pelo servidor dentro do dia do grupo, o banco salva uma única conclusão coletiva.
- Um dia inteiro incompleto zera a sequência coletiva. O recorde e as conclusões anteriores permanecem no banco. A sequência individual continua independente.
- Treino offline mantém a chama individual local, mas precisa sincronizar **antes da meia-noite no fuso do grupo**. O app tenta ao abrir, voltar à internet, voltar à aba e a cada minuto com a aba visível. O botão de atualizar em Juntos também tenta. Não há preenchimento retroativo da chama coletiva.
- Novos treinos online voltam ao app em outros aparelhos da mesma conta. Histórico antigo de dias passados não é importado. Peso e lembretes locais continuam apenas no dispositivo.
- Participantes ficam fixos. Qualquer membro pode **sair e encerrar o grupo para todos** em “Opções do grupo”; para mudar o time, criem outro. Recusar o convite também encerra aquele grupo pendente. Excluir uma conta no backend encerra os grupos dos quais ela participava.
- Não há busca pública de pessoas, e-mail público ou exposição do peso. As funções no banco entregam apenas nick e estado de treino aos participantes autorizados. Códigos de amizade são aleatórios e não podem ser editados pela API do app.

## 2. Gerar as chaves de Web Push

Na pasta do projeto, com Node instalado:

```sh
node scripts/generate-push-keys.mjs
```

Isso cria **`.env.push-secrets`**, ignorado pelo Git, com permissões restritas e sem imprimir os segredos. Não sobrescreve um arquivo existente. Abra esse arquivo **somente no seu editor local**, altere `VAPID_SUBJECT` para `mailto:seu-email-real@dominio.com` e guarde uma cópia segura. Não envie seu conteúdo no chat ou no GitHub.

No GitHub, em **Settings → Secrets and variables → Actions → Variables**, adicione:

| Variável pública | Valor |
| --- | --- |
| `VITE_VAPID_PUBLIC_KEY` | Apenas o valor de `VAPID_PUBLIC_KEY` |

A URL e a chave pública do Supabase já vêm de `.env.production` no projeto atual. Se usar outro projeto, substitua as duas configurações `VITE_SUPABASE_…` juntas, conforme o guia do banco. Para desenvolvimento, adicione também a chave pública VAPID a `.env.local`.

**`VAPID_PRIVATE_KEY`, `PUSH_CRON_SECRET` e `service_role` nunca entram em variáveis `VITE_`.** Uma chave VAPID pública identifica seu remetente; a privada permite assinar os envios. Trocar o par exige que as pessoas reativem o push nos aparelhos.

## 3. Publicar o serviço de envio

Instale a [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) na sua máquina. Na raiz do repositório:

```sh
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase secrets set --env-file .env.push-secrets
supabase functions deploy push-dispatch
```

`SEU_PROJECT_REF` aparece no painel do projeto e na URL da API. A Edge Function usa os segredos do arquivo e as variáveis internas `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` fornecidas pelo Supabase. Não copie a chave administrativa para o frontend.

O arquivo `supabase/config.toml` desativa a verificação JWT **apenas nessa função** porque a chamada vem do cron. O handler exige `x-cron-secret` antes de acessar o banco. Não remova essa verificação. O serviço não recebe uma lista arbitrária de destinatários pelo corpo da requisição.

## 4. Agendar a cada 15 minutos

No painel do Supabase, habilite **Cron (`pg_cron`)** e **`pg_net`** em Extensions/Integrations, conforme os menus do seu projeto. Use o **Vault** para guardar o mesmo `PUSH_CRON_SECRET` do arquivo local, com o nome `fokus_push_cron_secret`. Cadastre pelo painel de segredos do Vault para evitar colocar o valor em consultas salvas.

No SQL Editor, troque **apenas a URL** pelo seu projeto e execute:

```sql
select cron.schedule(
  'fokus-push-quarter-hour',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/push-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'fokus_push_cron_secret' limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);
```

Não cadastre vários agendamentos com nomes diferentes. Para pausar: `select cron.unschedule('fokus-push-quarter-hour');`. Veja as execuções em Cron e os resultados HTTP em `net._http_response`, sem copiar cabeçalhos/segredos para logs públicos.

## 5. Publicar o site e autorizar o celular

1. Execute **Actions → Publicar no GitHub Pages → Run workflow → main**.
2. Feche todas as janelas antigas do FokusTrainer e abra novamente para ativar o novo service worker.
3. Entre na conta e salve seu perfil. Em **Avisos → Avisos com o app fechado**, escolha o horário e o tom.
4. Toque em **Ativar push neste aparelho** e autorize o sistema. Cada aparelho exige sua própria autorização.
5. **iPhone/iPad:** iOS/iPadOS 16.4 ou superior, site adicionado à Tela de Início e aberto pelo ícone. No Android, use um navegador com Web Push. HTTPS é obrigatório.

O primeiro aviso pode chegar no próximo ciclo do cron depois do horário escolhido (entre 08h e 20h). Às **21h**, há uma última chamada se ainda faltar confirmação online naquele dia. O tom dramático é opcional. O agendador não inicia envios das 22h às 08h; o sistema do aparelho ainda pode atrasar a apresentação.

O servidor não sabe de um treino que só existe offline. Depois de sincronizado, ele suprime os próximos avisos daquele dia. Há uma checagem imediatamente antes do envio, mas um aviso já entregue ao provedor pode chegar junto da confirmação. Push depende do navegador, rede, bateria, permissões e configurações do sistema; não há garantia de horário exato.

**Desativar neste aparelho** remove a assinatura. Sair da conta também tenta desativar e remove a assinatura do navegador; em caso de erro de conexão, tente novamente ou bloqueie a permissão pelo sistema. Atualizar horário, tom ou fuso requer salvar os avisos nesse aparelho novamente. Limpar os dados do site ou remover a PWA pode exigir nova autorização.

## Operação e validação

A fila tem uma entrada por aparelho/dia/horário, até três tentativas, bloqueio contra cron concorrente e prazo de entrega curto. Respostas 404/410 desativam assinaturas expiradas; 429/erros temporários são tentados novamente. Assinaturas com chave VAPID antiga não são enviadas. A função processa até 24 itens por execução; monitore a fila antes de aumentar a base de usuários. O limite de duas mensagens é por evento e aparelho: uma falha de rede depois de o provedor aceitar pode causar repetição; a tag ajuda o navegador a substituir o mesmo aviso.

A rotina de envio remove itens da fila com mais de 30 dias. Ela não apaga histórico de grupos nem de treinos.

```sh
npm test
npm run build
bash scripts/test-profiles-db.sh
deno check --node-modules-dir=none --lock=deno.lock supabase/functions/push-dispatch/index.ts
deno test --allow-env --node-modules-dir=none --lock=deno.lock supabase/functions/push-dispatch/core.test.ts
```

O teste do banco usa PostgreSQL 17 descartável em Docker. O teste da função verifica autorização, destinos, reenvios e criptografia com chaves de teste; não manda mensagens reais.

Para validar de ponta a ponta, use duas contas próprias/de teste: aceite amizade e grupo, confirme só um treino (dia incompleto), confirme o outro (chama coletiva salva), e repita uma confirmação (sem duplicação). Em um aparelho de teste com push autorizado, escolha um horário próximo entre 08h e 20h, mantenha o treino pendente e aguarde o cron com o app fechado. Depois confirme online e confira que o próximo aviso é suprimido. Teste também a desativação. Não inclua pessoas que não aceitaram participar.
