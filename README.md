# FokusTrainer

Um app web em português para construir uma rotina de treinos, acompanhar o peso e manter uma ofensiva de dias ativos. Interface com foco no celular, visual flat em laranja intenso e carvão, sem mascote ou efeitos de relevo. Construído com React, TypeScript e Vite.

## Executar

Requer Node.js **22.12 ou superior** e npm. Ambiente validado com Node 24.

```sh
cd /workspace/FokusTrainer
npm ci
npm run dev -- --port 5173 --strictPort
```

Para outro computador, use o diretório em que você clonou o projeto. O servidor de desenvolvimento usa a porta 5173. Não há banco ou variável obrigatória para usar o perfil local. Os registros de treino e peso e a ofensiva exigem login; configure o Supabase para esse fluxo. Sem conta, o app abre em modo visitante para navegar; registrar peso abre cadastro/login; veja o guia abaixo.

```sh
npm test       # testes de regras de negócio e fluxos da interface
npm run build # verificação TypeScript e compilação de produção em dist/
npm run preview -- --port 4173 --strictPort # validar a compilação localmente
```

## Cadastro e banco de dados

[Nicks e amizades](docs/NICKS-E-AMIZADES.md): @nick único e imutável após salvar, sugestões para nomes ocupados, login por nick/senha e busca de amigos com aceite. Nome das frases e avatar seguem editáveis no perfil único, junto do e-mail e do botão de sair. Exige as migrações 014/015 e a Edge Function `login-with-nickname`, já aplicadas e ativas em produção desde 17/10/2026 (veja [Estado atual em produção](#estado-atual-em-produção)).

“Entrar” abre diretamente o login. Após digitar o e-mail, uma conta existente permanece no login; um endereço novo segue para o cadastro com o e-mail preservado. No cadastro, endereços já existentes retornam ao login. A consulta também ocorre antes de avançar ou autenticar. Exige a migração 013, aplicada no Supabase em 17/10/2026. O frontend com essa verificação já está publicado no GitHub Pages. A consulta retorna apenas um booleano e não envia e-mails.

Veja o [guia de configuração do Supabase](docs/BANCO-DE-DADOS.md) para criar o banco e habilitar o cadastro. O [guia de amigos, grupos e push](docs/PUSH-E-GRUPOS.md) explica as migrações adicionais, as chaves e o agendador. Com o serviço configurado e a migração 004 aplicada, perfil, novos treinos e pesos podem sincronizar; os lembretes locais ficam no dispositivo, separados por conta. Sem configuração externa, o perfil é local e não cria login.

O cadastro por e-mail pergunta **E-mail → Senha → Nome → Sexo**, uma informação por tela, com uma frase curta de incentivo e opção de voltar preservando o preenchimento. Não mostra contagem, barra de progresso ou cabeçalhos extras. A conta só é criada na última etapa. O modal acompanha a área visível do teclado com `VisualViewport` e `interactive-widget=resizes-content`, mantendo o campo acessível sem rolagem suave concorrendo com a abertura do teclado. Após o envio, há uma tela de confirmação por e-mail com acesso ao login e reenvio do link. Erros do acesso com Google aparecem logo abaixo do botão e recebem foco para ficarem visíveis.

No cadastro e no perfil há nome opcional e o campo **Sexo**, com **Masculino**, **Feminino** ou **Prefiro não informar**. Essa escolha adapta a linguagem das frases; os valores existentes em `user_metadata.display_name` e `phrase_treatment` são preservados, sem nova tabela. Algumas frases usam o primeiro nome (ou o início do nick); nomes longos usam a frase geral para manter uma linha. A escolha pode ser alterada no perfil.

A preferência por estado e a personalização regional foram removidas do cadastro, do perfil e das frases. A migração [007](supabase/migrations/202610170007_remove_state_preference.sql) remove apenas essa preferência antiga dos metadados do Supabase Auth, preservando nome, sexo e demais informações da conta.

Ao enviar o cadastro, contas existentes identificadas pelo Supabase passam para o login, mantendo o e-mail. Contas novas continuam no cadastro aguardando a confirmação.

E-mail e senha são validados em sua própria etapa. Recusas do Supabase identificam o motivo e, quando necessário, voltam ao campo correspondente, preservando as outras informações. Limites de envio e falhas do serviço não são apresentados como erro de preenchimento. O cadastro público depende de SMTP próprio para as confirmações; veja [configuração e diagnóstico de e-mail](docs/BANCO-DE-DADOS.md#se-novos-cadastros-falharem).

O cadastro também oferece **Continuar com Google**, usando a mesma conta Google/Gmail para criar ou acessar o perfil. É necessário configurar o cliente OAuth no Google Cloud e habilitar o provedor no Supabase; veja [o passo a passo](docs/LOGIN-GOOGLE.md).

A compilação de produção já usa a URL e a chave Publishable públicas do projeto `qfzoeshhogoilsmvxlif`, em `.env.production`. O workflow lê esse arquivo quando as variáveis do GitHub estão vazias. As migrações precisam estar aplicadas no banco; configuração salva não significa conexão online validada. Para usar esse projeto também em desenvolvimento, copie `.env.production` para `.env.local`.

### Estado atual em produção

Conferido em 17/10/2026 no projeto `qfzoeshhogoilsmvxlif`:

- **Migrações:** estrutura 001–022 instalada. O histórico oficial do Supabase registra 012 e 014–022; as demais versões foram aplicadas manualmente e não constam nele. Confira a estrutura real antes de usar `supabase db push` e não reaplique migrações antigas para preencher o histórico (detalhes em [BANCO-DE-DADOS.md](docs/BANCO-DE-DADOS.md)).
- **Edge Functions:** `login-with-nickname` está ativa (versão 1). `push-dispatch` e `group-notify` **não estão publicadas** e não há agendamento Cron, então o Web Push e os avisos de grupo com o app fechado continuam inativos. A ativação está em [PUSH-E-GRUPOS.md](docs/PUSH-E-GRUPOS.md).
- **Frontend:** publicado pelo GitHub Pages a cada atualização de **main**, após os testes.

## O que está incluído

**Expansão de gamificação:** [cinco etapas, regras, testes e ativação](docs/GAMIFICACAO.md). As migrações 017–021 acrescentam missões semanais, medalhas, relatórios privados, desafios com aceite e cosméticos na Loja. Foram autorizadas e **aplicadas em produção em 17/10/2026**, com preservação dos registros anteriores. A interface correspondente integra esta publicação; mantém os sistemas atuais e o foco em hábitos e consistência.

- Modo visitante para explorar as páginas. Registrar treino, registrar peso e iniciar uma ofensiva exigem cadastro/login; os botões de registro abrem diretamente o cadastro, com opção de entrar numa conta existente. Registros antigos sem conta ficam preservados para consulta e importação opcional após login; o visitante não pode alterá-los. Eles não são usados como ofensiva de uma conta.
- Confirmação única do treino de hoje, com atividade e duração. A chama acende ao confirmar, e o registro fica permanente no app: sem edição ou exclusão e sem novos treinos na mesma data. Não é possível preencher dias passados ou futuros.
- No **Início**, os atalhos **Descansar hoje** e **Usar kit** ficam abaixo de Registrar treino, apenas quando há um treino pendente que pode ser protegido. O uso do kit exige confirmação com as regras e o consumo do item; sem kits, o atalho abre a carteira.
- [Potes de proteína e Kit Médico](docs/MOEDAS-E-KITS.md): carteira por conta, treino +10 e primeiro peso válido do dia +2. Oferece 2 kits gratuitos por mês, sem acumular, e compra por 250 potes, sem cota semanal de uso. Saldo e compras anteriores preservados. A migração 016 foi autorizada e aplicada em 17/10/2026.
- [Semana personalizada e descansos](docs/SEMANA-E-DESCANSOS.md): configuração em **Treinos → Personalize sua semana**, acima do calendário, com exatamente 5 treinos e 2 descansos. Descanso válido mantém a ofensiva sem somar; falta sem proteção interrompe. Até 2 reagendamentos e 2 extras por semana, independentes dos kits. Alterações permanentes valem a partir do dia seguinte e preservam o histórico. As migrações 008–012 já estão aplicadas no projeto atual.
- No **Início**, o bloco **Sua semana** fica logo abaixo da chama e mostra **x/5**, porcentagem e treinos restantes. As [missões variadas](docs/MISSOES-VARIADAS.md), com a migração 022 já aplicada, oferecem até três metas por novo ciclo; ciclos antigos mantêm as metas já recebidas.
- Barra fixa na borda inferior, só com ícones, na ordem Início, Treinos, Arena, Peso, Loja e Configurações, com espaçamento adaptado a telas pequenas e balança de banheiro no Peso. Nomes acessíveis, endereços compartilháveis e suporte ao botão Voltar preservados. A Loja reúne saldo, kits e movimentações; o saldo no topo também abre essa página.
- Calendário mensal de segunda a domingo, consulta a meses anteriores, detalhes por dia e lista completa dos treinos do mês, com horário quando disponível.
- Perfil com avatar e nick em destaque, trajetória (treinos, ofensiva e recorde), dados da conta e três espaços para medalhas. **Editar perfil** reúne nome, sexo, avatar e foto; **Cancelar** descarta a edição local. O nick salvo continua imutável. Medalhas ficam em uma prévia compacta com **Gerenciar medalhas**; a privacidade dos destaques depende de consentimento. A loja e o botão de sair permanecem acessíveis. As fotos são recortadas ao centro e reduzidas no dispositivo; selecione JPG, PNG ou WebP de até 5 MB.
- Card de ofensiva em PNG, Story 1080 × 1920 ou quadrado 1080 × 1080, com nick/avatar e mensagem editável de até 160 caracteres. Permite baixar, copiar a mensagem e abrir o compartilhamento nativo de arquivos, se suportado. Não publica automaticamente nem inclui os registros de peso. Com a sequência zerada, a opção de compartilhar fica bloqueada.
- [Peso sincronizado entre aparelhos](docs/PESO-E-HORARIOS.md), privado por conta, com várias pesagens imutáveis por dia, horários individuais, recuperação de registros locais, importação opcional do histórico sem conta e fila offline. Exige a migração 011.
- Corrida diária dentro do grupo: posições e horários pela primeira confirmação online de cada participante com treino obrigatório. Empates compartilham a posição; membros em descanso válido ficam protegidos, sem colocação por treinos voluntários.
- Fogo centralizado e celebração breve somente após registrar um treino novo; animação desativada quando o aparelho pede movimento reduzido.
- Peso diário em kg, aceitando vírgula ou ponto e uma casa decimal. Um segundo registro na mesma data atualiza o anterior. Histórico completo e gráfico dos últimos 30 registros, com espaçamento proporcional às datas.
- Dois lembretes diários independentes, com horário configurável: treino e peso. São desativados por padrão. Ações já registradas no dia não geram lembrete. Um lembrete vencido é exibido na próxima verificação, no máximo uma vez por dia.
- Alertas dentro do app e notificações do navegador, quando autorizadas.
- Aba **Arena** com busca por @nick e pedidos aceitos pelo destinatário e grupos de 2 a 8 pessoas. Quem tem treino obrigatório precisa confirmar online no dia do grupo; descansos válidos protegem os demais. Se todos descansarem, a sequência se mantém sem somar. Uma falta sem proteção interrompe a sequência; o recorde permanece. Exige as migrações sociais e a migração 008 no Supabase.
- Grupos e amigos em abas próprias, cartões para selecionar o time, busca de amigos, compartilhamento do código e progresso visual das chamas. Formulários e instruções aparecem conforme a ação escolhida.
- [Aviso opcional ao grupo após o treino](docs/AVISOS-DO-GRUPO.md): escolha os grupos e confirme o envio, ou use **Agora não**. Recuperar histórico não abre a tela nem envia alertas. Exige a migração 005, funções de envio e push autorizado nos aparelhos dos destinatários.
- Web Push opcional com o app fechado, tom leve ou dramático e até dois horários por dia/aparelho. Exige a Edge Function, chaves VAPID, cron no Supabase e autorização do celular. Instalar a PWA ou publicar no Pages não ativa esse serviço sozinho.

## Notificações e horário

O app usa a data e o horário **locais do dispositivo**. Verifica os lembretes a cada 15 segundos e quando a aba volta a ficar visível. Abas suspensas pelo navegador podem atrasar os avisos. Ativar um horário já passado permite avisar ainda no mesmo dia; alterar um horário após o aviso não dispara outro naquele dia.

Notificações do sistema dependem de permissão, suporte do navegador e um contexto seguro (**HTTPS** em produção; loopback é aceito no desenvolvimento). Um service worker exibe os avisos em navegadores compatíveis. Permissão bloqueada pode ser alterada nas configurações do navegador. Os alertas internos continuam funcionando sem essa permissão.

**Lembretes locais precisam do app aberto.** Para avisos com o app fechado, siga [a ativação do Web Push](docs/PUSH-E-GRUPOS.md). O servidor agenda pelo fuso salvo em cada aparelho, suprime avisos após o treino sincronizar e desativa assinaturas expiradas. O drama é opcional. Em iOS 16.4+, é necessário instalar na Tela de Início e abrir pelo ícone. A entrega depende da rede, do navegador e do sistema, sem garantia de horário exato.

## Instalar no celular (PWA)

Depois de publicar no GitHub Pages, abra o endereço **HTTPS** do app no celular:

- **Android / Chrome:** abra a página **Configurações** e toque em **Instalar app**, abaixo dos lembretes, e confirme a instalação. Se o navegador ainda não oferecer a janela automática, use o menu **⋮ → Instalar app** ou **Adicionar à tela inicial**. Navegação anônima e navegadores internos de outros apps podem impedir a instalação.
- **iPhone / Safari:** toque em **Compartilhar → Adicionar à Tela de Início → Adicionar**. Se aparecer a opção **Abrir como App**, ative-a. O botão no app também mostra essas instruções.

O app instalado abre em janela própria (`standalone`), mantendo a navegação do sistema. As barras do sistema usam a cor do tema onde há suporte; o fundo da página também preenche as áreas de segurança do celular. O tema salvo é aplicado antes do primeiro desenho da página para reduzir flashes claros ao abrir no modo escuro. Após o primeiro acesso online e a preparação do cache, a interface, os registros de treino e peso e o histórico funcionam offline. O cache guarda somente os arquivos do aplicativo. Perfil, novos treinos e pesos podem sincronizar com a conta quando há internet; grupos exigem confirmação recebida no servidor dentro do dia. Não há garantia de que o Safari compartilhará os registros da aba com a versão instalada; prefira continuar usando a mesma versão.

O tema escolhido atualiza `theme-color`, `color-scheme`, o fundo de `html`/`body` e a configuração de instalação da PWA: `manifest.webmanifest` usa o fundo escuro `#121212`, e `manifest-light.webmanifest` usa o claro `#faf8f5`. O endereço anterior `manifest-dark.webmanifest` permanece disponível com as mesmas cores escuras para instalações existentes. Todos mantêm o mesmo ID, escopo e endereço inicial do app. Sem preferência salva, o padrão e os fallbacks são escuros; a escolha explícita de modo claro é preservada. O tema salvo seleciona a configuração antes do React carregar, e todos os manifestos ficam no cache offline. A navegação inferior aplica `safe-area-inset-bottom`, mantendo o fundo do tema até a borda da tela. A cor das barras de ações e gestos segue esses valores onde o navegador e o sistema permitem. O app não solicita tela cheia nem oferece um controle para ocultá-las. Uma instalação existente pode manter a cor anterior até o navegador atualizar a PWA e ela ser reaberta. A troca de cor da barra nativa não é garantida em tempo real; depende do Android, do navegador e do tipo de navegação (gestos ou três botões). Não apague os dados nem desinstale o app para tentar acelerar essa atualização.

Os manifestos são atualizados pela rede quando há conexão, mantendo a última versão válida offline. Veja [como conferir e atualizar a instalação Android sem apagar dados](docs/TEMA-ANDROID-PWA.md) se a barra estiver correta na aba do Chrome e diferente no PWA instalado.

A compilação gera o cache do service worker com a lista exata de arquivos e uma versão baseada no conteúdo. Para carregar uma atualização publicada, conecte-se à internet, abra o app e depois feche todas as abas/janelas do FokusTrainer e abra novamente. O novo cache só ativa após as janelas antigas fecharem; caches de outros apps da mesma origem não são removidos. Em desenvolvimento (`npm run dev`), o cache offline fica desativado. Teste a instalação e o offline com a compilação de produção servida por HTTPS ou loopback.

## Armazenamento

Sem login, o perfil e eventuais registros antigos ficam no `localStorage` desta origem, na chave `fokus-trainer:v1`. Com login, os registros locais de cada conta ficam em `fokus-trainer:v1:account:<id>`, separados dos registros sem login. Ao sair, o app remove os dados locais da conta atual, a fila de pesos já concluída e os dados do modo sem conta, evitando que um perfil antigo apareça depois do logout. O tema e o cache de arquivos do app são mantidos. Pesos pendentes ou em conflito precisam ser sincronizados/resolvidos antes da saída para não serem perdidos. Perfil, novos treinos e pesos podem sincronizar com o Supabase atualizado. Treinos de dias passados não são importados para o servidor. Pesos anteriores associados à conta são enviados ao atualizar; pesos sem login têm importação opcional. Pesagens offline ficam em uma fila por conta, com identificador por registro e reenvio sem duplicar. Valores salvos não podem ser alterados; conflitos de identificador nunca sobrescrevem o registro confirmado. Limpar os dados do navegador apaga os registros locais. Mudar a origem abre outro armazenamento. Dados antigos sem o campo de perfil são carregados sem perder treinos ou pesos.

O aviso para completar nick e avatar só aparece após uma consulta bem-sucedida confirmar a ausência do perfil. Durante carregamento ou falha de consulta, o app aguarda ou oferece nova tentativa.

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

O projeto inclui `.github/workflows/pages.yml` para compilar, testar e publicar o app. Cada atualização de **main** dispara a publicação, após os testes passarem. Também é possível publicar manualmente.

1. Abra o repositório `Savitzki/FokusTrainer` no GitHub.
2. Entre em **Settings → Pages**. Em **Build and deployment → Source**, selecione **GitHub Actions**. Se Pages não estiver disponível, confira suas permissões e o plano do repositório; o GitHub Free oferece Pages para repositórios públicos. Não é necessário mudar a visibilidade de um repositório privado sem avaliar essa decisão.
3. Envie as alterações para **main**, ou vá a **Actions → Publicar no GitHub Pages → Run workflow**, selecione **main** e confirme. Se Actions estiver desativado, habilite-o para este repositório.
4. Aguarde os jobs **build** e **deploy** ficarem verdes. O GitHub exibirá o endereço publicado em **Settings → Pages** e no ambiente **github-pages** da execução. O endereço esperado, sem domínio personalizado, é `https://savitzki.github.io/FokusTrainer/`; ele só estará disponível após uma publicação bem-sucedida.
5. Novos commits em **main** publicam as atualizações automaticamente.

Para abrir os testes a outras pessoas e corrigir links de confirmação que levam a localhost, siga [PUBLICAR-TESTE.md](docs/PUBLICAR-TESTE.md). A URL pública de retorno é definida em `VITE_APP_URL`; o Supabase também precisa autorizar esse endereço. O cartão da ofensiva destaca 50 provocações diretas sobre atitude/compromisso, mais 12 respostas depois do registro, com personalização pelo nome. As frases ficam em uma linha, são escolhidas a cada visita e renovadas na virada do dia, sem alternar durante o preenchimento.

Configurações fica na ordem **Notificações → Aparência → Sobre o app → Instalação**, com títulos simples, sem cartões separando as seções ou blocos de status de autorização/push indisponível. Os controles de Push aparecem quando o serviço, o perfil e o aparelho estão prontos. O switch **Modo escuro** alterna a aparência imediatamente e salva a escolha neste aparelho, inclusive sem cadastro e offline. O modo inicial é escuro; a preferência é compartilhada entre as contas usadas no mesmo navegador.

Ao salvar o primeiro perfil completo da conta, o app convida a permitir notificações, com **Ativar notificações** ou **Agora não**. A permissão nativa é solicitada somente pelo toque em Ativar. Não repete em logins/edições posteriores, ignora permissões já concedidas ou bloqueadas e aguarda o salvamento bem-sucedido de nick, avatar e preferências. O mesmo fluxo atende contas por e-mail e Google. Permitir notificações não configura sozinho o serviço de Web Push.

O Vite gera caminhos relativos e as notificações respeitam a subpasta `/FokusTrainer/`. O GitHub Pages hospeda apenas o frontend: a sincronização de peso, amigos, grupos e push dependem da configuração separada do Supabase. Publicar o ambiente do Codex é uma operação separada da publicação do site no GitHub Pages.
