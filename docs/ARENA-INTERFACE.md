# Arena

A Arena reúne **Grupos**, **Amigos** e **Desafios** na navegação existente. O redesign gamificado é exclusivamente de apresentação: não exige SQL, alterações de RPC, RLS, Edge Functions, agendamentos ou regras de negócio.

## Composição

- **Grupos:** uma equipe em destaque com ofensiva, integrantes e meta semanal fornecida pelo servidor. As demais ficam em linhas compactas. A seleção permanece em memória; ao sair de uma equipe indisponível, a primeira equipe ativa e aceita é utilizada como alternativa. Convites ficam separados, com aceite e recusa visíveis. Sem equipes, permanece a arte oficial e a chamada de criação existente.
- **Detalhes da equipe:** painel com Voltar, ofensiva/recorde, meta semanal independente, histórico, integrantes e situação diária. Reutiliza `GroupWeeklyGoal`, `ArenaGroupTools`, `rankGroupMembers` e `GroupReactions`. Gerenciamento mantém permissões, confirmações e limite atual de cinco vagas; grupos antigos maiores continuam visíveis. Descansos protegidos e reagendamentos não são apresentados como faltas.
- **Amigos:** elenco compacto com foto/avatar e moldura reais, acesso à ficha, provocação rápida e opções secundárias. Pedidos recebidos e enviados, código de amizade, busca e criação de grupo permanecem disponíveis.
- **Ficha do rival:** painel de leitura com Voltar. Reutiliza `get_friend_showcase`, `ProfileCover`, `Avatar` e `AchievementMedal`; destaca Desafiar e Provocar, mantendo criação de grupo e remoção no menu secundário. Só mostra medalhas compartilhadas e dados autorizados pelo servidor.
- **Desafios:** filtros Ativos, Convites e Histórico. Competições com dois participantes usam confronto VS; cooperativos usam missão com meta compartilhada. Disputas com mais participantes mantêm apresentação de equipe/classificação, sem forçar um duelo. Dados ausentes não viram pontuações fictícias.
- **Criação:** Modalidade → Regras → Participantes/revisão. Os campos permanecem montados e o rascunho sobrevive à troca de abas. O envio ocorre apenas na confirmação final. Desafios rápidos e revanches pré-selecionam os dados e exigem revisão. A versão atual mantém 7/14/28 dias; clientes do contrato antigo mantêm 7/30 dias. Políticas de registro e argumentos de criação permanecem iguais.
- **Resultados:** vitória, EMPATE e cancelamento têm apresentações distintas. A classificação vem do servidor. Cancelamento não recebe pódio, vencedor ou celebração. Revanche e compartilhamento mantêm a elegibilidade anterior e exigem ação do usuário.

A Capibora aparece nos estados vazios, provocações e resultados especiais, usando exclusivamente as artes oficiais já disponíveis. Não foram criadas frases, ilustrações, bibliotecas ou notificações novas. Os estilos ficam em `arena.css`, limitados a `.social-panel`, com cores do tema e movimento discreto desabilitado por `prefers-reduced-motion`.

## Componentes e contratos

`SocialPanel` mantém o estado geral, formulários sociais e navegação; `ArenaGroups`, `ArenaFriends`, `ArenaChallengePreview` e `ArenaChallengeWizard` separam a apresentação. Os hooks `useSocial`, `useGameResource` e `useSyncedResource` continuam responsáveis por consulta, deduplicação, autorização, invalidação e operações. Não há hooks paralelos nem consultas por linha da lista de amigos.

`FriendProfile` aceita apresentação em painel na Arena e mantém o modal como padrão para os outros usos. O perfil privado de terceiros continua apenas em memória, sem cache persistente. Remover amizade ou perder autorização retira os dados. E-mail, peso, carteira e preferências privadas não são incluídos.

`navigation.ts` continua sendo o único mecanismo de navegação. Os destinos existentes aceitam detalhes opcionais:

- `#/arena?aba=groups&grupo=<id>`
- `#/arena?aba=friends&amigo=<id>`
- `#/arena?aba=challenges`

Voltar utiliza o histórico existente; recarregar restaura a aba e o detalhe autorizado. IDs desconhecidos não exibem dados de outra conta. A troca de conta recria o estado da Arena. Visitantes continuam sem acesso às páginas privadas. As rotas de notificações existentes permanecem válidas.

Contagens das abas usam somente pedidos/convites conhecidos. Desafios continuam sendo carregados na primeira visita, sem uma consulta extra apenas para obter o indicador.

## Dependências preservadas e lacunas reais

- A listagem social não fornece medalhas compartilhadas por amigo. Elas aparecem na ficha, usando a consulta privada existente; não foi criada uma consulta para cada linha.
- A integração de preferências de provocações nas Configurações não existe nesta branch. O acesso foi centralizado no ícone de preferências do cabeçalho da Arena, fora da ficha do rival, preservando silenciamento e autorização de revides por push. Mover esse acesso para Configurações depende de uma alteração posterior fora deste escopo.
- `ArenaInbox`, recebimento/revide/dispensa de provocações e catálogo aprovado permanecem intactos.
- Regras e resultados de desafios antigos, limite de participantes, ofensivas, metas congeladas, economia, conquistas e autenticação não foram modificados.

## Validação

```sh
npm test
npm run build
```

Os testes de interface e navegação cobrem abas/teclado, retorno, detalhes por URL, convites, rascunhos, argumentos das RPCs, permissões administrativas, metas, descanso, perfil privado, empate, cancelamento e revanche. Há uma regressão específica para impedir envio automático ao passar de Regras para a revisão de um desafio rápido.

O projeto não possui script de lint. Testes SQL não são necessários para esta revisão visual e não devem ser executados em produção.

A validação real de navegador usa Chromium com APIs do Supabase simuladas e assets reais. Não equivale a operações em contas reais, instalação de PWA ou teste em aparelhos físicos Android/iPhone. Larguras, temas, capturas e resultados efetivamente verificados são registrados na entrega/PR.

## Referências de implantação anteriores

As migrações existentes **036** (perfil privado do amigo), **037** (avisos e revide único) e **038** (cinco vagas) foram aplicadas em 20/10/2026 com autorização explícita, antes deste redesign. Os registros de publicação estão nas PRs [#33](https://github.com/Savitzki/capibora/pull/33), [#34](https://github.com/Savitzki/capibora/pull/34) e [#37](https://github.com/Savitzki/capibora/pull/37). Esta revisão não altera esses arquivos nem exige reaplicação.

As artes oficiais originais permanecem em `public/images/capi-group.png` e `public/mascot/`; cópias web otimizadas seguem o mecanismo existente de imagens e cache offline. Não foram adicionados assets nesta revisão.

### Verificação do redesign gamificado

A revisão executou a suíte completa e o build, além de Chromium em **320, 375, 390, 768 e 1280 px**, nos dois temas. Foram verificadas as três abas, grupo destacado/alternativo, convites, fotos e molduras, painel de equipe com recarga por URL e Voltar, ficha do rival, rascunho rápido, VS/cooperativo, histórico, empate e cancelamento. Cenários adicionais cobriram ausência de grupos, grupo antigo com oito integrantes e descanso coletivo em 320 px.

Nos dois temas, uma segunda passagem verificou histórico de metas, abertura e cancelamento das confirmações administrativas, convite único, abas por teclado, banner equipado real, envio de provocação aprovada, confirmação de remoção sem executar a exclusão, resultado consolidado e revanche com um único envio. Trocar abas não repetiu a consulta de desafios. Não houve rolagem horizontal ou erros de página/console nesses cenários. As capturas são do aplicativo renderizado, com dados sintéticos interceptados no navegador, sem contas reais.

A revisão visual identificou e corrigiu o contraste da aba ativa no tema claro, causado por um seletor legado. O navegador também identificou o reaproveitamento do botão Continuar como submit durante a transição de etapa; os controles agora são distintos e a revisão não envia convites. Nenhuma dessas correções altera os contratos do servidor.

Resultado local: **802 testes Vitest em 84 arquivos**, **quatro testes de arquivos/cache offline** e `npm run build` aprovados. O build mantém o carregamento por chunks e o cache offline existente (53 arquivos, aproximadamente 2,11 MiB), sem dependências novas.
