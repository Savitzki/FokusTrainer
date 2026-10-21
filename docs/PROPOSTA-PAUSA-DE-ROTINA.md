# Proposta técnica — Pausa de rotina

**Status: proposta para decisão posterior. Não implementada, não ativada e sem SQL nesta entrega.**

A autorização geral para migrar/publicar não aprova estas regras de negócio: o pedido desta funcionalidade exige aprovação separada. O modal “Não treinei hoje” apenas informa que a pausa prolongada está em planejamento. Descanso extra, reagendamento e Kit Médico continuam sendo recursos distintos.

## Premissas ainda não aprovadas

Benefício gratuito, uma utilização a cada 90 dias, até sete datas corridas, início antecipado ou no dia corrente antes do fechamento, sem retroatividade, sem pontos de ofensiva, CapiWhey ou recompensas por treino durante a pausa. Encerramento antecipado possível. O congelamento diz respeito à continuidade da ofensiva; não cria pontos ou recordes.

Nenhum desses números foi colocado em configuração, banco ou cliente. Não existe proteção operacional de “Pausa de rotina”.

## Dependências reais encontradas

- `training_accounts` fixa fuso, dia inicial e revisão; `training_plans` guarda versões e vigência. `training_schedule_kind` e `training_day_kind` resolvem a classificação efetiva, incluindo `training_extra_rests`, `training_reschedules` e `medical_kits`.
- `get_training_state`, `save_training_plan`, `authorize_extra_rest` e `reschedule_training` são as operações existentes de planejamento. Não há uma operação de pausa ou de falta voluntária.
- `medical_auto_close_account` fecha dias pelo relógio do servidor e fuso da conta; o processamento existente também pode ocorrer em leituras de estado. `use_medical_kit` usa bloqueios e protege somente a data atual, de forma idempotente.
- `workout_days` contém confirmações reais; `gf_day`/`gf_days` consolidam classificações e conclusões históricas para missões, relatórios e desafios.
- A ofensiva coletiva é consolidada por `social_refresh_day`/`group_days`. `arena_group_cycles` congela participantes, dias elegíveis e meta semanal; não pode ser recalculado silenciosamente.
- Desafios usam as métricas existentes, incluindo `gf_challenge_metric`, `gf_challenge_board` e consolidação pelo servidor. Planos de referência e regras aceitas são versionados.
- Lembretes locais e Web Push já dependem de claims e validação de elegibilidade no servidor. Uma pausa futura precisaria integrar essa infraestrutura, sem um segundo scheduler.

## Semântica proposta para análise

O servidor deve representar a pausa como um intervalo próprio e auditável, sem criar treinos falsos, Kits Médicos fictícios ou registros de descanso extra para disfarçar a nova regra. Uma nova classificação efetiva precisaria ser versionada e reconhecida em todos os consumidores; apenas acrescentar uma lista no frontend não seria suficiente.

Uma entidade futura teria dono, ID estável, intervalo de datas, fuso fixado, instante de solicitação/confirmação, revisão, estado, chave de idempotência e histórico de encerramento/cancelamento. Esses são atributos propostos, **não uma tabela ou RPC disponível hoje**. Evitar armazenar motivo médico ou detalhes de saúde: a proteção não precisa dessa informação.

A confirmação deve bloquear a conta, revalidar o relógio do servidor, plano, sessão ativa, pausas anteriores e sobreposições, e só então gravar. Escritas diretas do cliente seriam proibidas, com RLS e RPC restritas à própria identidade. Não permitir escolha de usuário, fuso ou relógio arbitrários pelo cliente.

## Decisões necessárias

| Questão | Proposta conservadora para revisão | Impacto a validar |
| --- | --- | --- |
| Plano semanal | Manter o plano e suas versões; aplicar pausa como exceção temporária, sem reescrever os dias escolhidos | DTOs, calendário, relatórios e progresso precisam reconhecer o novo tipo |
| Retroatividade | Negar qualquer data já encerrada ou consolidada; validar limites por instante no servidor | Um grupo pode encerrar a data antes da conta, por diferença de fuso |
| Encerramento antecipado | Encerrar a partir da próxima data local, preservando dias já protegidos e o dia em curso | Retorno no mesmo dia requer outra decisão, sem reabrir snapshots |
| Intervalo de 90 dias | Contar a partir do início efetivo da última pausa, no fuso fixo da conta | Definir se são 90 datas locais ou 90 períodos de 24h; não usar relógio do aparelho |
| Cancelamento antes de começar | Permitir cancelar sem efeito histórico na ofensiva; manter recibo e auditoria | Decidir se a cota só é consumida ao iniciar; cancelamentos não podem alterar metas congeladas |
| Abuso | Uma pausa ativa/agendada por conta, limite validado sob bloqueio, sem backdate ou sobreposição | Reenvios, dois aparelhos, mudança de plano/fuso e cancelamentos sucessivos |
| Treino durante a pausa | Não tratar como cumprimento obrigatório nem gerar pontos/recompensas por estar em pausa | A regra de recompensa de treinos é transversal; decidir entre registro voluntário sem recompensa ou exigir encerramento da pausa antes de retomar o registro normal |
| Metas coletivas em andamento | Preservar a meta e os participantes congelados; não reduzir a meta ou conceder conclusão automática | Definir a contribuição de treino voluntário durante pausa; não adicionar unidades sem confirmação elegível |
| Desafios aceitos | Preservar denominadores, metas e pontuações dos contratos existentes | Propor uma política explícita de retirada/cancelamento neutro para versões futuras; não mudar a disputa antiga silenciosamente |
| Ofensiva coletiva | Qualquer proteção só poderia valer em data ainda aberta, sem pontos individuais adicionais | Decidir expressamente se a pausa individual protege o grupo; não supor equivalência com descanso ou kit |
| Notificações | Suspender cobranças de treino na pausa usando os claims atuais, revalidando imediatamente antes da entrega | Invalidar lembretes obsoletos e impedir push/local duplicados; notificações transacionais continuam claras |
| Kits Médicos | Classificação de pausa precisa ter precedência definida para evitar consumo automático concorrente | Se um kit já foi usado, preservar o uso e não devolver; negar sobreposição ou iniciar a pausa na data seguinte |
| Histórico | Eventos imutáveis, com cutoffs por data e preservação de `gf_days`, `group_days`, resultados e desbloqueios anteriores | Não reconstruir passado usando uma pausa criada depois do fechamento |
| Afastamento maior que sete dias | Comunicação neutra e sem incentivo para treinar durante doença ou recuperação | Definir alternativas de suporte/retorno e eventual exceção futura; não prometer proteção ilimitada ou oferecer extensão paga nesta proposta |

## Missões, conquistas e economia

Uma pausa não pode transformar uma semana incompleta em prêmio de cumprimento integral por reduzir o denominador. Metas/recompensas de ciclos já emitidos precisam permanecer congeladas. Uma proposta conservadora é impedir que a exceção, por si só, libere missão de plano completo ou conquista de semana completa; objetivos já comprovados antes da pausa continuam válidos.

Não modificar desafios ativos ou declarar vencedores pela pausa. Treinos anteriores continuam confirmados. Reconhecimento de recorde considera somente pontos oficiais, nunca os dias protegidos. Não criar uma conquista ou recompensa de pausa.

São decisões de regra que precisam ser aprovadas antes de qualquer implementação. Em particular, “treino confirmado sem recompensa durante a pausa” exige revisar explicitamente a integração de confirmação/economia, não apenas esconder um botão.

## Concorrência e privacidade

Manter a ordem atual de bloqueios da conta, carteira e grupos, evitando deadlocks. Confirmar/encerrar pausa, confirmar treino, autorizar descanso, reagendar e consumir kit precisam de uma definição comum de prioridade sob transação. Um cliente que perdeu uma resposta deve repetir o mesmo pedido, sem criar segunda pausa ou renovar cota.

Um integrante de grupo pode visualizar apenas um estado autorizado de indisponibilidade/proteção. Não expor motivo médico, viagem, e-mail, peso ou outros dados privados. Nenhuma publicação ou notificação social automática deve revelar o afastamento.

## Plano de validação antes de ativar

1. Aprovar as decisões da tabela, incluindo efeitos sobre desafios ativos e metas congeladas.
2. Definir contrato versionado de classificação, estado da conta, histórico e claims de notificação. Mapear todos os consumidores de `EffectiveDayKind` e dos DTOs de calendário/relatórios antes de acrescentar um tipo.
3. Preparar migração incremental e testes em banco descartável; nenhum backfill de pausas passadas.
4. Testar limite de 90 dias, início/fim, cancelamento, retorno antecipado e pausas de 1–7 datas, inclusive transições de mês, ano, fuso e horário de verão.
5. Testar disputa entre pausa, kit manual/automático e confirmação, além de duas solicitações simultâneas, respostas perdidas e reabertura offline.
6. Testar missões, conquistas, metas coletivas e todas as modalidades/versionamentos de desafios, com preservação de snapshots e saldos.
7. Testar bloqueio de cobranças em todos os canais atuais e revalidação imediatamente antes de entrega.
8. Ativar apenas após aprovação, preferencialmente com flag e piloto consentido; acompanhar erros e feedback usando a infraestrutura existente, sem acrescentar coleta de saúde.

**Entrega atual: somente esta proposta. Nenhuma migração, RPC, proteção, cota de 90 dias ou benefício de sete dias foi criado.**
