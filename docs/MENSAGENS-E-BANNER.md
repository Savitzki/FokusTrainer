# Mensagens e banner da Capibora

## Escopo e auditoria

A implementação adapta **80 apresentações editoriais**: as 70 falas existentes, com os mesmos IDs, mais 10 mensagens auxiliares antes dispersas (visitante, perfil, primeiro plano, risco, estados vazios, confirmação de provocação e registro). As auxiliares não são inseridas nos pools de sorteio existentes.

Foram examinados `App`, `homeDayPresentation`, `useCapiboraVoice`, `motivation`, `capiboraVoice`, o contrato compartilhado `supabase/functions/_shared/capibora.ts`, cadastro, registro manual, preferências de frases, compartilhamentos, lembretes, consentimento, conquistas, resultados e recebimento de provocações. Os 34 títulos/corpos de notificações já estruturados e os 13 IDs do catálogo social foram revisados e preservados, assim como os nomes e descrições das 28 conquistas.

Não foram alterados arquivos do Supabase, SQL, autenticação, horários, permissões, regras de treino, seleção, recompensas ou resultados. Não há migração, deploy de função ou configuração administrativa a executar.

## Estrutura e compatibilidade

- `src/capiboraEditorial.json`: título, complemento e pose de cada apresentação, indexados por ID estável.
- `src/capiboraVoice.ts`: fachada existente enriquecida para a interface. `selectCapiboraPhrase` delega a escolha ao seletor compartilhado e retorna a apresentação do mesmo ID. Metadados, ordem, condições, intensidade e `text` legado permanecem intactos.
- `CapiboraMessage`: apresentação reutilizável `hero`, `inline` ou `centered`, sem decisões de negócio ou ações embutidas. Imagem decorativa e carregamento prioritário somente no banner; demais ilustrações lazy.
- `composeCapiboraMessage`: preserva título e complemento em canais que aceitam uma string, incluindo feedbacks e compartilhamento.
- Personalização: nome validado no complemento, com a frequência e o tratamento existentes. O título curto não cresce com nomes longos. O hook de variedade/não repetição não foi alterado.
- Perguntas manuais: texto funcional, IDs, escolha de duas perguntas, confirmação final e contrato de respostas continuam iguais. Apenas a apresentação ganha um título curto.
- Push: mesmo catálogo, seleção, título/corpo e payload. Sem notificações novas.
- Provocações recebidas: nenhum corte, composição automática ou reescrita da mensagem gravada. Apenas a fala adicional da confirmação de envio foi adaptada.
- Consentimentos, erros e avisos de segurança permanecem explícitos. Conquistas mantêm seus nomes oficiais.

O hash do contrato compartilhado continua `b1a87b3af7fb033f17c5ae3c8bcf275b3fc63e5136916d3eacd6ea21af9ba392`.

## Banner do Início

Título maior e complemento imediatamente abaixo, à esquerda; ilustração contextual inteira, à direita; ação principal em uma linha independente, abaixo. Sem alturas fixas para o texto ou truncamento. O título varia de 24 a 36 px em tamanho padrão; o complemento usa 14 px. A imagem ocupa de 90 a 160 px conforme a largura disponível.

A ação continua usando o fluxo existente, incluindo plano inicial, registro manual, sessão ativa e treino já concluído. O pulso de quem ainda não tem plano e a preferência de movimento reduzido foram preservados. Treino voluntário informa que não acrescenta pontos; tipos de proteção e reagendamento continuam identificados pelo estado real.

A fala de risco usa somente a sugestão existente, já validada após atualização dos dados. Não há novo cálculo de risco, alerta ou uso automático de kit nesta alteração.

## Exemplos de revisão

| ID | Antes | Título | Complemento |
| --- | --- | --- | --- |
| `pending-what` | Tá esperando o quê? | **Tá esperando?** | O treino tá no plano, criatura... |
| `pending-today` | Vai treinar ou não? | **Vai hoje?** | Quero ver vc cumprir o combinado... |
| `done-miracle` | Ki Milagre... treinou | **Milagre, treinou** | Até que enfim apareceu esse registro KKKKK |
| `rest-allowed` | Hoje pode | **Hoje pode** | Descanso no plano, ofensiva protegida |
| `unplanned-first` | Primeiro, seu plano | **Quase lá!** | Já está quase tudo pronto... escolha seus dias de treino |
| `registration-greeting` | Acho bom mesmo... Na próxima, não demore tanto | **Acho bom mesmo...** | Na próxima, não demore tanto |

## Artes oficiais

Os 10 PNGs de `public/mascot/` são RGBA de 1254 × 1254 px, com transparência e hashes distintos; não foram encontradas duplicatas byte a byte. Os originais foram preservados. Margens transparentes das cópias de entrega são removidas pelo pipeline existente, sem redesenhar a mascote.

| Original | Entrega WebP | Dimensões da entrega | Uso |
| --- | --- | --- | --- |
| `capi-sosa.png` | 26.3 KiB | 640 × 478 | Estado vazio dos grupos, via componente existente |
| `chill.png` | 15.9 KiB | 320 × 265 | Descanso, proteção e reagendamento |
| `deboa.png` | 11.5 KiB | 320 × 268 | **Antes sem uso; agora `smug`**: deboche, descanso e registro |
| `determinado.png` | 18.8 KiB | 320 × 260 | Treino ativo e incentivo |
| `empolgada.png` | 13.2 KiB | 320 × 264 | **Antes sem uso; agora `excited`**: treino, conquista e primeiro plano |
| `feliz.png` | 17.8 KiB | 320 × 265 | Treino confirmado e registro de peso |
| `julgando.png` | 16.6 KiB | 320 × 257 | Julgando, suspeita e perguntas; aliases `suspicious`/`impatient` compatíveis |
| `neutro.png` | 16.1 KiB | 320 × 260 | Neutro, cadastro, retorno, acompanhamento |
| `tedio.png` | 11.8 KiB | 320 × 271 | **Antes sem uso; agora `bored`**: espera, risco e duração |
| `wink.png` | 18.5 KiB | 320 × 260 | Celebração e resultado existente |

As três novas cópias somam 37.3 KB (36.4 KiB), contra aproximadamente 2.33 MB dos três originais. Regeneração: `node scripts/prepare-web-images.mjs --mascot` (ImageMagick 7). Sem dependências novas de runtime. O cache offline existente inclui as cópias WebP.

Não existem artes específicas para `tired` e `running`, nem arquivos animados: continuam sem imagem, com fallback silencioso. Nenhum asset existente ficou sem utilização após a revisão. `impatient` permanece como alias compatível, especialmente nas mensagens sociais recebidas. A arte de equipe em `public/images/capi-group.png` continua no componente de grupos, sem alteração. Não foram criadas imagens ou poses fictícias.

## Capturas reais

As capturas usam Chromium, dados sintéticos e interceptação integral do Supabase, sem acesso a contas reais. A comparação anterior usa a versão publicada; a posterior usa a compilação local desta alteração.

| Estado | Claro | Escuro |
| --- | --- | --- |
| Antes, 390 px | [Abrir](capibora-messages/before-light-390.png) | [Abrir](capibora-messages/before-dark-390.png) |
| Depois, 390 px | [Abrir](capibora-messages/pending-light-390.png) | [Abrir](capibora-messages/pending-dark-390.png) |
| Treino voluntário, 320 px | [Abrir](capibora-messages/voluntary-light-320.png) | [Abrir](capibora-messages/voluntary-dark-320.png) |
| Registro, 320 px | [Abrir](capibora-messages/registration-light-320.png) | [Abrir](capibora-messages/registration-dark-320.png) |
| Pergunta manual, 320 px | [Abrir](capibora-messages/question-light-320.png) | [Abrir](capibora-messages/question-dark-320.png) |

As imagens foram abertas para inspeção visual, além das medições automatizadas. As capturas são de navegador, não de aparelhos físicos.

## Validações

- `npm test`: **854 testes Vitest, 88 arquivos, e 5 testes de assets offline aprovados**.
- `npm run build`: aprovado; inclui TypeScript estrito e build do service worker. Shell offline: 56 arquivos, 2.16 MiB.
- Testes editoriais: todos os 70 IDs e metadados preservados; 80 apresentações com título/complemento/pose válidos; composição, personalização, seleção e não repetição; contratos de push intactos; perguntas manuais e mínimo de 35 minutos; caminhos oficiais e fallback.
- Regressão da Home: título/complemento separados, botão preservado, descanso, treino voluntário, proteções, reagendamento, horário e plano inicial. Fala de risco apenas após a verificação existente, com exclusões de descanso, treino feito, sessão ativa, ausência de saldo/benefício, data obsoleta ou falha de atualização.
- Chromium: 320, 375, 390, 430, 768 e 1280 px; ambos os temas; título maior que corpo, limite de duas linhas em fonte normal, nenhuma sobreposição com imagem/ação, nenhuma rolagem horizontal e frase preservada na navegação. Estados: pendente, concluído, descanso, voluntário, Kit Médico, descanso extra, reagendamento, sessão ativa, retorno e primeiro plano.
- Modais: registro e perguntas nos dois temas em 320, 390 e 430 px; aviso abaixo de 35 minutos, bloqueio, correção e cancelamento sem confirmar treino.
- Fonte ampliada a 200% em 320 px, movimento reduzido e abertura do primeiro plano. Fonte ampliada permite maior altura para não cortar conteúdo.
- Sem novos erros de console nos cenários concluídos. Nenhuma operação real de treino, push, compra ou banco foi executada.
- `git diff --check`: aprovado. Não existe script de lint no projeto; TypeScript faz parte do build.

## Limitações e implantação

Não houve validação em Android/iPhone físico nem teste de entrega de Web Push no sistema operacional. Preferências, permissão e entrega de push não foram modificadas. Contextos declarados que já não tinham ponto de exibição próprio continuam disponíveis no catálogo, sem inventar eventos, notificações ou desbloqueios para exibi-los.

Não há necessidade de alteração no Supabase. A implantação depende somente da publicação normal do frontend/PWA; esta revisão não altera o ícone nem a tela de abertura. A atualização do service worker segue o fluxo existente. A publicação desta alteração ainda não foi executada.

## Arquivos alterados

- Dados e seleção de apresentação: `src/capiboraEditorial.json`, `src/capiboraVoice.ts`, `src/motivation.ts`, `src/homeDayPresentation.ts`, `src/sharing.ts`.
- Componente e estilos: `src/CapiboraMessage.tsx`, `src/capiboraMessage.css`, `src/styles.css`.
- Pontos de exibição: `src/App.tsx`, `src/AccountForm.tsx`, `src/WorkoutRegistration.tsx`, `src/ManualWorkoutInterrogation.tsx`, `src/NotificationOptIn.tsx`, `src/EntryNotices.tsx`, `src/GuestExperience.tsx`, `src/ArenaFriends.tsx`, `src/ArenaGroupBanner.tsx`, `src/ArenaTauntButton.tsx`.
- Assets: `src/mascotAssets.ts`, `public/mascot/web/{deboa,empolgada,tedio}.webp`, `public/mascot/README.md`, `scripts/prepare-web-images.mjs`.
- Testes: `src/capiboraEditorial.test.tsx`, `src/App.home.test.tsx`, `src/App.home-protection.test.tsx`, `src/App.test.tsx`, `src/App.training-plan.test.tsx`, `src/GuestExperience.test.tsx`, `src/SocialPanel.test.tsx`, `src/manualConfirmation.test.tsx`, `src/motivation.test.ts`, `src/navigation.test.tsx`, `scripts/offline-assets.test.mjs`.
- Entrega: este relatório e as dez capturas em `docs/capibora-messages/` (documentação; não integram o app).

## Índice completo das 70 falas existentes

| ID preservado | Contexto | Título | Complemento | Pose |
| --- | --- | --- | --- | --- |
| `pending-what` | `pending` | Tá esperando? | O treino tá no plano, criatura... | `judging` |
| `pending-today` | `pending` | Vai hoje? | Quero ver vc cumprir o combinado... | `suspicious` |
| `pending-sloth` | `pending` | Bora, preguiça... | Hoje tem treino, bicho | `smug` |
| `pending-doubt` | `pending` | Duvidoooooo... | Quero ver vc aparecer pra treinar | `smug` |
| `pending-see` | `pending` | Quero só ver... | Combinado é combinado, hein? | `suspicious` |
| `pending-not-going` | `pending` | Vai treinar não???? | Ainda tô esperando esse treino | `bored` |
| `pending-go` | `pending` | ANDA, CRIATURA | Bora treinar, sem enrolar... | `training` |
| `pending-invitation` | `pending` | Precisa de convite? | Pois tá convidado pro treino | `smug` |
| `done-paid` | `completed` | Tá pago | Treino registrado, pode respirar | `happy` |
| `done-miracle` | `completed` | Milagre, treinou | Até que enfim apareceu esse registro KKKKK | `excited` |
| `done-minimum` | `completed` | Fez o mínimo, né? | Mas fez, e o treino tá registrado | `smug` |
| `done-late` | `completed` | Demorou, hein | Seu treino já tá na conta | `happy` |
| `done-noted` | `completed` | Olha quem treinou | Registro confirmado, sem discussão | `happy` |
| `done-respect` | `completed` | Aí eu respeito | Treino confirmado, agora sim | `celebrating` |
| `done-today` | `completed` | Hoje foi | Mais um treino registrado | `happy` |
| `done-finally` | `completed` | Até que enfim | Treino registrado, já tava na hora | `excited` |
| `done-good` | `completed` | Boa, hein | O treino de hoje tá registrado | `excited` |
| `done-thought` | `completed` | Achei que não ia | Mas o treino entrou na conta | `smug` |
| `rest-allowed` | `rest` | Hoje pode | Descanso no plano, ofensiva protegida | `resting` |
| `rest-rest` | `rest` | Vai descansar | A pausa de hoje faz parte do combinado | `resting` |
| `rest-free` | `rest` | Tá liberado | Hoje o plano é descansar | `smug` |
| `protected-rest` | `protected` | Hoje é pausa | Dia protegido, sem ponto extra na ofensiva | `resting` |
| `return-hello` | `returning` | Olha quem apareceu | Bora retomar, um treino de cada vez | `neutral` |
| `return-back` | `returning` | Bora de novo | Seu próximo treino pode ser hoje | `happy` |
| `unplanned-first` | `unplanned` | Quase lá! | Já está quase tudo pronto... escolha seus dias de treino | `judging` |
| `active-keep` | `active` | Já começou, boa | O contador tá rodando, pode seguir seu treino | `training` |
| `voluntary-done` | `voluntary` | Foi de extra? | Treino registrado no descanso, sem pontos extras | `excited` |
| `rescheduled-pause` | `rescheduled` | Hoje ficou livre | Seu treino foi pra outra data | `resting` |
| `notification-invite` | `notification-opt-in` | Deixa que eu lembro | Do treino e das novidades dos seus grupos | `judging` |
| `signup-email` | `signup` | Olha quem apareceu | Começa pelo e-mail, sem complicar | `neutral` |
| `signup-password` | `signup` | Guarda essa senha | Depois não vem dizer que esqueceu, hein | `suspicious` |
| `signup-name` | `signup` | Como eu te chamo? | Me conta o nome que vc usa por aqui | `neutral` |
| `signup-ready` | `signup` | Falta pouco | Termina o cadastro, sem sumir agora | `smug` |
| `manual-question-real` | `manual-question` | Foi treino mesmo? | Esse treino aconteceu mesmo? | `suspicious` |
| `manual-question-happened` | `manual-question` | Fora da imaginação? | Treinou fora da sua imaginação? | `suspicious` |
| `manual-question-earned` | `manual-question` | Tempo de treino? | Esse tempo foi de treino mesmo? | `judging` |
| `manual-question-honest` | `manual-question` | Manda a real | Tá falando a verdade sobre o treino? | `suspicious` |
| `manual-question-witness` | `manual-question` | Tem testemunha? | Quem viu confirmaria esse treino? | `judging` |
| `manual-question-truth` | `manual-question` | Sem inventar, hein | Confirma esse treino sem inventar? | `suspicious` |
| `manual-question-effort` | `manual-question` | Foi pra valer? | Você dedicou esse tempo a treinar? | `judging` |
| `manual-question-not-invented` | `manual-question` | Garante mesmo? | Você garante que o treino foi real? | `suspicious` |
| `manual-question-outside-head` | `manual-question` | Aconteceu mesmo? | Esse treino existiu de verdade? | `judging` |
| `manual-question-flame` | `manual-question` | Confirma aí | Você confirma que esse treino aconteceu? | `suspicious` |
| `registration-greeting` | `registration` | Acho bom mesmo... | Na próxima, não demore tanto | `smug` |
| `manual-duration-short` | `manual-duration` | Cê tá de sacanagem? | Confere essa duração aí | `bored` |
| `manual-think` | `manual-aside` | Pensa bem | Esse registro precisa ser de um treino real | `suspicious` |
| `manual-know` | `manual-aside` | Só vc sabe | Confirma só o que aconteceu de verdade | `judging` |
| `manual-sure` | `manual-aside` | Tá certo disso? | Sem inventar treino, combinado? | `suspicious` |
| `manual-believe` | `manual-ack` | Vou acreditar | O registro ainda depende da confirmação | `smug` |
| `manual-i-see` | `manual-ack` | Sei... | Ainda tem a confirmação do treino | `smug` |
| `manual-okay` | `manual-ack` | Aham | Confere tudo antes de confirmar | `suspicious` |
| `manual-honest` | `manual-declined` | Honestidade, gostei | Treino não registrado, pode revisar | `neutral` |
| `share-paid` | `share` | Tá pago | Sem discurso, só o treino na conta | `happy` |
| `share-moved` | `share` | Me mexi, e vc? | Mais um treino pra compartilhar | `smug` |
| `share-again` | `share` | Mais um na conta | Treino registrado, tá aí a prova | `happy` |
| `shop-bought` | `shop-purchased` | Bom gosto, hein | Compra confirmada, item no inventário | `smug` |
| `arena-behind` | `arena-behind` | Te passaram | A disputa mudou, olha a classificação | `judging` |
| `push-gentle` | `push-gentle` | Hoje tem treino | Seu treino de hoje está no plano | `neutral` |
| `push-dramatic` | `push-dramatic` | Vai hoje ou não? | O treino de hoje ainda tá pendente | `bored` |
| `weight-noted` | `weight-logged` | Anotado | Seu registro de peso foi salvo | `happy` |
| `weight-saved` | `weight-logged` | Tá registrado | Peso salvo, sem mistério | `happy` |
| `weight-another` | `weight-logged` | Mais um registro | Seu acompanhamento tá atualizado | `neutral` |
| `weight-ready` | `weight-logged` | Pronto | Registro de peso confirmado | `neutral` |
| `weight-remembered` | `weight-logged` | Até que lembrou | Peso registrado, pode conferir | `smug` |
| `achievement-got` | `achievement-unlocked` | Tá podendo, hein | Nova conquista confirmada | `celebrating` |
| `achievement-more` | `achievement-unlocked` | MAIS UMAAAAA | Tem conquista nova na sua coleção | `excited` |
| `reward-new` | `reward-unlocked` | EITA! | Recompensa confirmada, pode conferir | `excited` |
| `rest-finally` | `rest` | Finalmenteeeee | Hoje é descanso, eu apoio | `resting` |
| `rest-us` | `rest` | Hoje é nosso dia | O plano liberou a pausa | `smug` |
| `rest-neither` | `rest` | Nem eu vou | Hoje é descanso, tá tudo certo | `resting` |

## Mensagens auxiliares centralizadas

| ID | Título | Complemento | Pose |
| --- | --- | --- | --- |
| `guest-intro` | Duvido que vc comece | Organize seus treinos e mantenha sua rotina | `judging` |
| `profile-complete` | Nova mensagem: Capibora | Complete se perfil, me diga como devo te chamar | `judging` |
| `plan-ready` | Agora sim! | Agora você já pode treinar à vontade! | `excited` |
| `protection-risk` | OPA, PERA AÍ! | Vai deixar sua ofensiva morrer assim mesmo? | `bored` |
| `friends-empty` | Quem treina junto? | Busque pelo @nick e envie um pedido | `neutral` |
| `group-empty` | Vai sozinho? | Crie seu grupo ou entre no dos seus amigos | `neutral` |
| `taunt-confirm` | Deixa comigo... | Eu escolho a provocação, vc segura a resposta KKKKK | `smug` |
| `manual-final` | Confirma o treino? | Você confirma que realmente treinou por pelo menos 35 minutos? | `judging` |
| `registration-timed` | Iniciar treino | Bota pra contar e vai treinar | `training` |
| `registration-manual` | Registrar manualmente | Já treinou? Registra aqui, só não vale mentir, hein? | `suspicious` |
