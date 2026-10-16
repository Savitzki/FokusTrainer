# FokusTrainer

Um app web em português para construir uma rotina de treinos, acompanhar o peso e manter uma ofensiva de dias ativos. Interface responsiva em React, TypeScript e Vite.

## Executar

Requer Node.js **22.12 ou superior** e npm. Ambiente validado com Node 24.

```sh
cd /workspace/FokusTrainer
npm ci
npm run dev -- --port 5173 --strictPort
```

Para outro computador, use o diretório em que você clonou o projeto. O servidor de desenvolvimento usa a porta 5173. Não há banco de dados, chave de API ou variável de ambiente obrigatória.

```sh
npm test       # testes de regras de negócio e fluxos da interface
npm run build # verificação TypeScript e compilação de produção em dist/
npm run preview -- --port 4173 --strictPort # validar a compilação localmente
```

## O que está incluído

- Registro de treinos com data, atividade e duração; exclusão com confirmação.
- Ofensiva de dias consecutivos e recorde. Vários treinos na mesma data contam como um dia. Antes de treinar hoje, a ofensiva de ontem permanece válida; um dia inteiro sem registro interrompe a sequência. Não há congelamento de ofensiva nesta versão.
- Calendário da semana de segunda a domingo, dias ativos e tempo total em movimento.
- Peso diário em kg, aceitando vírgula ou ponto e uma casa decimal. Um segundo registro na mesma data atualiza o anterior. Histórico completo e gráfico dos últimos 30 registros, com espaçamento proporcional às datas.
- Dois lembretes diários independentes, com horário configurável: treino e peso. São desativados por padrão. Ações já registradas no dia não geram lembrete. Um lembrete vencido é exibido na próxima verificação, no máximo uma vez por dia.
- Alertas dentro do app e notificações do navegador, quando autorizadas. Botão de teste após autorizar a permissão.

## Notificações e horário

O app usa a data e o horário **locais do dispositivo**. Verifica os lembretes a cada 15 segundos e quando a aba volta a ficar visível. Abas suspensas pelo navegador podem atrasar os avisos. Ativar um horário já passado permite avisar ainda no mesmo dia; alterar um horário após o aviso não dispara outro naquele dia.

Notificações do sistema dependem de permissão, suporte do navegador e um contexto seguro (**HTTPS** em produção; loopback é aceito no desenvolvimento). Um service worker exibe os avisos em navegadores compatíveis. Permissão bloqueada pode ser alterada nas configurações do navegador. Os alertas internos continuam funcionando sem essa permissão.

**O app precisa permanecer aberto para agendar avisos nesta versão.** O service worker não agenda notificações sozinho. Avisos confiáveis com o app fechado exigem uma etapa futura: backend com agendador, assinaturas Web Push por dispositivo, autenticação e tratamento de fuso horário. Notificações em iOS têm requisitos próprios, como instalação na tela inicial; essa versão não oferece instalação PWA.

## Armazenamento

Os registros ficam somente no `localStorage` deste navegador e origem, na chave `fokus-trainer:v1`. Não há cadastro, sincronização, análise externa ou envio dos dados de peso para um servidor. Limpar os dados do navegador apaga os registros. Mudar o endereço ou a porta abre outro armazenamento.

Dados malformados não são sobrescritos automaticamente: o app informa o erro e preserva o conteúdo para recuperação. Se o armazenamento estiver indisponível ou cheio, ele avisa que os dados não puderam ser salvos. Não use esta versão como único arquivo de longo prazo dos seus registros; exportação e backup são melhorias futuras.

## Estrutura

- `src/App.tsx`: painel, formulários, diálogos e agendamento enquanto o app está aberto.
- `src/model.ts`: tipos, validação, datas, ofensivas e regras dos lembretes.
- `src/notifications.ts` e `public/sw.js`: integração com notificações do navegador.
- `src/styles.css`: layout responsivo, com navegação inferior no celular.
- `src/*.test.*`: testes de ofensivas, lembretes, registros, exclusão e persistência.

Para publicar a aplicação, sirva o conteúdo de `dist/` em HTTPS, mantendo `sw.js` junto de `index.html` no diretório do app. O servidor Vite é destinado ao desenvolvimento.

## Hospedar no GitHub Pages

O projeto inclui `.github/workflows/pages.yml` para compilar, testar e publicar o app. A publicação é **manual**; enviar um commit não dispara uma nova publicação.

1. Abra o repositório `Savitzki/FokusTrainer` no GitHub.
2. Entre em **Settings → Pages**. Em **Build and deployment → Source**, selecione **GitHub Actions**. Se Pages não estiver disponível, confira suas permissões e o plano do repositório; o GitHub Free oferece Pages para repositórios públicos. Não é necessário mudar a visibilidade de um repositório privado sem avaliar essa decisão.
3. Vá a **Actions → Publicar no GitHub Pages → Run workflow**. Selecione a branch **main** e confirme em **Run workflow**. Se Actions estiver desativado, habilite-o para este repositório.
4. Aguarde os jobs **build** e **deploy** ficarem verdes. O GitHub exibirá o endereço publicado em **Settings → Pages** e no ambiente **github-pages** da execução. O endereço esperado, sem domínio personalizado, é `https://savitzki.github.io/FokusTrainer/`; ele só estará disponível após uma publicação bem-sucedida.
5. Para atualizar o site depois de novos commits, execute novamente esse workflow na branch main.

O Vite gera caminhos relativos e as notificações respeitam a subpasta `/FokusTrainer/`. O GitHub Pages hospeda apenas o frontend: o peso continua salvo no navegador de cada dispositivo e os lembretes ainda exigem o app aberto. Publicar o ambiente do Codex é uma operação separada da publicação do site no GitHub Pages.
