# Correções de interface, navegação, notificações e sincronização

Revisão de 21/10/2026, baseada em `a37ff5a`, após atualizar `origin/main` e conferir a árvore de trabalho limpa. O pacote anterior foi preservado. Não há migração nova, edição de migrações aplicadas, alteração de Edge Functions, segredos, Cron, preços ou regras de treino/ofensiva.

**Concluído** significa implementado e verificado nos ambientes descritos. **Parcial** indica uma validação externa ainda não executada. **Pendente** indica algo não implementado. Nada é considerado validado em aparelho físico pelos testes de Chromium.

## Resultado por ajuste

| Ajuste | Arquivos principais | Situação final | Testes realizados | Pendências |
|---|---|---|---|---|
| 1. Web Push automático | `docs/PUSH-E-GRUPOS.md`; código existente preservado | **Concluído**: auditoria de código e configuração; **Parcial**: entrega física | Metadados reais somente de leitura; SQL de horários/fusos/elegibilidade; 13 testes do dispatcher e criptografia | Validar apresentação em celular autorizado, app fechado/segundo plano |
| 2. Calendário | `src/WorkoutCalendar.tsx`, `src/styles.css` | **Concluído**: somente registros confirmados/snapshots `completed` recebem cor | Treino, falta, descanso, kit, reagendamento, futuro, mudança de mês e detalhe verdadeiro | Não existe data explícita de ativação no contrato; nenhuma data foi inferida |
| 3. Clique repetido no menu | `src/navigation.ts`, `src/App.tsx` | **Concluído**: reinício visual sem reload e sem nova entrada no histórico | Sete destinos, mês atual, Arena/Grupos, detalhes, Sobre fechado, modal e escrita crítica preservadas | Nenhuma |
| 4. Capibora do convite | `src/capiboraEditorial.json`, `src/NotificationOptIn.tsx` | **Concluído**: pose oficial `happy` / `mascot/web/feliz.webp` | Asset e apresentação específica do convite; demais contextos preservados | Nenhuma |
| 5. Texto e ordem do convite | `src/NotificationOptIn.tsx` | **Concluído**: frase removida, NÃO contorno à esquerda e SIM laranja à direita | Aceite, recusa, duplicação, falha, permissão negada/já concedida e onboarding existente | Permissão real de Android/iOS não testada fisicamente |
| 6. Sincronização silenciosa | `src/sync.ts`, `src/useSyncedResource.ts`, `src/SyncFeedback.tsx`, `src/useStartupGate.ts`, `src/social.ts` | **Concluído**: backoff compartilhado, cache/outboxes preservados, erros acionáveis visíveis | Rede/servidor, jitter, limite, foco, reconexão, descarte por conta, fila de peso com IDs estáveis, conflito e treino confirmado em outro aparelho | Validar conectividade do piloto em aparelhos reais |
| 7. Enviar provocação | `src/ArenaTauntButton.tsx`, `src/ArenaFriends.tsx`, `src/capiboraEditorial.json`, `src/arena.css` | **Concluído**: imagem, nome real/fallback, Deixa comigo..., Provocar e X | Consulta autorizada do nome, cancelamento pelo X, idempotência, espera do servidor, cota diária e layout | Nenhuma |
| 8. Equipes | `src/ArenaGroups.tsx`, `src/ArenaGroupTools.tsx` | **Concluído**: ações diretas e remoção dos blocos redundantes | Integrante/admin, convite, lotação, falha/reenvio, transferência contextual, encerramento do último integrante, meta/histórico | Nenhuma alteração de regra administrativa |
| 9. Permitir provocações | `src/ArenaTauntPreferences.tsx` | **Concluído**: controle único usando a RPC atual | Quatro combinações legadas, persistência explícita, silenciamento no servidor, envio bloqueado sem consumir cota, regras de push | Preferências legadas de push desligado não são reativadas na montagem |
| 10. Privacidade das medalhas | `src/App.tsx`, `src/AchievementsPage.tsx` | **Concluído**: controle removido; nenhum valor de privacidade/destaque escrito | Ausência da opção; dados e RPCs de privacidade existentes preservados; isolamento SQL | As pendências de artes da entrega anterior continuam independentes deste pacote |
| 11. Sobre o app | Novo `src/AboutApp.tsx`, `src/AppearanceSettings.tsx`, `src/App.tsx`, `src/styles.css` | **Concluído**: última opção, descrição curta | Ordem real em Configurações, tema persistente, expansão e reinício da página | Nenhuma |
| 12. Revisão relacionada | Componentes acima; `src/ProfilePanel.tsx`, `src/ArenaInbox.tsx` | **Concluído**: títulos/ações sem redundância; operações críticas protegidas | Navegador nas seis larguras e dois temas; salvamento lento de Perfil não é interrompido | Sem redesign das outras áreas |

## Push: configuração real e limites da comprovação

Foi consultado o projeto atual via API administrativa, em modo somente leitura, sem imprimir comandos do Cron, tokens, cabeçalhos, assinaturas ou mensagens dos usuários:

- `fokus-push-quarter-hour`: um único job, ativo, `*/15 * * * *`, chama `push-dispatch`, usa Vault e `x-cron-secret`.
- 96 execuções `succeeded` nas 24 horas da consulta. No histórico HTTP disponível, 23 respostas 200 e um resultado sem status; o último 200 da consulta inicial ocorreu às 14h15 de Brasília. Isso comprova execução automática e resposta do serviço, não apresentação do push em um aparelho.
- `push-dispatch` versão 6, `ACTIVE`; configuração existente mantida.
- A migração 040 já estava aplicada e a tabela de sinais já publicada em Realtime. Clientes anônimos continuam sem acesso e mensagens permanecem privadas por RPC.
- Primeiro lembrete na hora já salva por aparelho, lido no fuso da conta; nova inscrição usa 18h como padrão. Segunda chamada às 21h quando elegível. Nenhum horário foi modificado.
- O Cron de Kits Médicos tem outra finalidade; não é um agendamento duplicado de push.

Não é necessária ação externa de configuração identificada nesta auditoria. Para acompanhar uma falha futura, conferir o job existente em Cron, depois o status HTTP e os logs sanitizados do dispatcher; um `succeeded` do agendador pode significar somente que `pg_net` aceitou a chamada. Não recadastrar o job, reativar preferências, trocar VAPID ou executar os comandos de instalação novamente. Uma correção administrativa futura deve preservar os segredos no Vault.

## Sincronização e proteção dos dados

As leituras temporariamente indisponíveis ficam silenciosas na interface. O erro técnico permanece no estado de sincronização para diagnóstico e retentativa, sem remover snapshots. Um único agendador de retentativas, junto ao mecanismo compartilhado existente, usa 2s, 4s, 8s etc., com variação de ±20% e teto de cinco minutos. Leituras simultâneas da mesma consulta/conta/época continuam deduplicadas.

Eventos de foco comuns respeitam o backoff. Retorno real ao primeiro plano/reconexão permite uma atualização imediata. Sem rede, em segundo plano ou após desmontar/trocar de conta, as tentativas são suspensas/descartadas apropriadamente. Erros de autenticação, permissão, validação, conflitos, formato inválido ou armazenamento local continuam acionáveis. Falhas de operações sem confirmação continuam visíveis dentro do fluxo; não são tratadas como sucesso.

Não foi criada uma fila genérica que repetisse compras ou ações sociais. As outboxes existentes de treino manual/peso e os IDs de idempotência de compras são preservados. O peso pendente é marcado como salvo neste aparelho; nenhum treino local recebe `confirmedAt` fictício. O teste de peso comprova que o reenvio automático conserva o ID e gera apenas um registro.

O fluxo de recuperação ainda consulta o treino oficial de outro dispositivo mesmo quando uma declaração local falha. Se essa declaração continua sem confirmação e a falha é temporária, a retentativa é agendada. Um refresh manual pode limpar um erro anterior de conflito, sem repetir a escrita.

## Navegação, Perfil e equipes

O reinício é solicitado somente pelos acessos principais repetidos. Usa a navegação existente com `replaceState` e uma revisão visual; não usa `reload`. Controllers de dados, cronômetro e filas não são remontados. Arena volta a Grupos; Treinos ao mês/dia atual do servidor; Loja, Perfil, Peso e Configurações retornam à apresentação inicial. A rolagem/foco retorna ao topo. Preferências persistentes e regras de autenticação permanecem.

O reinício aguarda modais, escritas e operações críticas. O salvamento/edição da foto do Perfil foi identificado como um fluxo com `busy` próprio, sem escrita registrada na sincronização central; passou a sinalizar `aria-busy` numa área crítica. A fila global de provocações também observa esse sinal e aguarda o término do salvamento. A validação de navegador usa uma resposta lenta e comprova a preservação do formulário e a apresentação posterior da provocação.

Na equipe, meta semanal, histórico, integrantes, avatares e informações reais são preservados. A apresentação normal mostra apenas Convidar amigos e Sair do grupo. Transferir administração aparece dentro da saída quando necessária. O último administrador recebe uma confirmação distinta para Encerrar grupo. O backend ainda valida tudo; operações de alteração de nome/remoção administrativa não foram apagadas do servidor.

## Preferências e privacidade

`Permitir provocações` apresenta `!muted`. Somente uma ação explícita salva o par: ligado → `muted=false, push_taunts=true`; desligado → `muted=true, push_taunts=false`. As quatro combinações antigas são lidas sem escrever na montagem. Uma preferência antiga de push desligado permanece assim até uma escolha explícita. A permissão geral do dispositivo, amizade, silêncio, elegibilidade e infraestrutura continuam obrigatórios; ativar o checkbox não pede permissão nativa.

Os testes SQL usam a RPC já existente e demonstram que o destinatário desativado rejeita a nova provocação antes de consumir a cota, esconde o inbox e invalida push. Nenhuma migração é necessária para esse mapeamento.

A remoção do editor de privacidade das medalhas é exclusivamente visual. Não foi chamada `set_featured_medals`, nem alterados `visible`, IDs destacados, histórico ou permissões de compartilhamento. A coleção continua sendo a implementação existente.

## Validação

- `npm test`: **959 testes em 94 arquivos e 5 verificações offline**, aprovados na execução final.
- `npm run build`: TypeScript e produção aprovados; nenhum pacote adicionado ao projeto.
- `bash scripts/test-arena-db.sh`: aprovado em PostgreSQL 17 descartável, sem rede, incluindo o novo cenário de preferência única e a concorrência existente.
- `bash scripts/test-gamification-db.sh`: aprovado em banco descartável, incluindo elegibilidade dos lembretes, treinos, kits, conquistas, privacidade e economia.
- Dispatcher Deno: **13 testes aprovados**, incluindo reserva, supressão, duplicação, criptografia e payload. Chaves e transporte fictícios; nenhum push real enviado.
- Chromium: **320, 375, 390, 430, 768 e 1280 px**, claro/escuro; calendário/mês, navegação repetida, provocação/nome/X, equipes/convites/saída, preferências, Configurações, formulário protegido e desconexão. Não houve overflow ou sobreposição nos cenários executados. O corte proposital de conexão pode produzir `ERR_INTERNET_DISCONNECTED` no console do navegador; esses erros de transporte não são banners nem exceções JavaScript do app.
- Salvamento lento de Perfil com contas/RPCs sintéticos: navegação repetida bloqueada, campos preservados e provocação adiada até a confirmação.
- `git diff --check`: aprovado. Não existe script de lint no projeto.

Falhas intermediárias incluíram expectativas antigas de textos e banners, fixtures sem o código real de recusa de acesso e sincronização do navegador antes da resposta controlada. Foram atualizadas para os contratos novos. Os testes também detectaram a retentativa que parava após a primeira repetição e a recuperação concorrente de treino; ambos foram corrigidos. Não há testes essenciais ignorados.

Capturas reais com dados sintéticos ficam em `docs/correcoes-interface-12/`. Android/iPhone físicos, entrega por provedor, teclado nativo e múltiplos dispositivos de push não foram testados. Nenhuma conta real foi usada para operações de teste.

## Implantação

Este pacote precisa apenas da publicação do frontend/PWA pelo fluxo existente de GitHub Pages. Não executar SQL, `db push`, deploy de Edge Functions, criação de Cron ou atualização de segredos. A autorização anterior de publicação do frontend permanece aplicável; nenhuma autorização administrativa nova é necessária para este código.

Os arquivos alterados da implementação e dos testes estão na PR desta revisão. As artes de conquistas pendentes da entrega anterior não foram inventadas nem trocadas.
