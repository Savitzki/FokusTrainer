# Não treinei hoje — implementação e validação

## Resultado

O Início ganhou a ação **Não treinei hoje**, à esquerda de **Registrar treino**. A ação secundária usa texto menor, sem fundo laranja ou animação; a principal mantém seu destaque, ícone, pulso quando aplicável e fluxo original. Ambas têm área de toque de pelo menos 44 px e compartilham a linha nas larguras verificadas.

A ação abre um único modal, sobre o Início, com título **EU CONFIEI EM VC...**, complemento **Tudo bem, vai... ainda dá pra resolver isso.**, ilustração oficial e opções reais para aquele dia. O fechamento pelo X não cria treino, falta ou proteção. Escape e toque no fundo não confirmam nem encerram o fluxo. O X permanece visível ao rolar; fica indisponível apenas durante uma confirmação em andamento.

## Auditoria e regras preservadas

Foram examinados `App`, `homeDayPresentation`, `Mascot`, `mascotAssets`, `Modal`, `TrainingScheduleSettings`, `WorkoutCalendar`, `RescheduleTraining`, `MedicalKitConfirmation`, `AutomaticKitNotice`, `useTrainingPlan`, `useEconomy`, `useWorkoutSession`, `training`, `workoutRecording`, `sync` e `useSyncedResource`, além das migrações e testes relevantes.

| Recurso atual | Fonte e comportamento mantidos |
| --- | --- |
| Obrigação, descanso e compensação | `trainingDayKind`, plano efetivo e dados de `get_training_state`; sem nova classificação no cliente |
| Plano de 1–7 dias | Versões e vigência existentes; `hasTrainingPlan` e `planFor` apenas controlam a apresentação |
| Reagendamento | `rescheduleTargets`, `reschedulesRemaining` e `reschedule_training`: descanso posterior na mesma semana, limite, revisão e proteção de resultados consolidados |
| Descanso extra | Cota atual retornada pelo servidor e operação `authorize_extra_rest`, acessível pelo calendário e sugestão contextual já existentes |
| Kit manual | `use_medical_kit`: somente data elegível, confirmação, estoque, prioridade de gratuitos e idempotência por conta/data |
| Kit automático | `medical_auto_close_account` e processamento de viradas existentes; mantidos os dois gratuitos por mês e preço padrão de 350, sem editar configurações |
| Fechamento | Meia-noite no fuso fixado da conta, pelo servidor; sem fechamento antecipado ou flag local de falta |
| Ofensiva | Confirmações e proteções existentes; nenhuma atribuição direta de pontos, recorde ou continuidade no cliente |
| Grupos e desafios | `group_days`, `arena_group_cycles`, `gf_day`/`gf_days` e contratos de pontuação permanecem intactos; invalidação de caches segue `notifySyncWrite` já existente |
| Offline e contas | `useSyncedResource` continua rejeitando mutações offline e resultados de outra conta; não há nova fila ou persistência de ausência |

Não foram modificados arquivos do Supabase, migrações, RPCs, RLS, Auth, notificações, recompensas, preços ou regras de confirmação.

## Visibilidade e relógio

`canOpenMissedWorkout`, em `homeDayPresentation.ts`, é exclusivamente um critério de visibilidade. Exige autenticação, controlador habilitado, plano já efetivo, treino obrigatório pendente e recuperação do estado de registro. Respeita a classificação existente, inclusive treino compensatório obrigatório.

A opção não aparece em descanso programado/extra, proteção com kit, dia reagendado, treino confirmado, sessão ativa, registro manual local ainda pendente, ausência de plano ou dados incompatíveis. Uma confirmação já reconhecida no controlador também impede oferecer a opção antes da atualização social.

A data vem do servidor e do fuso da conta; o instante de `serverNow` usa a âncora monotônica existente do controlador. Alterar o relógio do aparelho não reabre uma data. O clique revalida esse instante; ao abrir, o modal atualiza planejamento, carteira, confirmações e sessão usando os mesmos controladores.

A visita a esta tela dispensa somente a sugestão opcional de proteção daquela data, na sessão atual, para evitar outro modal redundante após 23h. Isso não modifica preferências de notificação nem uso automático de kits.

A data do modal fica fixada durante o fluxo. Se o dia virar ou outro aparelho confirmar/proteger o treino, as ações ficam indisponíveis e aparece uma informação de estado atualizado. Uma confirmação antiga nunca muda silenciosamente para a data nova. O servidor mantém a validação final de prazo e elegibilidade.

Abrir/fechar o modal não chama RPC de falta, confirmação de treino, uso de kit ou descanso. As leituras de atualização continuam respeitando o processamento de fechamentos atrasados já existente no servidor; isso não é um novo registro de falta ou consumo manual criado pela interface.

## Opções e transições

- **Usar Kit Médico:** mostra estoque e consumo de uma unidade. Reutiliza `MedicalKitConfirmation`, incluindo aviso irreversível e confirmação. Chama `economy.useKit` com a data fixa do modal; não desconta estoque ou atribui pontos localmente. Só apresenta **UFA... / Dessa vez passou** após resposta confirmada. Sem estoque, apresenta indisponibilidade e acesso à Loja em `secao=kits`, sem comprar automaticamente.
- **Reagendar treino:** reutiliza `RescheduleTraining` e as datas/validações existentes. Explica indisponibilidade quando não há data, cota ou suporte. Nenhuma troca é enviada antes de escolher a data e confirmar. O componente agora trata falha de leitura sem abrir opções do cache, indica consulta em andamento e bloqueia confirmações repetidas. O retorno de sucesso é preservado mesmo quando a atualização do plano muda a elegibilidade do cartão. A reação **Tá bom... / Vou cobrar depois** depende da confirmação do servidor.
- **Preciso de uma pausa:** apresentação explicativa, sem botão de ativar, proteção ou contador fictício. Havendo descanso extra disponível, o link **Ver descansos extras em Treinos** navega ao calendário existente. Não converte descanso extra em pausa prolongada nem cria outra operação.
- **Aceitar a falta de hoje:** abre confirmação informativa, explica possível interrupção após 00:00 e deixa explícito que kits elegíveis continuam com uso automático. **Confirmar e fechar** apenas fecha e informa que nenhuma falta foi registrada. Não cria treino, não muda a ofensiva, não consome kit e não desativa proteção automática. O usuário ainda pode mudar de ideia e registrar treino enquanto as regras normais permitirem.

As etapas substituem o conteúdo do mesmo modal, sem empilhamento. O foco é direcionado ao título das etapas seguintes e retorna à ação de origem ao fechar, quando ela continua disponível. O modal nativo mantém o conteúdo de fundo indisponível para interação por teclado.

## Mascote e mensagens

As quatro apresentações novas ficam no catálogo editorial existente, sem entrar no pool de alternância da Home e sem mudar IDs ou textos das frases anteriores:

| ID | Título | Complemento | Expressão |
| --- | --- | --- | --- |
| `missed-workout` | EU CONFIEI EM VC... | Tudo bem, vai... ainda dá pra resolver isso. | `dramatic`, alias temporário de julgando |
| `missed-kit-saved` | UFA... | Dessa vez passou | `happy` |
| `missed-rescheduled` | Tá bom... | Vou cobrar depois | `judging` |
| `missed-accept` | EU NÃO ACREDITO... | O fechamento do dia continua valendo | `dramatic`, alias temporário de julgando |

O ponto final do novo complemento principal foi preservado conforme o texto fornecido neste pedido; as outras falas mantêm a convenção editorial anterior. Não foram alterados títulos/corpos de Web Push ou provocações recebidas.

**Asset pendente:** arte oficial flat 2D da Capibora fingindo estar caída/morta de forma cartunesca ou chorando exageradamente, sem realismo ou conteúdo gráfico. A entrega usa realmente `public/mascot/web/julgando.webp`; não carrega imagem inexistente nem desenho improvisado. A chave `dramatic` está pronta para trocar apenas o mapeamento em `mascotAssets.ts` quando a arte chegar. PNG/WebP transparente pode ser enviado em [public/mascot](https://github.com/Savitzki/capibora/upload/main/public/mascot). Não foi gerada imagem ou animação nova.

## Arquivos alterados

| Área | Arquivos |
| --- | --- |
| Início e integração | `src/App.tsx`, `src/homeDayPresentation.ts` |
| Modal e estilos novos | `src/MissedWorkout.tsx`, `src/missedWorkout.css` |
| Fluxo reutilizado | `src/RescheduleTraining.tsx` |
| Mensagens e expressão | `src/capiboraEditorial.json`, `src/capiboraVoice.ts`, `src/mascotAssets.ts`, `public/mascot/README.md` |
| Testes | `src/homeMissedWorkout.test.ts`, `src/App.missed-workout.test.tsx`, `src/RescheduleTraining.test.tsx`, `src/capiboraEditorial.test.tsx` |
| Documentação | Este relatório, capturas em `docs/nao-treinei-hoje/` e [proposta separada de Pausa de rotina](PROPOSTA-PAUSA-DE-ROTINA.md) |

## Testes executados

- **`npm test`: 897 testes Vitest em 90 arquivos e 5 testes de assets offline aprovados.**
- **`npm run build`: aprovado**, incluindo TypeScript e service worker; shell offline de 56 arquivos, 2.18 MiB.
- `bash scripts/test-gamification-db.sh`: aprovado em PostgreSQL descartável, sem rede. Inclui confirmação manual/cronometrada, planos flexíveis, missões, recompensas, kits automáticos, fuso, idempotência e concorrência entre dispositivos/processamento de fechamento.
- `bash scripts/test-profiles-db.sh`: aprovado em outro PostgreSQL descartável. Inclui planejamento, descanso, reagendamento, limites, concorrência, economia e uso único de proteção.
- Testes novos cobrem visibilidade, compensação, relógio da conta e meia-noite, plano futuro, sessão desconhecida/ativa, registros pendentes, abertura e cancelamento sem operações, kit com/sem estoque, falha, duplo clique, reação confirmada, reagendamento e indisponibilidade, confirmação informativa da falta, mudança de dia/conta e proteção concorrente.
- Chromium com Supabase **integralmente simulado**: 320, 375, 390, 430, 768 e 1280 px, nos dois temas. Verificados alinhamento dos botões, toque mínimo, modal, ausência de rolagem horizontal, imagens reais, cancelamento, estoque, destino da Loja, confirmação única de kit e troca, estados ocultos e ausência de novas mutações ao abrir/fechar.
- Verificação adicional de telas baixas, rolagem com X visível, navegação por teclado, retorno de foco, texto a 200%, movimento reduzido e modo offline sem fila de operações.
- `git diff --check`: aprovado. Não existe script de lint no projeto.

Não foram usadas contas reais para testes de consumo, troca, ausência ou concorrência. Não houve teste em Android/iPhone físico; as capturas são renderizações reais do Chromium, não imagens geradas.

## Capturas reais

| Estado | Claro | Escuro |
| --- | --- | --- |
| Botões no Início, 320 px | [Abrir](nao-treinei-hoje/home-light-320.png) | [Abrir](nao-treinei-hoje/home-dark-320.png) |
| Tela dramática, 390 px | [Abrir](nao-treinei-hoje/scene-light-390.png) | [Abrir](nao-treinei-hoje/scene-dark-390.png) |
| Rolagem e X, 320 px | [Abrir](nao-treinei-hoje/scrolled-light-320.png) | [Abrir](nao-treinei-hoje/scrolled-dark-320.png) |
| Confirmação do kit | — | [Abrir](nao-treinei-hoje/kit-dark-320.png) |
| Reagendamento | [Abrir](nao-treinei-hoje/reschedule-light-320.png) | — |
| Confirmação informativa da falta | — | [Abrir](nao-treinei-hoje/accept-dark-320.png) |
| Texto ampliado | [Abrir](nao-treinei-hoje/text-200-light-320.png) | — |

## Piloto de 30 dias e pendências

| Ponto de atenção | Verificação recomendada |
| --- | --- |
| Confundir a escolha com falta já gravada ou desligamento do kit automático | Conferir compreensão da confirmação e do feedback; nenhuma dessas operações foi criada |
| Rede lenta, resposta perdida e dois aparelhos | Observar mensagens e estoque após atualização; preservar recibos/idempotência e não repetir consumo por lógica local |
| Virada de dia/fuso e retorno offline | Validar nos dispositivos do piloto; a data fica fixada e o servidor rejeita operação encerrada |
| Resultados já consolidados da Arena | Manter mensagens de recusa reais em vez de forçar reagendamento ou recalcular metas |
| Consumir kit esperando pontos ou uma ofensiva nova | Manter aviso de proteção sem pontos e confirmação de consumo; regras existentes não foram alteradas |
| Esperar uma pausa de sete dias operacional | A tela informa planejamento; a proposta depende de decisões específicas, não de apenas publicar a interface |
| Arte temporária e telas pequenas | Receber a arte dramática oficial e testar em Android/iPhone físicos; revisar feedback sobre densidade e rolagem |

Acompanhamento deve usar feedback e infraestrutura de erros existentes, sem coletar motivos médicos. Eventual reversão pode retirar a entrada visual; não deve desfazer proteções/trocas confirmadas nem editar históricos. Nenhuma migração de banco é necessária para esta entrega.

A publicação segue a autorização permanente do usuário após as validações. A proposta de Pausa de rotina permanece separada e **não foi implementada**.
