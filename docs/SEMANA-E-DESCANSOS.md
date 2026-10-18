# Semana de treinos, descansos e reagendamentos

A [expansão de gamificação](GAMIFICACAO.md), nas migrações 017–021 autorizadas e aplicadas em produção em 17/10/2026, reutiliza os tipos efetivos dos dias abaixo. Missões, relatórios e desafios reconhecem origens neutralizadas, destinos compensatórios e proteções, preservando os snapshots coletivos já consolidados e a configuração 5/2.

A evolução do cronograma requer as migrações 001–011 e a nova [012 — reagendamentos](../supabase/migrations/202610170012_training_reschedules.sql). A 012 foi autorizada e aplicada ao Supabase de produção em **17/10/2026**, junto das atualizações 014/015. A conferência por hashes preservou todos os registros existentes e as classificações anteriores dos dias. Não faz backfill nem modifica treinos, programações, conquistas, moedas ou kits existentes.

## Configuração e uso

A evolução **025 — Plano Semanal bloqueado** reutiliza `training_plans`, com novas revisões e referências de substituição. Requer 001–024. A migração foi **autorizada e aplicada em produção em 18/10/2026**, dentro da autorização geral já dada para migrar e publicar. A auditoria preservou os dados nas 37 tabelas existentes (incluindo `auth.users`), as versões anteriores e as funções não relacionadas. Nenhuma versão de compatibilidade precisou ser criada no projeto atual e nenhuma atividade de teste foi inserida.

Em **Treinos → Personalize sua semana**, acima do calendário, existem três estados:

- **Sem plano:** seleção de exatamente cinco dias de treino e dois descansos, com **Criar meu plano**. A seleção começa vazia; não há plano automático para contas novas.
- **Plano ativo:** os dias ficam desabilitados, com indicador **Bloqueado** e botão **Substituir plano**. Planos antigos continuam valendo, inclusive versões legadas com quantidade diferente de cinco dias.
- **Substituição:** seleção temporária, programação atual, aviso de preservação do histórico, prévia e confirmação explícita. Cancelar ou falhar não altera o plano atual. Um plano pendente é substituído por uma nova revisão na mesma data de início, sem apagar a revisão anterior.

Quem ainda não tem plano pode navegar normalmente. Ao tentar registrar o primeiro treino, abre esse mesmo componente no modal. Somente após confirmação do servidor são oferecidos os métodos manual e cronometrado. O servidor bloqueia o início do cronômetro e qualquer confirmação definitiva sem plano, mesmo se o cliente ignorar o formulário. Sessões antigas continuam recuperáveis; a finalização também passa pela verificação do plano.

O **primeiro plano entra em vigor hoje**, no fuso fixado da conta. Escolher hoje como descanso permite treino voluntário, sem ponto na ofensiva. Substituições posteriores entram em vigor **amanhã**; hoje e o passado continuam classificados pelo plano anterior. O fim da vigência é derivado da próxima revisão efetiva, sem atualizar/excluir a versão anterior. Duas revisões com a mesma data não são dois planos ativos: vence a maior revisão, e `replaces_revision` identifica a versão substituída.

O bloco **Sua semana**, no Início, calcula `concluídos/obrigatórios` pelas versões vigentes em cada data. Em semanas comuns de cinco dias, mostra x/5. Uma semana de transição pode ter menos ou mais obrigações (por exemplo, seis), sem duplicar datas. Descansos válidos e proteções não contam como obrigações pendentes; treinos voluntários não entram no numerador. A primeira semana começa na criação do plano. Sem obrigações na semana, o card não mostra uma conclusão fictícia.

Salvar/substituir requer internet e só mostra sucesso após a resposta do servidor. Revisão, calendário, Arena, missões, relatórios e desafios são invalidados seletivamente pelo mecanismo existente; o cache por conta permanece disponível para leitura e é limpo ao sair. As metas **já emitidas** não têm alvos, progresso ou recompensas reescritos por uma substituição. A verificação de faltas segue as obrigações efetivas; ciclos futuros usam a nova programação. Quotas e resultados de desafios aceitos/consolidados conservam suas regras existentes.

### Compatibilidade histórica

A 025 registra `legacy_schedule_before` nas contas existentes para preservar o antigo calendário implícito anterior ao corte. Somente contas antigas **com treinos e sem qualquer plano** recebem uma versão de compatibilidade de sete dias, reproduzindo o comportamento anterior. Não se cria esse padrão para contas novas ou sem treinos. Essa regra explícita não altera treinos, saldos, metas emitidas nem snapshots. Novas contas sem plano usam o estado neutro **Sem plano**, sem obrigações fictícias e sem gerar missões prematuras.

## Reagendar treino

1. No calendário, selecione hoje ou um dia futuro de treino obrigatório, ainda sem registro.
2. Toque em **Reagendar treino** e escolha um dos descansos posteriores disponíveis na mesma semana.
3. Confirme a troca. O calendário seleciona a data compensatória e explica de onde o treino veio; na origem, mostra para quando foi transferido.

Cada semana vai de **segunda a domingo** e admite até **2 trocas**, independentemente dos outros benefícios. É possível organizar uma semana futura; a cota pertence à semana da origem. Não há troca para trás, para outra semana, após encerrar o dia original, nem encadeamento de um treino já transferido. O destino precisa ser um descanso programado sem outro treino, confirmação, descanso extra, Kit Médico ou participação em outra troca. A origem também não pode estar concluída ou protegida. Sem um descanso posterior disponível, o botão explica por que não é possível reagendar.

A origem vira descanso imediatamente. O destino passa a ser obrigatório; a troca conserva a quantidade efetiva de obrigações da semana, mesmo nas semanas de transição. A troca não muda o padrão das semanas seguintes, não gera moedas ou pontos, não pode ser cancelada/editada por uma RPC e não altera períodos encerrados. Repetir exatamente um pedido bem-sucedido é seguro, inclusive depois de perder a resposta.

## Contagem da ofensiva

| Situação | Efeito |
| --- | --- |
| Treino obrigatório concluído, inclusive compensatório | +1, no máximo uma vez por data |
| Descanso programado ou por reagendamento | Mantém, sem somar |
| Descanso extra autorizado ou Kit Médico usado | Mantém, sem somar |
| Dia obrigatório encerrado sem treino ou proteção | Interrompe; o próximo treino começa em um |
| Treino voluntário em descanso | Permanece no histórico, sem pontos de ofensiva |

Hoje pode ficar pendente até terminar. A sequência atravessa semanas e descansos válidos. Duplicatas antigas de treino não somam duas vezes. Um treino compensatório perdido segue a regra normal de falta.

Os limites permanecem independentes:

| Recurso | Limite | Configuração no servidor |
| --- | --- | --- |
| Reagendamento | 2 por semana | `training_reschedule_limit()` |
| Descanso extra | 2 por semana | `training_extra_rest_limit()` |
| Kits gratuitos (requer 016) | 2 por mês, sem acúmulo | `economy_rules.monthly_free_kits` |

A política de Kit Médico da [016](MOEDAS-E-KITS.md), autorizada e aplicada em 17/10/2026, oferece dois gratuitos por mês e compra extra por **250 potes de proteína**, sem cota semanal de uso. Extras e reagendamentos continuam limitados a dois por semana. Extra e kit podem proteger uma compensação quando a data chegar, antes de encerrar o dia. Uma origem já transformada em descanso não consome nenhum dos dois. Não há sobreposição, proteção retroativa ou alteração de resultados consolidados. Treinos voluntários mantêm a recompensa existente, sem bônus pelo reagendamento.

## Calendário

Ícones diferenciam treino programado, concluído, descanso programado, descanso por troca, compensação, descanso extra, kit e falta. A legenda permanece compacta; nomes acessíveis e detalhes do dia explicam o estado completo. Na origem aparece “Treino transferido para quinta-feira…” e no destino “Treino reagendado de terça-feira…”. Meses futuros são consultáveis para permitir trocas dentro de semanas que atravessam o fim do mês.

## Arena e fusos

Um membro sem plano aparece como **Sem plano** e não salva o dia coletivo como se estivesse em descanso. Ao criar o primeiro plano, o dia ainda não consolidado é atualizado. Um membro em descanso válido não precisa treinar para proteger o grupo. Os demais precisam confirmar online dentro do dia do grupo. Se todos descansarem, a sequência coletiva se mantém sem somar; se houver pelo menos um obrigatório e todos cumprirem suas obrigações, soma um. Treinos voluntários em descanso não recebem posição na corrida diária. O destino da troca volta a ser obrigatório, inclusive na Arena.

As datas do cronograma são avaliadas na data civil do grupo, conforme o padrão existente. O fuso da conta fixa o “hoje” individual e os limites; o fuso do grupo fixa a confirmação coletiva. A tela e a sincronização do treino usam o “hoje” retornado pelo servidor. Offline, a consulta conserva o último dia confirmado até sincronizar novamente. Alterar o relógio ou o fuso do aparelho não reabre um dia nem altera essas validações. O fuso da conta não pode ser trocado por esta interface/RPC.

Substituições da programação permanente mantêm o corte do início do dia do grupo. A primeira criação pode valer imediatamente; não reescreve um dia coletivo já consolidado. Trocas e proteções só entram quando registradas antes do fim desse dia. **Dias coletivos concluídos e dias encerrados já avaliados são imutáveis**, inclusive faltas. Antes de aceitar uma troca, o servidor bloqueia os grupos ativos em ordem consistente e recusa a operação inteira se qualquer uma das datas já estiver consolidada, encerrada no fuso de um dos grupos ou tiver confirmação do próprio participante nesse fuso. Não corrige parcialmente o individual deixando o grupo divergente.

Essa decisão pode impedir uma troca ainda válida no relógio da conta quando um grupo de outro fuso já encerrou a data. O erro explica que o resultado da Arena será preservado. Os outros membros veem “Transferido” e a data de destino; no dia compensatório veem sua origem. Dias sem visitas continuam sendo avaliados ao consultar o grupo, sem recalcular resultados congelados.

## Banco, sincronização e notificações

`training_reschedules` guarda ID, conta, origem, destino, segunda-feira da semana, horário do servidor e revisão. RLS está ativo, sem acesso direto do navegador à tabela. Apenas RPCs autenticadas leem/gravam o estado próprio. `reschedule_training` serializa pela conta, valida a revisão, bloqueia grupos, impede conflitos entre aparelhos e devolve o cronograma atualizado. As versões, proteções e trocas vêm em `get_training_state`. Funções privadas permanecem sem permissão de execução pública.

O cliente conserva a leitura de estados antigos sem `reschedules`; o botão só aparece quando o servidor oferece a capacidade. Criar/salvar uma programação exige conexão. O cache não autoriza operações nem altera saldo/pontos no servidor.

Antes de emitir um lembrete local de treino, o app atualiza o cronograma para considerar alterações de outro aparelho. Origem transferida não recebe cobrança; destino obrigatório recebe nos horários já configurados. Se não conseguir atualizar, adia a cobrança de treino até uma consulta válida; lembretes de peso continuam independentes. O marcador de envio impede repetição local. No Web Push, a verificação existente antes da entrega consulta o cronograma efetivo; trabalhos antigos da origem são suprimidos e a deduplicação por dispositivo/data/horário permanece. Não há novo serviço, envio de push nem alteração de preferências nesta migração.

## Validação e ativação

```bash
npm test
npm run build
bash scripts/test-profiles-db.sh
bash scripts/test-gamification-db.sh
```

O último comando requer Docker e usa PostgreSQL 17 descartável, sem rede ou porta publicada. Testa reaplicação das migrações, preservação por hashes, cinco/duas seleções, conflitos, limite/repetição/terceira troca, datas inválidas, proteções, compensação concluída/perdida, snapshots e fusos da Arena, guardas de push e concorrência real de dois pedidos. Os testes do cliente cobrem contagem entre semanas, detalhes do calendário, fluxo de confirmação, cache após remontagem e lembretes. Os fixtures SQL nunca devem ser executados em produção.

Em outro projeto, aplique a migração 012 após a 011 e antes de publicar o frontend. A alteração adicional de cadastro usa a [013 — consulta de e-mail](../supabase/migrations/202610170013_account_email_lookup.sql), também aplicada no projeto atual em 17/10/2026, após autorização específica. Ela é independente da 012. O pipeline de main publica automaticamente no GitHub Pages, mas não executa SQL. A verificação da 012 em produção confirmou o novo contrato do estado e suas permissões em uma transação somente de leitura; os testes de gravação e concorrência foram executados exclusivamente no banco descartável.

Não foram feitos cadastros ou logins reais, nem envios de e-mail ou Web Push. A verificação de existência de e-mail da 013 foi conferida no banco real somente com leituras.

## Migração 025, validações e limites

`202610180025_locked_weekly_plans.sql` acrescenta somente metadados de compatibilidade/vinculação às estruturas existentes. A nova assinatura autenticada é `save_training_plan(p_training_days, p_revision, p_timezone, p_replace)`: criação exige `false`, substituição exige `true`; a assinatura antiga não permite contornar o bloqueio. `training_has_plan` permanece privado. RLS e a ausência de escrita direta protegem os planos; toda criação/substituição é uma transação serializada pela conta, com revisão esperada e grupos bloqueados em ordem consistente.

Reagendamentos continuam sendo exceções temporárias. Uma substituição não pode transformar a origem futura em descanso-base nem o destino compensatório em treino-base. O erro lista as datas conflitantes; como trocas confirmadas não têm cancelamento nesta versão, preserve essas datas no novo plano ou aguarde sua conclusão. A cota permanece em dois reagendamentos por semana e não exige mais que uma semana de transição tenha exatamente cinco obrigações. Kits e extras permanecem independentes, sem novos custos ou bônus.

Um grupo em fuso adiantado pode já ter consolidado uma data que, para a conta, ainda é futura. Se a nova programação mudar essa obrigação, o servidor recusa integralmente a substituição e informa a data. Nunca reabre o resultado coletivo. Substituir não restaura ofensivas perdidas nem funciona como proteção de falta.

Os testes SQL da 025 ficam em `locked-plans-legacy-setup.sql`, `locked-plans-migration.sql` e `locked-weekly-plans.sql`, além de `scripts/test-plan-concurrency.sh`. Incluem conta nova sem padrão, bloqueio dos dois métodos, cinco dias, criação imediata, treino voluntário, substituição amanhã, revisão pendente, falhas, planos anteriores imutáveis, semana de seis obrigações, metas, kits/extras, Arena e concorrência real entre duas conexões. As suítes existentes continuam cobrindo moedas, duração, duplicidade e registros anteriores.

Para ativação, aplicar somente a 025 sobre a 024, registrar a versão e publicar o frontend compatível. A autorização geral de migração/publicação já dada pelo usuário pode ser usada nesta sessão; não usar `db push` para reaplicar o histórico nem executar fixtures em produção. Clientes antigos devem fechar/reabrir a PWA online para atualizar. Não há serviço adicional ou configuração de segredo.


Validação em 18/10/2026: `npm test` passou com **388 testes em 46 arquivos**; `npm run build` passou. Passaram `test-profiles-db.sh` e `test-gamification-db.sh`, incluindo os testes SQL de planos e concorrência real. O ensaio da transação administrativa também passou, inclusive com uma conta legada sintética sem plano. No Chromium móvel simulado passaram quatro cenários de planos (conta nova/existente, temas claro/escuro, 320/390 px), com criação obrigatória, bloqueio, prévia, falha, substituição pendente e recarga; outros oito cenários verificaram os métodos de registro e a fila offline. Testes físicos em Android/PWA e iPhone/Safari não foram executados. Não foram usados dados reais nas simulações.
