# Nick permanente, login e amizades

O **@nick** identifica a conta e aparece na Arena. O **nome** usado nas frases é uma preferência editável; pessoas diferentes podem ter o mesmo nome. Avatar, foto, nome e sexo continuam editáveis no perfil.

## Regras do nick

- De 3 a 24 letras/números, incluindo ponto, hífen e sublinhado; sem espaços.
- `@` inicial e espaços externos são retirados no primeiro salvamento. A normalização Unicode NFKC trata caracteres equivalentes da mesma forma.
- A comparação ignora maiúsculas/minúsculas. `Dani` e `dani` não podem pertencer a contas diferentes. Acentos não são retirados.
- Depois de salvo, o nick inteiro é imutável, inclusive sua capitalização. O campo fica somente para leitura; o banco também bloqueia UPDATE e upsert que tentem alterá-lo.
- Nicks atuais são preservados e passam a seguir a imutabilidade. Se houver conflito legado, a migração aborta sem renomear pessoas ou deixar alterações parciais. A conferência somente de leitura no projeto atual encontrou zero conflitos.
- Ao escolher um nick ocupado, aparecem até três sugestões disponíveis. Elas não são reservas; o índice único decide o vencedor se dois aparelhos tentarem salvar o mesmo nick simultaneamente.
- Perfis locais de visitantes não reservam identificadores globais. A disponibilidade só é consultada depois do login e a escolha é concluída no perfil.

A migração [014](../supabase/migrations/202610170014_unique_immutable_nicknames.sql) adiciona índice único, trigger de identidade e RPC `check_nickname`. As políticas de perfil continuam permitindo consultar/editar somente o próprio perfil. Não há atualização de treinos, pesos, carteiras ou grupos.

## Entrar com e-mail ou @nick

O formulário de login aceita e-mail ou nick, com ou sem `@`. Um e-mail sem conta segue para o cadastro. Um nick usa a senha da conta e permanece no login em caso de credenciais inválidas. O cadastro e o reenvio de confirmação continuam exigindo **e-mail**.

A Edge Function `login-with-nickname` resolve o e-mail internamente e pede ao Supabase Auth para verificar a senha. Apenas os tokens de uma autenticação válida são enviados ao SDK, que conserva a sessão e o logout existentes. O resolvedor SQL `begin_nickname_login` pode ser executado somente pelo papel `service_role`; visitantes e usuários autenticados não recebem o e-mail de outra pessoa. A função não registra senhas, tokens, corpos de requisições ou erros brutos em logs.

O servidor limita cada nick normalizado a **10 tentativas por janela de 15 minutos**, de forma atômica entre instâncias/aparelhos. O relógio do cliente não interfere. As chaves dos contadores são hashes, e janelas antigas são removidas gradualmente. A mesma limitação vale para nicks inexistentes. Depois de atingir a cota, é possível continuar usando o login por e-mail. Contas criadas somente com Google continuam usando Google, a menos que também tenham uma senha definida no Supabase Auth.

## Amigos por nick e Arena

Em **Arena → Amigos → Adicionar amigo**, digite o nick completo e toque em **Buscar**. O resultado mostra somente identificador, nick e a relação dessa pessoa com você. Toque em **Enviar pedido**; pesquisar por si só não envia convites. O destinatário aceita na lista de pedidos recebidos ou pelo resultado de sua própria busca.

A migração [015](../supabase/migrations/202610170015_friend_requests_by_nickname.sql) exige a 014 e adiciona `find_friend_by_nickname` e `send_friend_request_by_nickname`. A busca é exata, sem diferenciar maiúsculas e equivalências NFKC. Ela exige login e perfil. Não expõe e-mail, peso, avatar privado ou relações entre terceiros. Nicks inexistentes, o próprio nick, pedidos já enviados e amizades aceitas têm estados distintos na interface.

Os pedidos usam a tabela e as regras de consentimento existentes: uma única relação por par, sem autoaceite e sem permitir que o remetente aceite seu pedido. Pedidos repetidos não duplicam amizades. Apenas amizades aceitas podem ser convidadas para uma Arena; o convite da Arena também exige aceite. O fluxo antigo de códigos continua disponível em **Usar código de amigo**, preservando convites e compartilhamentos existentes. Não foi adicionado push de pedidos de amizade.

## Navegação e perfil

A hotbar fica em **Início → Treinos → Peso → Arena → Configurações**. Configurações reúne aparência, Sobre o app, programação semanal, lembretes, Web Push e instalação. O calendário mantém um atalho **Sua semana**. Os links antigos `#/avisos`, `#reminders` e `#/juntos` continuam abrindo as telas correspondentes. Preferências e registros mantêm suas chaves de armazenamento.

O avatar abre um perfil único, sem abas de conta ou engrenagem: e-mail, @nick, nome, sexo, avatar/foto, salvar e sair. O logout reutiliza as verificações e a limpeza do cache por conta; pesos ainda pendentes de sincronização continuam protegidos.

## Estado e ativação

Em **17/10/2026**, após autorização explícita, as migrações **012, 014 e 015 foram aplicadas em produção** no projeto `qfzoeshhogoilsmvxlif`, em uma transação única. A 013 já estava aplicada. As três novas versões foram registradas no histórico de migrações.

A Edge Function **`login-with-nickname` está publicada e ativa**, versão 1, com `verify_jwt=false`. Foi publicada pela API administrativa oficial do Supabase. As variáveis padrão da plataforma são usadas somente dentro da função; nenhuma chave administrativa foi adicionada ao frontend.

A publicação do frontend em `main`, pelo GitHub Pages, foi autorizada explicitamente em **17/10/2026**. O banco e a função já estão ativos. Em outro projeto, prepare o banco e a função antes de publicar:

1. Aplicar a 012 após a 011 para habilitar reagendamentos; aplicar a 013 para a consulta de e-mail e a 014 antes da 015 para nicks/amizades. Não executar fixtures de `supabase/tests/` no projeto real.
2. Publicar a Edge Function:

   ```bash
   supabase functions deploy login-with-nickname --project-ref qfzoeshhogoilsmvxlif --no-verify-jwt
   ```

   `verify_jwt=false` permite abrir a sessão sem já estar autenticado. A senha continua sendo validada pelo Supabase Auth. São usadas as variáveis padrão da plataforma `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY`. Nenhuma chave administrativa vai para o frontend. Não é necessário um serviço externo novo.
3. Publicar o frontend. O pipeline de main publica o site, mas não aplica SQL nem publica Edge Functions.
4. Conferir os fluxos com contas próprias destinadas a testes. E-mail/senha, confirmação e Google mantêm suas exigências anteriores de configuração. Sem a Edge Function, o app orienta a entrar pelo e-mail; sem as migrações de nicks, a escolha/busca mostra que falta ativar o recurso.

## Verificação local

```bash
npm test
npm run build
bash scripts/test-profiles-db.sh
# Deno instalado: tipos e teste ponta a ponta com Auth/SQL simulados locais
# --node-modules-dir=none mantém o cache de Deno separado das dependências do app
deno check --no-config --node-modules-dir=none --no-lock supabase/functions/login-with-nickname/index.ts supabase/functions/login-with-nickname/index.test.ts
deno test --no-config --node-modules-dir=none --no-lock --allow-net=127.0.0.1 --allow-env=SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,SUPABASE_ANON_KEY supabase/functions/login-with-nickname/index.test.ts
```

A suíte SQL usa PostgreSQL descartável, incluindo disputa de nicks, preservação de perfis legados, rate limit simultâneo, sugestões, imutabilidade, privacidade, pedidos/aceites e consentimento da Arena. O teste Deno usa somente chaves fictícias e serviços locais; não cria contas nem autentica usuários reais.

Validação desta alteração:

- `npm test`: 245 testes passaram em 35 arquivos.
- `npm run build` e `git diff --check`: passaram.
- Suíte SQL completa: passou, incluindo as migrações 014/015 reaplicadas, preservação de nicks legados e operações concorrentes.
- Deno: verificação de tipos e um teste HTTP da Edge Function com Auth/resolvedor simulados passaram; outros 14 testes de seu núcleo fazem parte da suíte do app.
- Navegador Chromium local: fluxos de proteção, nicks, configurações, pedidos/aceites e logout passaram nos temas claro/escuro em 320 px; a tela inicial também foi conferida em 390 px.

A aplicação em produção conferiu hashes e quantidades de todas as tabelas públicas existentes e de `auth.users`, sem alterar registros, além de preservar as classificações anteriores dos dias no cronograma. Uma transação `READ ONLY` posterior confirmou RLS, grants, contrato do estado, disponibilidade do próprio nick e privacidade da busca de amigos. A função pública foi verificada com OPTIONS, GET e uma entrada inválida, sem autenticar usuários ou consumir a cota de tentativas.

Não foram realizados cadastro, login por nick nem alteração de amizades com contas reais em produção. Os testes de gravação, concorrência e senha permaneceram no ambiente descartável/simulado; nenhuma conta de teste ou registro de atividade foi criado no projeto real.
