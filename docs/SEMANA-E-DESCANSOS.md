# Semana de treinos, descansos e reagendamentos

A evolução do cronograma requer as migrações 001–011 e a nova [012 — reagendamentos](../supabase/migrations/202610170012_training_reschedules.sql). A 012 está preparada e testada em PostgreSQL descartável; **não foi aplicada ao Supabase de produção nesta alteração**. Não faz backfill nem modifica treinos, programações, conquistas, moedas ou kits existentes.

## Configuração e uso

Em **Configurações → Sua semana**, com atalho **Sua semana** na tela Treinos, selecione exatamente **5 dias de treino e 2 de descanso**, de segunda-feira a domingo. Os dias desmarcados são descanso. O contador mostra as duas quantidades; cliente e servidor recusam qualquer outra combinação.

Salvar cria uma versão válida **a partir de amanhã**, segundo o fuso fixado na conta. Versões anteriores permanecem. A sincronização acontece ao abrir a tela, voltar ao aplicativo, recuperar a conexão e periodicamente. O cache separado por conta permite consultar a programação offline e é apagado ao sair.

Contas que iniciarem o cronograma após a 012 recebem segunda a sexta como padrão, a partir do dia seguinte. As semanas antigas de 6/7 treinos e a primeira semana parcial não são corrigidas retroativamente: isso alteraria pontos anteriores. Ao salvar, passa a valer uma programação de 5/2; reagendamentos só ficam disponíveis em semanas cujo cronograma efetivo já tenha cinco treinos. Uma edição permanente não pode transformar uma semana que já tem cinco em quatro/seis, nem invalidar as datas de uma troca futura confirmada. Nesses casos o app mostra o motivo; preserve os dias envolvidos ou use o reagendamento.

## Reagendar treino

1. No calendário, selecione hoje ou um dia futuro de treino obrigatório, ainda sem registro.
2. Toque em **Reagendar treino** e escolha um dos descansos posteriores disponíveis na mesma semana.
3. Confirme a troca. O calendário seleciona a data compensatória e explica de onde o treino veio; na origem, mostra para quando foi transferido.

Cada semana vai de **segunda a domingo** e admite até **2 trocas**, independentemente dos outros benefícios. É possível organizar uma semana futura; a cota pertence à semana da origem. Não há troca para trás, para outra semana, após encerrar o dia original, nem encadeamento de um treino já transferido. O destino precisa ser um descanso programado sem outro treino, confirmação, descanso extra, Kit Médico ou participação em outra troca. A origem também não pode estar concluída ou protegida. Sem um descanso posterior disponível, o botão explica por que não é possível reagendar.

A origem vira descanso imediatamente. O destino passa a ser obrigatório; continuam planejados cinco treinos. A troca não muda o padrão das semanas seguintes, não gera moedas ou pontos, não pode ser cancelada/editada por uma RPC e não altera períodos encerrados. Repetir exatamente um pedido bem-sucedido é seguro, inclusive depois de perder a resposta.

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

| Recurso | Limite por semana | Configuração no servidor |
| --- | --- | --- |
| Reagendamento | 2 | `training_reschedule_limit()` |
| Descanso extra | 2 | `training_extra_rest_limit()` |
| Uso de Kit Médico | 2 | `economy_rules.weekly_kit_limit` |

O Kit Médico continua custando **50 moedas**. Extra e kit podem proteger uma compensação quando a data chegar, antes de encerrar o dia, seguindo as regras existentes. Uma origem já transformada em descanso não consome nenhum dos dois. Não há sobreposição de proteções, restauração retroativa nem mudança de preço, saldo, inventário ou regras de recompensa nesta alteração. Treinos voluntários mantêm a regra de recompensa já existente, sem bônus criado pelo reagendamento.

## Calendário

Ícones diferenciam treino programado, concluído, descanso programado, descanso por troca, compensação, descanso extra, kit e falta. A legenda permanece compacta; nomes acessíveis e detalhes do dia explicam o estado completo. Na origem aparece “Treino transferido para quinta-feira…” e no destino “Treino reagendado de terça-feira…”. Meses futuros são consultáveis para permitir trocas dentro de semanas que atravessam o fim do mês.

## Arena e fusos

Um membro em descanso válido não precisa treinar para proteger o grupo. Os demais precisam confirmar online dentro do dia do grupo. Se todos descansarem, a sequência coletiva se mantém sem somar; se houver pelo menos um obrigatório e todos cumprirem suas obrigações, soma um. Treinos voluntários em descanso não recebem posição na corrida diária. O destino da troca volta a ser obrigatório, inclusive na Arena.

As datas do cronograma são avaliadas na data civil do grupo, conforme o padrão existente. O fuso da conta fixa o “hoje” individual e os limites; o fuso do grupo fixa a confirmação coletiva. A tela e a sincronização do treino usam o “hoje” retornado pelo servidor. Offline, a consulta conserva o último dia confirmado até sincronizar novamente. Alterar o relógio ou o fuso do aparelho não reabre um dia nem altera essas validações. O fuso da conta não pode ser trocado por esta interface/RPC.

A programação permanente mantém o snapshot do início do dia do grupo. Trocas e proteções só entram quando registradas antes do fim desse dia. **Dias coletivos concluídos e dias encerrados já avaliados são imutáveis**, inclusive faltas. Antes de aceitar uma troca, o servidor bloqueia os grupos ativos em ordem consistente e recusa a operação inteira se qualquer uma das datas já estiver consolidada, encerrada no fuso de um dos grupos ou tiver confirmação do próprio participante nesse fuso. Não corrige parcialmente o individual deixando o grupo divergente.

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
```

O último comando requer Docker e usa PostgreSQL 17 descartável, sem rede ou porta publicada. Testa reaplicação das migrações, preservação por hashes, cinco/duas seleções, conflitos, limite/repetição/terceira troca, datas inválidas, proteções, compensação concluída/perdida, snapshots e fusos da Arena, guardas de push e concorrência real de dois pedidos. Os testes do cliente cobrem contagem entre semanas, detalhes do calendário, fluxo de confirmação, cache após remontagem e lembretes. Os fixtures SQL nunca devem ser executados em produção.

Para ativar, revise e autorize a migração 012 após a 011; aplique-a uma vez no Supabase e só então publique o frontend. A alteração adicional de cadastro usa a [013 — consulta de e-mail](../supabase/migrations/202610170013_account_email_lookup.sql), aplicada no projeto atual em 17/10/2026, após autorização específica. Ela é independente da 012 e não ativa os reagendamentos. O pipeline de main publica automaticamente no GitHub Pages, mas não executa SQL. Após publicar, valide com contas de teste próprias, em dois aparelhos e em uma Arena, sem modificar o histórico dos usuários.

Não foram feitos cadastros ou logins reais, nem envios de e-mail ou Web Push. A verificação de existência de e-mail da 013 foi conferida no banco real somente com leituras.
