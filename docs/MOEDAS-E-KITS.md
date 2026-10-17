# Potes de proteína e Kit Médico

O sistema inicial usa as migrações 001–009 e [010](../supabase/migrations/202610170010_coins_and_medical_kits.sql). A política mensal requer a [016](../supabase/migrations/202610170016_monthly_medical_kits.sql), após as anteriores. **A 016 foi autorizada e aplicada em produção em 17/10/2026.** Mantém React, TypeScript, Supabase e os componentes existentes.

## Como usar

Entre na conta e toque no **pote de proteína** no topo. Essa é a identidade visual da moeda virtual: um pote equivale a uma unidade do saldo existente. Não há conversão, pagamento real ou mudança de recompensa. A carteira mostra saldo, kits gratuitos e comprados, próxima renovação, loja e movimentações com data/hora e saldo após cada lançamento. Em **Treinos → Kits Médicos**, a mesma carteira pode ser acessada sem voltar ao início.

| Evento | Potes |
| --- | ---: |
| Primeira confirmação online do treino na data atual da conta | +10 |
| Primeiro peso válido inserido na data atual da conta | +2 |
| Compra de um Kit Médico | −250 |
| Uso de um kit | 0 |

Uma recompensa por tipo e data, associada à conta. Com a migração 011, podem existir várias pesagens na mesma data; somente a primeira elegível rende moedas. Treinos voluntários em descanso podem render moedas uma vez, mas não pontos de ofensiva. Reenvios, conflitos, edições, exclusão/reinserção de pesos e mudanças de nick/avatar não rendem moedas. Novas pesagens são imutáveis, sem edição ou exclusão; os marcadores de exclusão da versão antiga continuam preservados. Um marcador vazio inserido primeiro também não rende moedas ao ser editado depois.

Os saldos começam em zero. A migração não distribui moedas por registros existentes; editar ou reenviar esses registros não gera crédito. Importações de datas passadas e pesos que só chegam ao servidor após o encerramento da sua data permanecem no histórico, sem moedas. O relógio e o fuso fixado na primeira sincronização da conta determinam a data válida.

## Proteção da ofensiva

- Cada conta recebe **2 kits gratuitos por mês civil**, no fuso fixado da conta. São disponibilizados automaticamente ao consultar a carteira ou executar uma operação de kit no mês atual. Meses sem acesso não geram concessões retroativas.
- Os gratuitos **não acumulam**: sobras deixam de estar disponíveis na virada do mês, mas os registros de concessão e uso ficam preservados. Kits comprados **não expiram**. O servidor consome os gratuitos primeiro.
- Um kit extra custa **250 potes**. Compras e kits anteriores, inclusive os adquiridos por 50, permanecem válidos; nenhuma diferença de preço é cobrada retroativamente.
- Não há cota semanal de uso: enquanto houver estoque, pode proteger um treino obrigatório por dia. O item protege **somente hoje**, antes do encerramento do dia no fuso da conta. A interface pede confirmação de consumo.
- Não existe proteção retroativa ou futura. Faltas anteriores, recordes e dias coletivos encerrados não são recalculados.
- A proteção mantém a ofensiva sem somar pontos, individualmente e nos grupos. O usuário continua podendo treinar voluntariamente depois; o kit não é devolvido e esse treino não acrescenta um ponto à ofensiva.
- Descanso programado, descanso extra já autorizado ou treino já confirmado impedem o consumo. Repetir a solicitação no mesmo dia é idempotente.
- Cada item possui identidade, origem (compra ou concessão mensal), data de aquisição e, quando usado, data e horário de consumo.
- A concessão mensal é independente dos dois descansos extras e dos dois reagendamentos por semana. A programação permanece em cinco treinos e dois descansos, com alterações permanentes somente a partir de amanhã.
- Nos grupos, a proteção vale para a mesma data, desde que aplicada antes de terminar o dia no fuso do grupo. Ela não dá posição na disputa diária. Se todos estiverem protegidos ou descansando, o dia mantém a sequência coletiva sem somar pontos.

## Banco, regras e consistência

A configuração central está na linha única de `public.economy_rules`: `workout_reward`, `weight_reward`, `kit_price` e `monthly_free_kits`. A 016 define preço 250 e concessão 2, preservando as recompensas existentes. Somente acesso administrativo altera essa linha. Reaplicar a migração preserva alterações administrativas posteriores de preço e quantidade. `weekly_kit_limit` fica obsoleto e não limita o consumo. Não há bônus de metas ou dinheiro real.

Os nomes técnicos `coin_wallets` e `coin_movements` são mantidos: o saldo e o extrato continuam iguais após a troca de ícone/nome. `medical_kits` conserva as compras anteriores e adiciona `grant_month` e `grant_slot` para os gratuitos, com uma chave única por conta/mês/posição. A origem exige uma compra válida ou uma concessão mensal completa. Gratuitos não criam movimentações de moeda com valor zero. Sua disponibilidade é calculada pelo servidor sem apagar itens expirados.

`get_economy_state` retorna `monthlyKits`: mês, próxima renovação, quantidade concedida, gratuitos restantes e comprados disponíveis. `rules.kitUsageLimit = 'inventory'` indica a ausência de cota semanal. Para versões antigas já instaladas, o campo numérico `weeklyKitLimit` continua presente com 7, que é o máximo natural de uma proteção por dia na semana; isso não cria uma restrição adicional no servidor. O cliente novo continua lendo servidores anteriores sem inventar benefícios mensais antes da ativação.

As proteções continuam em `get_training_state`, fazendo os cálculos locais e os grupos usarem a mesma classificação. A expiração de um item gratuito nunca remove uma proteção já utilizada, altera uma ofensiva consolidada ou apaga o histórico.

Recompensas são geradas por triggers de inserção dos registros aceitos no servidor, na mesma transação. Uma chave única por conta/tipo/data impede duplicação. Compras usam identificador de tentativa persistido por conta no aparelho e reutilizado após timeout, até a confirmação. O extrato permite reconhecer uma compra já concluída ao reabrir a carteira. Saldo e inventário nunca são alterados de forma otimista pelo navegador.

Operações de escrita serializam pela conta e pela carteira, antes de conceder, comprar ou consumir um item. Restrições impedem concessão duplicada, saldo negativo e duas proteções na mesma data. Reenvios de compra usam o identificador original, inclusive quando o preço muda. Helpers de concessão/inventário são privados. RLS e RPCs baseadas em `auth.uid()` impedem visitantes e outras contas de acessar saldo ou estoque. O relógio do aparelho não define mês ou data de consumo. Caches pessoais e compras pendentes continuam sendo removidos no logout.

## Validação e configuração

- `npm test`: ofensivas, descansos, mudanças futuras de programação, continuidade entre semanas, compra/uso na interface, falhas, repetição após timeout/reload, isolamento após logout e paginação.
- `npm run build`: TypeScript e produção/PWA.
- `bash scripts/test-profiles-db.sh`: PostgreSQL 17 descartável; migração reaplicável, recompensas válidas, duplicatas, edições/deleções, contas legadas, falta de saldo, compra idempotente, kits, cotas, fusos, grupos, histórico, RLS e operações simultâneas. Não usa dados reais nem envia mensagens.

A migração 010 foi aplicada no projeto atual em **17/10/2026**. A verificação das RPCs foi revertida por rollback e confirmou RLS nas quatro tabelas novas, bloqueio dos helpers e ausência de acesso anônimo. Contagens e hashes de contas, perfis, pesos, treinos, grupos, dias coletivos, programações e descansos existentes permaneceram idênticos. Em outro projeto, aplique a migração 010 depois das anteriores. Nenhum provedor novo, chave de pagamento, compra de moedas ou pagamento real foi adicionado. O envio externo de push continua dependendo da configuração própria já documentada.

A suíte da 016 cobre: concessão idempotente, gratuitos consumidos sem reposição, expiração e renovação, viradas de ano/mês/ano bissexto, fuso fixado, compras antigas, preço 250, saldo insuficiente, preferência pelos gratuitos, uso sem cota semanal, descanso/treino já confirmado, proteção dos grupos, snapshots, histórico, RLS, concorrência de dispositivos e reaplicação sem resetar configurações administrativas. Os testes usam banco descartável; não criam contas nem alteram registros reais.

Nesta atualização, **256 testes do app em 36 arquivos**, compilação de produção/PWA e a suíte SQL completa passaram. Chromium local com API simulada conferiu os dois temas, o início sem rolagem em 320/390 px, navegação por ícones, salvamento 5/2 em Treinos, ordem das configurações, switch de aparência, compra por 250, cancelamento, consumo único priorizando os gratuitos e persistência após recarregar. Nenhuma alteração em dados reais foi usada nos testes.


## Atalhos e confirmação

O Início oferece **Descansar hoje** e **Usar kit** abaixo de Registrar treino, quando hoje é obrigatório e ainda não foi concluído/protegido. Os contadores mostram a cota de extras e o estoque. Sem kit, o atalho abre a carteira para consultar/comprar. Dias de descanso, proteção existente e treinos registrados não consomem outro benefício.

Antes de consumir, uma pergunta mostra as regras: protege só o dia obrigatório atual, mantém a ofensiva sem pontos/potes, não cobre faltas passadas e usa o estoque disponível. Informa a renovação mensal e a preferência pelos gratuitos. O kit não é devolvido se houver treino posterior. **Agora não** apenas fecha; **Usar 1 kit** confirma. Falhas mantêm o contexto para nova tentativa; saldo e estoque são atualizados apenas pelo servidor.

## Ativação da nova política

A migração 016 foi aplicada em uma transação única, com registro em `supabase_migrations.schema_migrations`. A comparação de quantidades e hashes confirmou a preservação de todas as tabelas de registros existentes, incluindo contas, saldos, compras, proteções e históricos. As novas colunas dos kits ficaram nulas nos itens anteriores; somente as regras solicitadas mudaram (preço 250, concessão mensal 2 e retirada da cota semanal). Recompensas e classificações anteriores de dias permaneceram iguais. Nenhum kit foi concedido durante a migração.

A verificação posterior foi executada em transação `READ ONLY`: regras, estado mensal, RLS, índice único, origem dos itens, permissões dos helpers e bloqueio de visitantes passaram. Nenhuma conta, compra, atividade ou concessão de teste foi criada no projeto real. A concessão começa na primeira sincronização autenticada do mês. O frontend foi autorizado para publicação pelo pipeline de `main`.

Em outro projeto, aplique somente a 016 após as anteriores e publique o frontend correspondente. Não reaplique 010/012: elas definem versões anteriores das funções.
