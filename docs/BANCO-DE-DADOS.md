# Configurar o banco do FokusTrainer

O caminho mais simples para este projeto é **Supabase**: ele oferece PostgreSQL, cadastro/login e uma API que o app no GitHub Pages pode acessar. O GitHub Pages hospeda os arquivos do app; ele não executa um banco de dados.

## O que já está preparado

- Sem configuração externa: nick, avatar, foto, treinos e pesos ficam neste navegador. O perfil local não é uma conta.
- Com Supabase: cadastro com e-mail e senha, confirmação do e-mail, login, logout, perfil e novos treinos sincronizados, amizades e grupos. As senhas são gerenciadas pelo Supabase Auth, nunca pela tabela de perfis.
- **Pesos sincronizam após aplicar a migração 004; lembretes locais ficam no dispositivo.** Cada conta tem armazenamento separado. Pesos associados à conta são recuperados automaticamente; pesos sem login só são importados pela opção no app. Treinos antigos de dias passados também não são importados para o servidor. Novos treinos confirmados hoje tentam sincronizar ao abrir o app com internet.
- Web Push é opcional e precisa de chaves e agendador além do banco: siga [PUSH-E-GRUPOS.md](PUSH-E-GRUPOS.md).

## 1. Criar o projeto

1. Crie uma conta em [supabase.com](https://supabase.com/) e um projeto.
2. Escolha a região mais próxima de seus usuários. Guarde a senha do banco em um gerenciador de senhas; ela **não é usada no frontend**.
3. Aguarde o banco ficar disponível.

## 2. Criar a tabela de perfis

No projeto Supabase, abra **SQL Editor → New query**. Copie o conteúdo de [202610160001_profiles.sql](../supabase/migrations/202610160001_profiles.sql) e execute uma vez.

Depois aplique também as migrações `202610160002_social.sql` e `202610160003_push.sql`, conforme [o guia de amigos e push](PUSH-E-GRUPOS.md#1-ativar-amigos-e-grupos). Os arquivos já incluem transações; execute cada um inteiro. Se perfis já estiverem configurados, comece pelas migrações novas.

Para quem já executou **somente o primeiro arquivo**, há uma opção de copiar e executar tudo de uma vez: [ATUALIZAR-BANCO.sql](../supabase/ATUALIZAR-BANCO.sql). Ele reúne as migrações 002 e 003 e preserva os perfis existentes. Use esse arquivo único **ou** as duas migrações individuais. Depois, execute também a migração 004 de pesos e horários mencionada acima em Tabelas adicionais.

O script cria a tabela `public.profiles`, as validações e as regras de acesso. Ele é destinado a um projeto novo; se já houver uma tabela `profiles`, não a apague para repetir o script. Ajuste a migração ao esquema existente.

Depois de aplicar as migrações 004 e 005 descritas nos guias de pesos e avisos de grupo, aplique também [202610170006_database_maintenance.sql](../supabase/migrations/202610170006_database_maintenance.sql). Ela adiciona índices às relações e restringe a execução direta de gatilhos internos, sem remover registros. Pode ser reaplicada. Configure também a senha mínima do Supabase Auth para **8 caracteres**, acompanhando o cadastro do app. O arquivo `ATUALIZAR-BANCO.sql` continua reunindo apenas 002–003; ele não substitui as migrações seguintes.

A [revisão de 17/10/2026](REVISAO-DO-BANCO-2026-10-17.md) registra o que foi conferido e aplicado diretamente no projeto atual, além das pendências de serviços externos.

Depois das migrações 001–007, aplique [202610170008_training_schedule.sql](../supabase/migrations/202610170008_training_schedule.sql) para habilitar [semana personalizada e descansos individuais e coletivos](SEMANA-E-DESCANSOS.md). Ela mantém os treinos, pesos e conquistas anteriores, adiciona versões futuras da programação e cotas de descanso controladas pelo servidor. No projeto atual, essa migração foi aplicada em 17/10/2026; a validação confirmou RLS nas três tabelas novas e a preservação dos registros existentes.

| Campo                          | Uso                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `id`                           | ID da conta em `auth.users`                                                   |
| `nickname`                     | Nome de exibição; 3 a 24 caracteres, não é um identificador público exclusivo |
| `avatar_style`, `avatar_color` | Estilo e cor do avatar                                                        |
| `avatar_photo`                 | Foto opcional reduzida a 256 × 256 e armazenada como imagem pequena           |
| `created_at`, `updated_at`     | Datas de criação e atualização                                                |

O app cria o perfil após o usuário entrar e salvá-lo pela primeira vez. Não é preciso inserir usuários ou senhas manualmente.

**Row Level Security (RLS)** garante que uma conta leia e altere apenas seu próprio perfil. A tabela não permite leitura anônima. Mantenha essas regras habilitadas; não abra acesso público para resolver um erro de configuração. O card para redes sociais é gerado no dispositivo e não depende de expor a tabela ao público.

Para um volume maior de fotos, migre `avatar_photo` para um bucket do Supabase Storage com políticas próprias. Nesta versão as fotos pequenas ficam no perfil para também poderem ser usadas offline pelo app.

## 3. Configurar o cadastro e o e-mail

1. Em **Authentication**, mantenha o provedor **Email** e a confirmação de e-mail habilitados.
2. Em **URL Configuration**, configure o **Site URL** como:

   ```text
   https://savitzki.github.io/FokusTrainer/
   ```

3. Adicione esse mesmo endereço à lista de **Redirect URLs**. Se usar domínio próprio, use o endereço real, com a pasta correta.
4. Para desenvolvimento local, adicione também o endereço do servidor de desenvolvimento à lista de redirecionamentos, por exemplo `http://localhost:5173/`.
5. Configure um provedor SMTP para enviar e-mails de confirmação a usuários reais. O envio padrão do Supabase é limitado e pode restringir destinatários; consulte os limites apresentados no painel do seu projeto. O app não envia e-mails por conta própria.

### Se novos cadastros falharem

Na verificação de 17/10/2026, os logs do projeto confirmaram recusas de `/signup` com **HTTP 429 — email rate limit exceeded**. A configuração exigia confirmação, sem SMTP próprio, com limite de **2 e-mails por hora**. Corrigir as tabelas ou reenviar repetidamente não libera esse limite. O [envio padrão do Supabase](https://supabase.com/docs/guides/auth/auth-smtp) também restringe destinatários aos membros da organização.

Para liberar o cadastro ao público, configure **Authentication → Email → SMTP Settings** (em algumas versões, **Project Settings → Authentication → SMTP Settings**) com um provedor como Resend ou Brevo. São necessários host, porta, usuário, senha SMTP e endereço de remetente autorizado pelo provedor. O remetente ou domínio precisa estar verificado. Confira os limites em **Authentication → Rate Limits** depois de ativar o SMTP próprio, respeitando a capacidade do provedor.

O token administrativo do Supabase permite aplicar essa configuração, mas não fornece as credenciais do provedor de e-mail. Para configuração assistida, disponibilize as credenciais nas configurações seguras do ambiente; nunca no chat, GitHub, variáveis `VITE_*` ou arquivos publicados. A confirmação de e-mail deve continuar habilitada. Não são necessárias novas tabelas ou exclusão de contas para resolver esse erro.

O formulário distingue problemas no e-mail, senha fraca, conta existente, confirmação pendente, limite de envio, conexão e indisponibilidade do serviço. Erros de e-mail ou senha devolvidos pelo Supabase voltam à etapa correspondente, preservando o restante do cadastro. Erros do serviço mantêm o preenchimento para uma nova tentativa; a tela de confirmação só aparece após uma resposta de sucesso. Os testes simulam esses retornos, sem enviar e-mails reais.

Se a confirmação abrir **localhost**, ajuste os dois campos acima e peça um novo link em **Cadastro / entrar → Reenviar confirmação**, informando apenas o e-mail. Use a mensagem mais recente: links antigos podem manter o destino anterior, já ter sido usados ou estar expirados. Se você personalizou o template de confirmação em **Email Templates**, mantenha o link `{{ .ConfirmationURL }}`; ele faz a verificação antes de devolver o usuário ao app. Não o substitua por um link direto ao site.

O frontend de produção fixa o retorno em `VITE_APP_URL`, definido em `.env.production`. Esse valor não altera o **Site URL** nem a lista **Redirect URLs** do Supabase. Para trocar de domínio, atualize ambos os serviços e publique novamente. Veja [o guia de teste público](PUBLICAR-TESTE.md).

O cadastro pede e-mail, senha, nome e sexo em telas separadas. Depois, confirma o e-mail e entra no app para escolher o nick e o avatar. Para registrar um treino e iniciar uma ofensiva, precisa estar conectado à conta. Se o perfil local já existir, ele não é publicado automaticamente na conta.

Também há o botão **Continuar com Google**, para entrar ou criar uma conta usando a identidade Google. Sua ativação exige criar um cliente OAuth no Google Cloud e habilitar o provedor no Supabase; siga [LOGIN-GOOGLE.md](LOGIN-GOOGLE.md). O app pede apenas identidade, e-mail e perfil básico.

## 4. Conectar o app publicado no GitHub

**Este repositório já tem o projeto `qfzoeshhogoilsmvxlif` configurado em [`.env.production`](../.env.production), com a URL e a chave Publishable públicas fornecidas pelo proprietário.** Não é necessário cadastrar variáveis no GitHub para publicar usando esse projeto. Execute o workflow depois de preparar as tabelas e o cadastro. A presença da configuração não comprova que as tabelas já foram criadas ou que a conexão online foi validada.

Nas configurações de API do Supabase, encontre a **Project URL** e a chave **Publishable** (`sb_publishable_...`). A chave **anon** legada também é aceita, se o projeto ainda a utilizar.

Para substituir a configuração pública sem editar o arquivo, entre em **Settings → Secrets and variables → Actions → Variables** no GitHub e configure estas duas **Repository variables**, sempre juntas:

| Nome                            | Valor                               |
| ------------------------------- | ----------------------------------- |
| `VITE_SUPABASE_URL`             | Project URL do seu projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave Publishable do mesmo projeto  |

As duas são configuração pública do frontend: ficam no JavaScript publicado. **Nunca coloque senha do banco, chave Secret ou `service_role` em variáveis `VITE_` ou no código.** A segurança do acesso aos dados vem da autenticação e das políticas RLS, não de esconder a chave pública.

O workflow já lê essas variáveis. Atualizações de **main** testam e publicam automaticamente; também é possível usar **Actions → Publicar no GitHub Pages → Run workflow → main**. Salvar variáveis sem recompilar não atualiza o site. Para um domínio diferente, configure também a variável pública `VITE_APP_URL` com o endereço HTTPS completo, terminado em `/`.

Variáveis vazias no workflow deixam valer `.env.production`. Para publicar uma versão exclusivamente local, remova a URL e a chave desse arquivo e deixe as variáveis vazias. Uma chave privada usada por engano interrompe a compilação sem imprimir seu valor.

## 5. Testar na sua máquina

Para usar o projeto já configurado no desenvolvimento, copie `.env.production` para `.env.local`. Para outro projeto, copie `.env.example` e preencha as duas variáveis públicas. Não envie `.env.local` ao GitHub; ele já é ignorado pelo Git. Os testes unitários limpam essas configurações e usam clientes simulados, sem acessar o projeto real.

```sh
npm ci
npm run dev
```

Reinicie o servidor após alterar `.env.local`. No app, toque no avatar no canto superior direito → **Cadastro / entrar**. Crie a conta, confirme o e-mail, entre e salve seu perfil.

Para verificar a versão de produção e a PWA:

```sh
npm run build
npm run preview
```

## Validar o banco e a integração

```sh
npm test
bash scripts/test-profiles-db.sh
```

O segundo comando exige Docker. Ele cria um PostgreSQL 17 descartável, sem porta aberta ou acesso de rede, aplica as migrações com uma simulação de `auth.users`/`auth.uid()` e verifica isolamento entre contas, perfis, aceite dos convites, confirmação coletiva, perda da sequência e fila de push. O container é removido ao terminar. Nunca rode os arquivos de `supabase/tests/` no projeto real do Supabase.

Os testes do app simulam o cliente Supabase para verificar cadastro, leitura, gravação e troca de sessão. **Eles não enviam e-mails nem substituem um teste no projeto real.** Depois da configuração, valide com duas contas: uma não deve conseguir ler ou alterar o perfil da outra, inclusive pela API. Confirme também o fluxo de e-mail no endereço publicado e o login em outro dispositivo.

## Tabelas adicionais

`workout_days` guarda novos treinos com confirmação imutável do servidor. `friendships`, `streak_groups`, `group_members` e `group_days` cuidam dos convites e conclusões coletivas. `push_devices` e `push_jobs` guardam assinaturas privadas e a fila de envio. Todas têm RLS e não permitem leitura/escrita direta pelo navegador; funções autenticadas verificam quem pode executar cada ação. As funções administrativas de push só podem ser chamadas pelo servidor.

A migração [202610170004_weights_and_times.sql](../supabase/migrations/202610170004_weights_and_times.sql) adiciona `weight_logs` privado por conta, controle de revisões, marcadores de exclusão e horários online para a corrida diária nos grupos. Aplique-a depois de 001–003; ela pode ser executada novamente. Veja [PESO-E-HORARIOS.md](PESO-E-HORARIOS.md) para atualizar e recuperar seus pesos antigos. O card para redes sociais continua gerado no próprio aparelho.

## Preferência retirada do cadastro

A migração [202610170007_remove_state_preference.sql](../supabase/migrations/202610170007_remove_state_preference.sql) remove a preferência antiga de estado dos metadados das contas. Ela pode ser reaplicada e preserva todos os demais metadados, perfis, treinos e pesos. O app deixa de perguntar, enviar e consultar essa preferência, e usa as frases gerais com personalização por nome e sexo.

Depois da 008, aplique [202610170009_scheduled_rest_limit.sql](../supabase/migrations/202610170009_scheduled_rest_limit.sql) para limitar novos salvamentos a dois descansos programados por semana. Ela substitui apenas a RPC de salvamento, preservando as versões anteriores e o limite independente de descansos extras. Aplicada no projeto atual em 17/10/2026; a verificação em transação revertida confirmou o bloqueio e os hashes dos registros e programações existentes permaneceram idênticos.

Depois da 009, aplique [202610170010_coins_and_medical_kits.sql](../supabase/migrations/202610170010_coins_and_medical_kits.sql) para habilitar [moedas e Kit Médico](MOEDAS-E-KITS.md). A migração adiciona carteira, extrato, regras e inventário privados; recompensas apenas por novas inserções válidas e proteção somente do dia atual. Ela preserva registros existentes, sem distribuir moedas retroativas. Aplicada no projeto atual em 17/10/2026, com RPCs verificadas em rollback e integridade dos dados anteriores confirmada.

Depois da 010, aplique [202610170011_immutable_weight_entries.sql](../supabase/migrations/202610170011_immutable_weight_entries.sql) para permitir [várias pesagens imutáveis no mesmo dia](PESO-E-HORARIOS.md). A cópia para `weight_entries` preserva valores e horários conhecidos, sem recompensas retroativas; a tabela antiga permanece intacta e seu endpoint deixa de aceitar alterações. Aplicada no projeto atual em 17/10/2026, com integridade dos dados anteriores confirmada.


## Estado das atualizações: reagendamentos e consulta de e-mail

As migrações **012 e 013 estão aplicadas em produção**, após autorização, no projeto `qfzoeshhogoilsmvxlif`, em **17/10/2026**. A consulta de e-mail da 013 é independente da 012: usa somente o Supabase Auth e não ativa os reagendamentos por si só.

1. [202610170012_training_reschedules.sql](../supabase/migrations/202610170012_training_reschedules.sql): cronograma de cinco treinos/dois descansos para novos salvamentos, tabela privada de trocas, cota de duas por semana, revisões/locks, snapshots da Arena e estado sincronizado. Não faz backfill. Programações antigas permanecem. Veja as regras e exceções de semanas parciais em [SEMANA-E-DESCANSOS.md](SEMANA-E-DESCANSOS.md).
2. [202610170013_account_email_lookup.sql](../supabase/migrations/202610170013_account_email_lookup.sql): RPC `account_email_exists(p_email)` para visitantes e contas autenticadas. Normaliza espaços/maiúsculas, valida a entrada e retorna somente `true`/`false`. Não disponibiliza dados de `auth.users`, não cria cadastro e não envia confirmação. A distinção de existência do endereço é intencional para o fluxo solicitado; a aplicação não recebe nome, identificador nem metadados dessa conta.

O botão “Entrar” abre diretamente o login, com e-mail e senha. A verificação ocorre após 500 ms sem digitação ou imediatamente ao tocar em Entrar/Continuar. Se o e-mail existir, mantém o login e a senha já digitada; um endereço novo abre o cadastro na etapa de senha, preservando o e-mail e sem tentar autenticar. É possível voltar para corrigir o endereço. No cadastro, uma conta existente retorna ao login e pede a senha novamente. Nenhuma consulta cria conta automaticamente. Respostas de um endereço anterior são ignoradas após a correção. Falhas mantêm a etapa com uma opção de tentar novamente. A consulta não substitui as validações finais do Supabase Auth: outro aparelho pode criar a conta entre a consulta e o cadastro. O tratamento de conta existente no envio final continua ativo.

A 013 foi verificada no banco real em uma transação `READ ONLY`, com execução sob os papéis `anon` e `authenticated`: e-mail existente, normalização de espaços/maiúsculas, endereço novo/inválido e bloqueio de acesso direto a `auth.users`. A API pública respondeu HTTP 200 com `false` para endereços fictícios/inválidos. As verificações não criaram contas, não enviaram e-mails e não alteraram registros de usuários.

O pipeline de main publica o frontend, mas não aplica migrações. Em outro projeto, aplique a 013 antes de publicar esse frontend; sem ela, a verificação exibirá erro e o acesso por e-mail/senha não avançará. O acesso com Google continua independente dessa consulta. SMTP/confirmação de e-mail e o provedor Google mantêm suas configurações anteriores; a consulta não resolve um provedor de envio ainda não configurado. Nenhum secret adicional é necessário no navegador.


## Atualizações 014 e 015

A [014](../supabase/migrations/202610170014_unique_immutable_nicknames.sql) torna o nick único (sem diferença entre maiúsculas e formas Unicode NFKC) e imutável, preservando perfis existentes. Adiciona sugestões privadas por RPC e o resolvedor de login exclusivo de `service_role`, com cota compartilhada entre instâncias. Se houver nicks legados conflitantes, aborta sem renomeá-los.

A [015](../supabase/migrations/202610170015_friend_requests_by_nickname.sql) depende da 014 e permite encontrar alguém pelo nick completo e enviar pedidos usando as regras atuais de aceite e de convite da Arena. A consulta retorna apenas ID, nick e relação com o próprio solicitante, sem e-mail ou peso.

As migrações **012, 014 e 015 foram autorizadas e aplicadas em produção em 17/10/2026**, em uma transação única. A aplicação comparou hashes e quantidades de todas as tabelas públicas existentes e de `auth.users`; os registros ficaram idênticos, assim como as classificações anteriores do cronograma. Depois, uma transação `READ ONLY` confirmou RLS, permissões, estado do cronograma, disponibilidade do próprio nick e privacidade da busca de amigos, sem criar contas ou registros de teste.

Essas três versões foram registradas em `supabase_migrations.schema_migrations`. As versões anteriores haviam sido aplicadas manualmente e não constavam desse histórico; confira a estrutura real antes de usar `supabase db push` em um projeto já existente. Não execute todas as migrações antigas novamente para preencher o histórico.

O login por nick também exige a Edge Function `login-with-nickname`; o estado da publicação e os detalhes estão em [NICKS-E-AMIZADES.md](NICKS-E-AMIZADES.md). A 013 permanece aplicada e a 012 é independente destas atualizações.

## Atualização 016: kits mensais

A [016](../supabase/migrations/202610170016_monthly_medical_kits.sql) oferece dois Kits Médicos gratuitos por mês civil da conta, sem acúmulo, e compra extra por 250 unidades do saldo. O saldo passa a aparecer como potes de proteína, sem conversão ou mudança de recompensas. O uso depende do estoque e não tem mais cota semanal.

Compras, saldo, proteções e histórico anteriores são preservados. Itens gratuitos têm origem/mês/posição únicos; os expirados permanecem no banco, mas ficam indisponíveis. A concessão é idempotente e serializada entre aparelhos, acontece somente no mês corrente e não gera moedas. A migração não concede itens durante sua aplicação. As RPCs atuais mantêm autenticação/RLS e o fuso fixado; novas informações mensais acompanham o estado da carteira. Detalhes em [MOEDAS-E-KITS.md](MOEDAS-E-KITS.md).

**Autorizada e aplicada em produção em 17/10/2026**, com registro da versão em `supabase_migrations.schema_migrations`. A transação comparou hashes/quantidades dos registros anteriores, preservou as recompensas e classificações de dias e confirmou que nenhum item foi concedido durante a aplicação. Uma verificação `READ ONLY` confirmou o contrato mensal, origem/duplicidade dos kits, RLS e permissões, sem criar registros de teste. Em outro projeto, aplique somente a 016 após as anteriores e publique o frontend correspondente; não reaplique migrações antigas para atualizar estas funções.
