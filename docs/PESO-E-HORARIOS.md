# Pesagens independentes e horários

O usuário conectado pode registrar várias pesagens na mesma data, inclusive com valores iguais. Cada uma recebe um identificador próprio e permanece imutável: não há edição, substituição por data ou exclusão no aplicativo. Visitantes são direcionados ao cadastro/login.

## Banco e migração

Depois das migrações 001–010, aplique [202610170011_immutable_weight_entries.sql](../supabase/migrations/202610170011_immutable_weight_entries.sql). Aplicada no projeto atual em **17/10/2026**, com verificação das RPCs em transação revertida. Os hashes dos pesos antigos, saldos, extrato, kits e demais dados anteriores permaneceram idênticos. A migração pode ser reaplicada. `weight_entries` guarda identificador por usuário, data escolhida, valor, horário registrado no aparelho e horário de confirmação do servidor. Tem RLS e não permite acesso direto aos usuários; a RPC `sync_weight_entries` usa `auth.uid()`.

As linhas antigas de `weight_logs` são preservadas integralmente. Pesos antigos não excluídos são copiados uma única vez, sem recompensas retroativas. O horário conhecido dessas linhas é a última gravação registrada na versão antiga; não é possível recuperar horários ou valores que já tinham sido substituídos antes da atualização. Marcadores de exclusão antigos não são recriados como pesagens.

O endpoint antigo `sync_weights` continua aceitando consultas sem alterações. Tentativas de gravar, editar ou excluir por ele recebem uma orientação para atualizar o app. Os helpers antigos continuam privados. Assim, uma instalação antiga não consegue alterar valores pelo caminho anterior.

## Sincronização e recuperação

- O histórico e o gráfico mostram as pesagens individualmente. Cada pesagem tem seu horário, e o gráfico usa um ponto por registro em ordem cronológica, com espaçamento uniforme entre pontos. A tela inicial mostra o último valor.
- A fila offline persiste cada identificador antes de mostrar o registro. Reenvio, timeout e recarregamento reutilizam o mesmo identificador, sem duplicar. Entradas feitas durante uma sincronização permanecem na fila.
- Ao entrar na mesma conta em outro aparelho, todas as pesagens sincronizadas reaparecem. O botão **Sincronizar pesos** atualiza o histórico; sincronizações também ocorrem ao abrir, reconectar ou voltar ao app.
- Pesos antigos sem conta podem ser importados explicitamente. A importação usa identificadores estáveis, evitando duplicações ao ser repetida. Importações não geram moedas.
- O cache diário antigo é convertido para o formato 2, com uma cópia original em `:weight-sync:v1-backup`. Valores confirmados são preservados. Uma edição positiva ainda pendente é convertida em outra pesagem, sem substituir a anterior. Uma exclusão antiga pendente não é aplicada; o app avisa e preserva a cópia original no aparelho.
- Se o mesmo identificador chegar com dados diferentes, o servidor preserva o registro confirmado. A interface oferece guardar o dado pendente como outra pesagem ou manter somente o registro da conta. Ela nunca sobrescreve silenciosamente o valor confirmado.

Ao sair, os caches pessoais e a cópia de segurança local são removidos. Pesos ainda pendentes impedem a saída manual para evitar perda. Os registros confirmados continuam no servidor. Limpar os dados do navegador apaga pesagens que ainda não foram enviadas. Amigos e grupos não têm acesso ao peso.

## Moedas, datas e segurança

A regra continua em `economy_rules.weight_reward`, inicialmente **2 moedas no primeiro registro válido do dia**. Outras pesagens da mesma data não rendem novas moedas, inclusive quando chegam simultaneamente de aparelhos diferentes. Registros e importações antigos não recebem créditos retroativos. A data válida e a virada do dia usam o fuso fixado na conta e o relógio do servidor, sem aceitar datas futuras. O horário do aparelho é mantido para consulta; a confirmação do servidor é salva separadamente.

A RPC usa o mesmo bloqueio de conta dos treinos e da carteira. Identificadores repetidos só podem confirmar o recebimento original, sem atualizar valor, data ou horário. Qualquer erro de validação reverte o lote inteiro.

## Corrida de treinos

O horário de pesagem não afeta a corrida da **Arena**. A ordem dos participantes continua usando a confirmação online do treino no fuso do grupo. Descansos válidos e kits mantêm a ofensiva sem classificação; grupos exigem sincronização antes do encerramento do dia. As regras de treino e grupo não foram alteradas por esta migração.

## Verificação

`npm test` e `npm run build` validam a interface, os modelos, a fila offline, a migração de cache e o PWA. `bash scripts/test-profiles-db.sh` usa PostgreSQL 17 descartável para testar reaplicação da migração, cópia legada, imutabilidade, tentativas repetidas, isolamento, recompensa diária e pesagens simultâneas. A conferência em Chromium cobre os dois temas, múltiplos registros do mesmo dia, valores iguais, horários, gráfico, reconexão, recarregamento e recuperação em outro contexto de navegador.
