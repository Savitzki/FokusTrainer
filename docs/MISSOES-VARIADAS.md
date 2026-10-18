# Até três missões semanais

A migração incremental [022](../supabase/migrations/202610170022_rotating_weekly_missions.sql) foi autorizada e aplicada em produção em **17/10/2026**, no projeto `qfzoeshhogoilsmvxlif`. Ela substitui somente a emissão de novos ciclos e preserva ciclos, progressos, saldos, kits, compras e históricos existentes.

Cada novo ciclo oferece **no máximo três missões**, escolhidas pelo servidor em uma rotação de quatro semanas:

| Variação | Treinos obrigatórios | Peso em dias distintos | Terceira missão |
| --- | ---: | ---: | --- |
| 1 | Até 2 | Até 1 | Cumprir o plano |
| 2 | Até 3 | Até 1 | Manter a consistência |
| 3 | Até 2 | Até 2 | Cumprir o plano |
| 4 | Até 3 | Até 2 | Manter a consistência |

A rotação repete após quatro semanas. Não exige treinos extras: a meta de frequência é limitada às datas obrigatórias disponíveis. Reagendamentos contam na data compensatória; descansos, kits e extras já autorizados ficam fora das datas de treino disponíveis. Várias pesagens na mesma data continuam representando um dia.

O ciclo é emitido na primeira sincronização da semana no fuso fixado da conta. Se a pessoa só entrar depois da segunda-feira, as novas metas começam naquele dia e se adaptam ao restante da semana. Não exigem recuperar faltas anteriores. Quando só restarem descansos, é emitida apenas uma missão de peso, adaptada à quantidade de dias restantes. Plano/consistência só são emitidos se houver treino obrigatório disponível.

Metas e recompensas são fixadas ao emitir o ciclo. Reabrir, trocar de aparelho, editar o cronograma ou mudar o relógio do celular não sorteia novas missões nem reduz metas já estabelecidas. Se a pessoa optar por proteger ou não realizar treinos depois da emissão, a missão de frequência ainda exige treinos realmente concluídos; não concede pontos por descanso. Plano/consistência continuam reconhecendo descansos válidos.

Os valores continuam em `gf_rules`: missões simples 10, plano 20, consistência 30 e bônus 50. O bônus usa o conjunto efetivamente emitido, inclusive em semana parcial, uma vez por ciclo. `economy_post` mantém o crédito atômico e a unicidade do extrato.

**Transição:** ciclos anteriormente emitidos mantêm suas quatro missões, metas e recompensas até o encerramento. Não são apagados ou recriados. O aplicativo explica essa exceção em “Como funciona”; os próximos ciclos usam a nova seleção. Isso preserva o progresso e evita conceder novamente recompensas por trocar a lista.

O frontend aceita os contratos antigo e novo. Os helpers de emissão são privados; apenas o RPC autenticado calcula o dia do servidor e emite o ciclo, com bloqueio da conta para impedir duplicidades entre dispositivos. Nenhuma tabela pública nova ou serviço externo é necessário.

Validação: `npm test`, `npm run build` e `bash scripts/test-gamification-db.sh`. As suítes SQL usam PostgreSQL descartável sem rede e cobrem quatro variações, metas alcançáveis, semanas parciais, descansos, proteção, reagendamento, metas fixas, fusos, recompensas únicas, compatibilidade com quatro missões antigas e concorrência real entre dois dispositivos. Não executar fixtures em produção.

A ativação foi ensaiada antes em PostgreSQL descartável com ciclos antigos. Em produção, uma transação única comparou hashes e contagens das 35 tabelas existentes, preservou as definições das funções não relacionadas e registrou o conteúdo exato da migração. Não criou ciclos ou recompensas. A conferência somente de leitura, concluída em **18/10/2026**, confirmou o registro, os hashes das funções, as permissões e as recompensas configuradas. Não foram feitos testes com gravações em contas reais.
