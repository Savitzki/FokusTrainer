# FokusTrainer

Um app web em português para construir uma rotina de treinos, acompanhar o peso e manter uma ofensiva de dias ativos. Interface com foco no celular, visual flat em laranja intenso e carvão, sem mascote ou efeitos de relevo. Construído com React, TypeScript e Vite.

## Executar

Requer Node.js **22.12 ou superior** e npm. Ambiente validado com Node 24.

```sh
cd /workspace/FokusTrainer
npm ci
npm run dev -- --port 5173 --strictPort
```

Para outro computador, use o diretório em que você clonou o projeto. O servidor de desenvolvimento usa a porta 5173. Não há banco ou variável obrigatória para usar o perfil local. O cadastro com e-mail e senha é opcional e exige configurar o Supabase; veja o guia abaixo.

```sh
npm test       # testes de regras de negócio e fluxos da interface
npm run build # verificação TypeScript e compilação de produção em dist/
npm run preview -- --port 4173 --strictPort # validar a compilação localmente
```

## Cadastro e banco de dados

Veja o [guia de configuração do Supabase](docs/BANCO-DE-DADOS.md) para criar o banco e habilitar o cadastro. O [guia de amigos, grupos e push](docs/PUSH-E-GRUPOS.md) explica as migrações adicionais, as chaves e o agendador. Com o serviço configurado, perfil e novos treinos podem sincronizar; peso e lembretes locais ficam no dispositivo, separados por conta. Sem configuração externa, o perfil é local e não cria login.

O cadastro também oferece **Continuar com Google**, usando a mesma conta Google/Gmail para criar ou acessar o perfil. É necessário configurar o cliente OAuth no Google Cloud e habilitar o provedor no Supabase; veja [o passo a passo](docs/LOGIN-GOOGLE.md).

A compilação de produção já usa a URL e a chave Publishable públicas do projeto `qfzoeshhogoilsmvxlif`, em `.env.production`. O workflow lê esse arquivo quando as variáveis do GitHub estão vazias. As migrações precisam estar aplicadas no banco; configuração salva não significa conexão online validada. Para usar esse projeto também em desenvolvimento, copie `.env.production` para `.env.local`.

## O que está incluído

- Confirmação única do treino de hoje, com atividade e duração. A chama acende ao confirmar, e o registro fica permanente no app: sem edição ou exclusão e sem novos treinos na mesma data. Não é possível preencher dias passados ou futuros.
- Ofensiva de dias consecutivos e recorde. Antes de confirmar hoje, a sequência de ontem permanece válida até o fim do dia, mas a chama fica apagada. Se o dia terminar sem confirmação, a ofensiva zera na virada para o próximo dia; a próxima confirmação inicia em 1. O histórico e o recorde não são apagados. Registros antigos, inclusive múltiplos treinos em uma data de versões anteriores, são preservados e contam como um dia. Não há congelamento de ofensiva.
- Calendário da semana de segunda a domingo, dias ativos e tempo total em movimento.
- Perfil com nick, cinco estilos de avatar, seis cores e foto própria. As fotos são recortadas ao centro e reduzidas no dispositivo; selecione JPG, PNG ou WebP de até 5 MB.
- Card de ofensiva em PNG, Story 1080 × 1920 ou quadrado 1080 × 1080, com nick/avatar e mensagem editável de até 160 caracteres. Permite baixar, copiar a mensagem e abrir o compartilhamento nativo de arquivos, se suportado. Não publica automaticamente nem inclui os registros de peso. Com a sequência zerada, a opção de compartilhar fica bloqueada.
- Peso diário em kg, aceitando vírgula ou ponto e uma casa decimal. Um segundo registro na mesma data atualiza o anterior. Histórico completo e gráfico dos últimos 30 registros, com espaçamento proporcional às datas.
- Dois lembretes diários independentes, com horário configurável: treino e peso. São desativados por padrão. Ações já registradas no dia não geram lembrete. Um lembrete vencido é exibido na próxima verificação, no máximo uma vez por dia.
- Alertas dentro do app e notificações do navegador, quando autorizadas. Botão de teste após autorizar a permissão.
- Aba **Juntos** com código de amigo, pedidos aceitos pelo destinatário e grupos de 2 a 8 pessoas. O dia coletivo só é salvo quando todos confirmam online no mesmo dia do fuso do grupo. Um dia perdido zera a sequência coletiva; o recorde permanece. Exige as migrações sociais no Supabase.
- Grupos e amigos em abas próprias, cartões para selecionar o time, busca de amigos, compartilhamento do código e progresso visual das chamas. Formulários e instruções aparecem conforme a ação escolhida.
- Web Push opcional com o app fechado, tom leve ou dramático e até dois horários por dia/aparelho. Exige a Edge Function, chaves VAPID, cron no Supabase e autorização do celular. Instalar a PWA ou publicar no Pages não ativa esse serviço sozinho.

## Notificações e horário

O app usa a data e o horário **locais do dispositivo**. Verifica os lembretes a cada 15 segundos e quando a aba volta a ficar visível. Abas suspensas pelo navegador podem atrasar os avisos. Ativar um horário já passado permite avisar ainda no mesmo dia; alterar um horário após o aviso não dispara outro naquele dia.

Notificações do sistema dependem de permissão, suporte do navegador e um contexto seguro (**HTTPS** em produção; loopback é aceito no desenvolvimento). Um service worker exibe os avisos em navegadores compatíveis. Permissão bloqueada pode ser alterada nas configurações do navegador. Os alertas internos continuam funcionando sem essa permissão.

**Lembretes locais precisam do app aberto.** Para avisos com o app fechado, siga [a ativação do Web Push](docs/PUSH-E-GRUPOS.md). O servidor agenda pelo fuso salvo em cada aparelho, suprime avisos após o treino sincronizar e desativa assinaturas expiradas. O drama é opcional. Em iOS 16.4+, é necessário instalar na Tela de Início e abrir pelo ícone. A entrega depende da rede, do navegador e do sistema, sem garantia de horário exato.

## Instalar no celular (PWA)

Depois de publicar no GitHub Pages, abra o endereço **HTTPS** do app no celular:

- **Android / Chrome:** toque em **Instalar app**, abaixo dos lembretes, e confirme a instalação. Se o navegador ainda não oferecer a janela automática, use o menu **⋮ → Instalar app** ou **Adicionar à tela inicial**. Navegação anônima e navegadores internos de outros apps podem impedir a instalação.
- **iPhone / Safari:** toque em **Compartilhar → Adicionar à Tela de Início → Adicionar**. Se aparecer a opção **Abrir como App**, ative-a. O botão no app também mostra essas instruções.

O app instalado abre em janela própria, sem a barra de endereço. Após o primeiro acesso online e a preparação do cache, a interface, os registros de treino e peso e o histórico funcionam offline. O cache guarda somente os arquivos do aplicativo. Perfil e novos treinos podem sincronizar com a conta quando há internet; grupos exigem confirmação recebida no servidor dentro do dia. Não há garantia de que o Safari compartilhará os registros da aba com a versão instalada; prefira continuar usando a mesma versão.

A compilação gera o cache do service worker com a lista exata de arquivos e uma versão baseada no conteúdo. Para carregar uma atualização publicada, conecte-se à internet, abra o app e depois feche todas as abas/janelas do FokusTrainer e abra novamente. O novo cache só ativa após as janelas antigas fecharem; caches de outros apps da mesma origem não são removidos. Em desenvolvimento (`npm run dev`), o cache offline fica desativado. Teste a instalação e o offline com a compilação de produção servida por HTTPS ou loopback.

## Armazenamento

Sem login, os registros e o perfil ficam no `localStorage` desta origem, na chave `fokus-trainer:v1`. Com login, os registros locais de cada conta ficam em `fokus-trainer:v1:account:<id>`, separados dos registros sem login; entrar ou sair não apaga nenhum deles. Perfil e novos treinos podem sincronizar com o Supabase configurado. Histórico de dias passados não é importado para o servidor; pesos não são enviados. Limpar os dados do navegador apaga os registros locais. Mudar a origem abre outro armazenamento. Dados antigos sem o campo de perfil são carregados sem perder treinos ou pesos.

Dados malformados não são sobrescritos automaticamente: o app informa o erro e preserva o conteúdo para recuperação. Se o armazenamento estiver indisponível ou cheio, ele avisa que os dados não puderam ser salvos. Não use esta versão como único arquivo de longo prazo dos seus registros; exportação e backup são melhorias futuras.

## Estrutura

- `src/App.tsx`: painel, formulários, diálogos e agendamento enquanto o app está aberto.
- `src/model.ts`: tipos, validação, datas, ofensivas e regras dos lembretes.
- `src/profile.ts` e `src/ProfilePanel.tsx`: nick, avatar, foto e telas da conta.
- `src/account.ts` e `supabase/migrations/`: integração com Supabase Auth e tabela de perfis.
- `src/social.ts` e `src/SocialPanel.tsx`: confirmação online, amigos e grupos.
- `src/push.ts`, `src/PushPanel.tsx` e `supabase/functions/push-dispatch/`: inscrição por aparelho e envio agendado de Web Push.
- `src/SharePanel.tsx` e `src/sharing.ts`: geração e compartilhamento do card.
- `src/notifications.ts`: integração com notificações do navegador.
- `src/InstallApp.tsx`, `public/manifest.webmanifest` e `public/icons/`: instalação e ícones da PWA.
- `public/sw.js` e `scripts/build-sw.mjs`: cache offline e atualizações do aplicativo.
- `src/styles.css`: layout responsivo com prioridade para celular, navegação inferior, botões grandes e formulários como painéis inferiores no mobile.
- `src/*.test.*`: testes de ofensivas, confirmação diária, lembretes, peso, instalação e persistência.

Para publicar a aplicação, sirva o conteúdo de `dist/` em HTTPS, mantendo `sw.js` junto de `index.html` no diretório do app. O servidor Vite é destinado ao desenvolvimento.

## Hospedar no GitHub Pages

O projeto inclui `.github/workflows/pages.yml` para compilar, testar e publicar o app. A publicação é **manual**; enviar um commit não dispara uma nova publicação.

1. Abra o repositório `Savitzki/FokusTrainer` no GitHub.
2. Entre em **Settings → Pages**. Em **Build and deployment → Source**, selecione **GitHub Actions**. Se Pages não estiver disponível, confira suas permissões e o plano do repositório; o GitHub Free oferece Pages para repositórios públicos. Não é necessário mudar a visibilidade de um repositório privado sem avaliar essa decisão.
3. Vá a **Actions → Publicar no GitHub Pages → Run workflow**. Selecione a branch **main** e confirme em **Run workflow**. Se Actions estiver desativado, habilite-o para este repositório.
4. Aguarde os jobs **build** e **deploy** ficarem verdes. O GitHub exibirá o endereço publicado em **Settings → Pages** e no ambiente **github-pages** da execução. O endereço esperado, sem domínio personalizado, é `https://savitzki.github.io/FokusTrainer/`; ele só estará disponível após uma publicação bem-sucedida.
5. Para atualizar o site depois de novos commits, execute novamente esse workflow na branch main.

O Vite gera caminhos relativos e as notificações respeitam a subpasta `/FokusTrainer/`. O GitHub Pages hospeda apenas o frontend: o peso continua salvo no navegador; amigos, grupos e push dependem da configuração separada do Supabase. Publicar o ambiente do Codex é uma operação separada da publicação do site no GitHub Pages.
