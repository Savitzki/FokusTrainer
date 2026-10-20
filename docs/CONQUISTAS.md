# Conquistas do Capibora — catálogo de 28

Implementação preparada para revisão. **A migração 032 não foi aplicada em produção e esta entrega não ativa pagamentos por conquistas.**

A referência editorial é o [arquivo aprovado](conquistas_capibora_contextos_raridades.txt), conservado integralmente. Os textos e metadados estruturados estão em [achievementCatalog.json](../src/achievementCatalog.json). Testes comparam os títulos, descrições e raridades literalmente com o arquivo, além de conferir o catálogo SQL.

## Catálogo

| ID permanente / medalKey | Título aprovado | Categoria | Raridade | Objetivo |
| --- | --- | --- | --- | ---: |
| `workout-1` | Primeira chama | Treinos | Comum | 1 |
| `workout-5` | Olha quem apareceu | Treinos | Comum | 5 |
| `workout-10` | Pegou gosto pela coisa | Treinos | Rara | 10 |
| `workout-25` | Já virou rotina | Treinos | Rara | 25 |
| `workout-30` | Compromisso firmado | Treinos | Rara | 30 |
| `workout-50` | Metade de um monstro | Treinos | Épica | 50 |
| `workout-100` | É uma MÁAAAAQUINAAAAA | Treinos | Lendária | 100 |
| `workout-200` | KIBISURDO 200tão é coisa vi? | Treinos | Lendária | 200 |
| `workout-365` | UM MONSTROOOOOO | Treinos | Lendária | 365 |
| `week-1` | Duvido que consiga | Consistência | Comum | 1 |
| `week-2` | Não foi sorte | Consistência | Comum | 2 |
| `week-4` | Quatro semanas de respeito | Consistência | Rara | 4 |
| `week-8` | Já é compromisso | Consistência | Rara | 8 |
| `week-10` | Consistência de respeito | Consistência | Épica | 10 |
| `week-20` | Disciplina de ferro | Consistência | Lendária | 20 |
| `streak-3` | Acendeu a chama | Ofensiva | Comum | 3 |
| `streak-7` | Não apaga mais? | Ofensiva | Rara | 7 |
| `streak-14` | Fogo no parquinho | Ofensiva | Épica | 14 |
| `streak-30` | Inapagável | Ofensiva | Lendária | 30 |
| `record` | Meu novo máximo | Superação | Épica | 1 |
| `weight-1` | Encarei a balança | Peso e acompanhamento | Comum | 1 |
| `weight-7` | De olho na evolução | Peso e acompanhamento | Rara | 7 |
| `weight-30` | Tudo anotadinho | Peso e acompanhamento | Épica | 30 |
| `friend` | Primeira parceria | Social | Comum | 1 |
| `group` | Chama em equipe | Social | Comum | 1 |
| `collective` | Vitória em equipe | Social | Rara | 1 |
| `collective-3` | Três vezes melhor | Social | Épica | 3 |
| `group-streak-7` | Juntos na sofrência | Especial | Rara | 7 |

Os objetivos são medidos conforme os critérios abaixo; `record` é um evento de superação, não uma contagem de dias. As descrições permanecem exatamente as aprovadas e aparecem integralmente na listagem.

## Correspondência dos 12 IDs anteriores

Nenhum ID, desbloqueio ou data é removido. Somente os metadados do catálogo são atualizados. Datas de novas conquistas reconhecidas por histórico correspondem ao momento de reconhecimento, sem inventar a data exata do evento passado.

| ID preservado | Nome anterior | Título aprovado |
| --- | --- | --- |
| `workout-1` | Primeira chama | Primeira chama |
| `workout-10` | Pegou ritmo | Pegou gosto pela coisa |
| `workout-30` | Compromisso | Compromisso firmado |
| `workout-100` | Centenário | É uma MÁAAAAQUINAAAAA |
| `workout-365` | Ano de atitude | UM MONSTROOOOOO |
| `week-1` | Semana cumprida | Duvido que consiga |
| `week-4` | Quatro semanas | Quatro semanas de respeito |
| `week-10` | Consistência de respeito | Consistência de respeito |
| `record` | Meu novo máximo | Meu novo máximo |
| `friend` | Primeira parceria | Primeira parceria |
| `group` | Chama em equipe | Chama em equipe |
| `collective` | Vitória em equipe | Vitória em equipe |

## Critérios do servidor

- **Treinos:** linhas confirmadas de `workout_days` cujo `gf_day` esteja concluído e classificado como `training` ou `compensatory`. Treinos voluntários, descanso, kits sem treino e sessões inacabadas não contam. Os marcos são acumulados, sem exigir sequência de 365 dias.
- **Consistência:** semanas encerradas e completas em `gf_weeks`, acumuladas mesmo quando não consecutivas. O plano pode ter 1–7 dias. Versões, descansos e reagendamentos seguem os snapshots existentes. Para novos desbloqueios, exclui-se uma semana se um snapshot de dia estiver como Kit Médico sem treino concluído: proteção não comprova execução de uma obrigação. Não se altera `gf_weeks.fulfilled`, missões, relatórios nem medalhas antigas já obtidas por critérios anteriores.
- **Ofensiva:** `gf_streak(...).best`, a métrica oficial do servidor. Dias neutros preservam a sequência sem acrescentar pontos. A conquista permanece após uma quebra posterior.
- **Superação:** compara o melhor recorde ao `gf_accounts.record_baseline` original. Um baseline já registrado nunca é substituído. Se ainda não existir, a primeira avaliação cria a referência e não concede a conquista apenas pelo recorde anterior. `progress` é nulo para esse evento.
- **Peso:** união de datas distintas válidas de `weight_entries` e dos registros legados não apagados em `weight_logs`, até hoje no fuso fixado. Dez pesagens na mesma data contam uma vez. Nenhum valor de peso entra nos dados compartilhados das medalhas.
- **Social:** amizade com status `accepted`, participação aceita em grupo e a função original `gf_collective_wins`. Esta conta desafios coletivos distintos, não cancelados, com resultado consolidado, objetivo cumprido e participação aceita. Convites pendentes, desafios abertos e participação sem conclusão não contam.

O progresso retornado é limitado ao objetivo de cada medalha e deriva desses dados do servidor. O estado de conquista e a data vêm de `gf_badges`, cuja chave única `(user_id,key)` continua impedindo duplicatas. A primeira leitura do catálogo ampliado pode reconhecer histórico comprovável, sem crédito financeiro. Desbloqueios já existentes mantêm inclusive seu atributo `historical`.

## Juntos na sofrência — participação comprovada

O estado antigo dos grupos não registrava quando cada pessoa aceitou o convite. A 032 cria somente a auditoria necessária:

- `gf_badge_memberships`: início e fim de cada participação aceita. Integrantes atuais são registrados a partir da ativação, sem inventar uma adesão antiga. Sair e retornar abre outra participação.
- `gf_badge_group_points`: um ponto observado por integrante/data, quando o servidor insere um `group_days` que realmente soma à ofensiva coletiva e tem ao menos dois membros. Dias neutros não acrescentam pontos.
- Sete pontos acompanhados precisam pertencer à **mesma participação e à mesma sequência válida do grupo**. Dias neutros existentes em `group_days` mantêm a sequência; uma data ausente a interrompe, conforme a lógica oficial `social_streak`.
- A pessoa precisa estar aceita antes do evento ou do encerramento daquela data no fuso do grupo. Um snapshot inserido tardiamente não atribui participação a quem entrou depois do fim do dia.
- Entrar em um grupo que já tem sete ou mais pontos não concede progresso anterior. Sete novos pontos acompanhados podem qualificar a pessoa; não é necessário criar outro grupo.
- O sétimo ponto registra uma qualificação permanente em `gf_badge_group_qualifications`, sem bloquear contas de outros integrantes. Na próxima sincronização da própria conta, a conquista é reconhecida com a data real dessa qualificação, mesmo se o grupo tiver sido removido antes da leitura. Ela continua obtida mesmo após sair do grupo. Convites não aceitos não criam evidência.

Não se alteram composição, capacidade, permissões, resultados ou cálculo da ofensiva coletiva. Não há backfill de participações anteriores nem reescrita de `group_days`. Esse é o único marco cujo passado não pode ser reconhecido sem evidência suficiente.

## Raridades e medalhas oficiais

Raridade é um campo real de `gf_badge_catalog`: `common`, `rare`, `epic`, `legendary`. A interface mostra Comum/Rara/Épica/Lendária e usa cobre, prata, dourado e dourado com laranja, com tokens próprios para claro/escuro. Cor não é a única indicação.

`medal_key`/`medalKey` é independente do título e permanece igual ao ID estável. O mapa central **`ACHIEVEMENT_MEDAL_ART` em `src/achievements.ts`** possui as 28 chaves. Os valores começam nulos. `AchievementMedal` usa um fallback vetorial flat, sem emoji e sem requisitar arquivos inexistentes. Se uma arte configurada falhar, o fallback continua funcionando.

As artes oficiais devem ficar em **`public/images/achievements/`**. Exemplo de integração quando o arquivo aprovado realmente existir:

```ts
ACHIEVEMENT_MEDAL_ART["workout-100"] = "images/achievements/workout-100.webp";
```

Preferir PNG/WebP transparente, proporções preservadas e dimensões otimizadas. Os arquivos já enviados à pasta não são associados automaticamente por semelhança do nome: o catálogo definitivo precisa de uma correspondência visual aprovada. Não foram geradas nem inventadas imagens nesta entrega.

## Interface e privacidade

O Perfil mantém o resumo das três conquistas recentes e o editor existente. Dentro dele, um seletor filtra as sete categorias. Cada medalha apresenta título e descrição aprovados, raridade, estado, progresso quando disponível e data. Seleções permanecem ao trocar o filtro e o limite continua sendo três medalhas já conquistadas.

A seleção só é salva pela operação existente `set_featured_medals`. `get_friend_showcase` conserva a exigência de amizade aceita e o compartilhamento opt-in. Retorna apenas as medalhas destacadas e seus metadados visuais, na ordem selecionada; não inclui progresso privado, valores de peso, e-mail ou fatos utilizados no cálculo. O mesmo componente visual atende à lista própria, ao resumo e às medalhas compartilhadas.

O cliente permanece compatível com cache e backend antigos sem raridade/progresso. Um estado identificado como `catalogVersion: 2` precisa conter os 28 IDs e os metadados aprovados; respostas incompletas ou reescritas são recusadas.

## Economia e segurança

`reward_amount` é reservado com padrão e restrição **zero**. Nenhum gatilho de moedas, regra de CapiWhey, preço, carteira, inventário ou recompensa existente é alterado. Ativar uma política financeira futura exigirá outra decisão e migração explícita.

As tabelas de auditoria usam RLS e não concedem leitura/escrita direta aos clientes. Helpers e gatilhos são privados; o acesso continua pelas RPCs autenticadas existentes. O processamento serializa pela conta, mantém as chaves únicas e não altera `earned_at` em reenvios. A migração recusa um catálogo prévio com IDs inesperados, em vez de apagá-los silenciosamente.

## Ativação pendente

1. Revisar e autorizar a [migração 032](../supabase/migrations/202610200032_achievement_catalog.sql), depois da 031. **Não foi executada no Supabase de produção.**
2. Aplicar uma única vez e conferir 28 linhas, raridades, RLS, privilégios e a preservação de `gf_badges`, destaques e baseline. Não reaplicar migrações antigas.
3. Publicar o frontend correspondente depois da ativação do catálogo. O código antigo continua lendo os IDs anteriores; o novo cliente aceita o contrato anterior durante a transição, sem fabricar novos desbloqueios localmente.
4. Os marcos históricos comprováveis são reconhecidos na próxima sincronização autenticada. A participação coletiva começa a ser acompanhada somente após a ativação.
5. Adicionar as artes e preencher o mapa quando a correspondência visual estiver aprovada.

Nenhuma etapa de ativação ou teste nesta entrega autoriza distribuir CapiWhey retroativo.

## Verificações executadas

- `npm test`: **722 testes em 75 arquivos**, sem falhas. A suíte específica foi executada novamente após os ajustes finais de apresentação e passou.
- `npm run build`: concluído. Permanece o aviso de bundle principal acima de 500 kB (aproximadamente 518 kB, 159 kB gzip); não foram adicionadas bibliotecas.
- `bash scripts/test-profiles-db.sh`: passou em PostgreSQL 17 descartável.
- `bash scripts/test-gamification-db.sh`: passou antes e depois da 032. Inclui o catálogo literal, todos os marcos, 24/25, semanas acumuladas, planos de 1/7 dias, kits/extra/reagendamento, recorde com falta posterior, datas distintas de peso, consentimento e resultados sociais, rastreamento coletivo, privacidade e isolamento.
- Concorrência real entre conexões: um desbloqueio por ID, datas imutáveis, nenhuma moeda e captura do sétimo ponto sem bloqueio da conta de outro integrante. A qualificação também sobrevive à remoção do grupo antes da primeira leitura.
- Contratos anteriores de missões, recompensas, conquistas, relatórios, desafios, confirmação manual/cronometrada e planos flexíveis foram executados novamente **depois** da migração. Uma asserção antiga do teste de cronômetro passou a verificar o usuário do teste, em vez de contar recompensas de todas as contas do banco descartável.
- Chromium local com APIs sintéticas: **10 cenários**, temas claro/escuro, 320/375/430/1024 px, categorias, teclado, textos exatos, progresso, fallback, destaques antigos/novos e texto ampliado. Sem overflow horizontal ou erros de console. Em 320 px a listagem usa uma coluna para acomodar títulos longos.

Os testes não executaram SQL, registraram dados nem enviaram notificações em produção. Android/iPhone físicos não foram testados. O marco coletivo futuro foi simulado com dados descartáveis; nenhuma data ou participação de usuário real foi alterada.

## Arquivos da entrega

- `docs/CONQUISTAS.md`
- `docs/conquistas_capibora_contextos_raridades.txt`
- `scripts/test-achievements-concurrency.sh`
- `src/AchievementMedal.tsx`
- `src/achievementCatalog.json`
- `src/achievements.test.tsx`
- `src/achievements.ts`
- `supabase/migrations/202610200032_achievement_catalog.sql`
- `supabase/tests/achievement-catalog-legacy-setup.sql`
- `supabase/tests/achievement-catalog.sql`
- `README.md`
- `public/images/achievements/README.md`
- `scripts/test-gamification-db.sh`
- `src/ChallengesPanel.tsx`
- `src/GamificationPanels.tsx`
- `src/gamification.ts`
- `src/styles.css`
- `supabase/tests/gamification-achievements.sql`
- `supabase/tests/workout-recording.sql`
