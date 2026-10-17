# Moedas e Kit Médico

Requer as migrações 001–009 e [010](../supabase/migrations/202610170010_coins_and_medical_kits.sql). Mantém React, TypeScript, Supabase, os componentes de diálogo e os estilos atuais.

## Como usar

Entre na conta e toque no ícone de moeda no topo. A carteira mostra saldo, estoque de kits, loja, movimentações com data/hora e saldo após cada lançamento. O extrato carrega 20 registros por página, com acesso às páginas anteriores. Em **Treinos → Kits Médicos**, a mesma carteira pode ser acessada sem voltar ao início. O calendário continua mostrando a programação semanal e identifica proteções com o ícone de kit.

| Evento | Moedas |
| --- | ---: |
| Primeira confirmação online do treino na data atual da conta | +10 |
| Primeiro peso válido inserido na data atual da conta | +2 |
| Compra de um Kit Médico | −50 |
| Uso de um kit | 0 |

Uma recompensa por tipo e data, associada à conta. Com a migração 011, podem existir várias pesagens na mesma data; somente a primeira elegível rende moedas. Treinos voluntários em descanso podem render moedas uma vez, mas não pontos de ofensiva. Reenvios, conflitos, edições, exclusão/reinserção de pesos e mudanças de nick/avatar não rendem moedas. Novas pesagens são imutáveis, sem edição ou exclusão; os marcadores de exclusão da versão antiga continuam preservados. Um marcador vazio inserido primeiro também não rende moedas ao ser editado depois.

Os saldos começam em zero. A migração não distribui moedas por registros existentes; editar ou reenviar esses registros não gera crédito. Importações de datas passadas e pesos que só chegam ao servidor após o encerramento da sua data permanecem no histórico, sem moedas. O relógio e o fuso fixado na primeira sincronização da conta determinam a data válida.

## Proteção da ofensiva

- Um kit custa 50 moedas e protege **somente hoje**, antes do encerramento do dia no fuso da conta. A interface pede confirmação de consumo.
- Não existe proteção retroativa ou futura. Faltas anteriores, recordes e dias coletivos encerrados não são recalculados.
- A proteção mantém a ofensiva sem somar pontos, individualmente e nos grupos. O usuário continua podendo treinar voluntariamente depois; o kit não é devolvido e esse treino não acrescenta um ponto à ofensiva.
- Descanso programado, descanso extra já autorizado ou treino já confirmado impedem o consumo. Repetir a solicitação no mesmo dia é idempotente.
- Cada item possui identidade e registro de compra, data e horário de uso. Há até **2 usos por semana**, de segunda a domingo no fuso fixado da conta. O estoque não expira na virada da semana.
- A cota de kits é independente dos dois descansos extras já existentes. A programação continua limitada a dois descansos programados, com alterações somente a partir de amanhã.
- Nos grupos, a proteção vale para a mesma data, desde que aplicada antes de terminar o dia no fuso do grupo. Ela não dá posição na disputa diária. Se todos estiverem protegidos ou descansando, o dia mantém a sequência coletiva sem somar pontos.

## Banco, regras e consistência

A configuração central está na linha única de `public.economy_rules`: `workout_reward`, `weight_reward`, `kit_price`, `weekly_kit_limit`. Somente acesso administrativo pode alterar essa linha; o app recebe e exibe os valores do servidor. Recompensas zero desativam aquele crédito. Alterações de preço e recompensa afetam apenas operações novas; valores anteriores permanecem gravados no extrato. Não há estrutura de metas compatível neste momento; nenhum bônus de meta é concedido automaticamente.

`coin_wallets` guarda saldo e revisão; `coin_movements` é o extrato; `medical_kits` guarda cada item e sua utilização. O extrato registra ganho/gasto, valor, descrição, data da atividade, horário do servidor e saldo resultante. Somar seus lançamentos reconstitui o saldo. As proteções também são expostas em `get_training_state`, fazendo os cálculos locais e os grupos usarem a mesma classificação.

Recompensas são geradas por triggers de inserção dos registros aceitos no servidor, na mesma transação. Uma chave única por conta/tipo/data impede duplicação. Compras usam identificador de tentativa persistido por conta no aparelho e reutilizado após timeout, até a confirmação. O extrato permite reconhecer uma compra já concluída ao reabrir a carteira. Saldo e inventário nunca são alterados de forma otimista pelo navegador.

Operações de escrita seguem a ordem de bloqueio conta → carteira → item. Restrições impedem saldo negativo, múltiplos usos do mesmo item e duas proteções na mesma data. Todas as tabelas novas têm RLS; visitantes e usuários comuns não acessam tabelas nem helpers diretamente. RPCs usam `auth.uid()` e não aceitam uma conta arbitrária. O wrapper de peso preserva o contrato anterior e fixa as datas no fuso da conta. Caches pessoais e identificadores de compras pendentes são removidos no logout; respostas atrasadas são descartadas.

## Validação e configuração

- `npm test`: ofensivas, descansos, mudanças futuras de programação, continuidade entre semanas, compra/uso na interface, falhas, repetição após timeout/reload, isolamento após logout e paginação.
- `npm run build`: TypeScript e produção/PWA.
- `bash scripts/test-profiles-db.sh`: PostgreSQL 17 descartável; migração reaplicável, recompensas válidas, duplicatas, edições/deleções, contas legadas, falta de saldo, compra idempotente, kits, cotas, fusos, grupos, histórico, RLS e operações simultâneas. Não usa dados reais nem envia mensagens.

A migração 010 foi aplicada no projeto atual em **17/10/2026**. A verificação das RPCs foi revertida por rollback e confirmou RLS nas quatro tabelas novas, bloqueio dos helpers e ausência de acesso anônimo. Contagens e hashes de contas, perfis, pesos, treinos, grupos, dias coletivos, programações e descansos existentes permaneceram idênticos. Em outro projeto, aplique a migração 010 depois das anteriores. Nenhum provedor novo, chave de pagamento, compra de moedas ou pagamento real foi adicionado. O envio externo de push continua dependendo da configuração própria já documentada.

Validação desta entrega: **180 testes do app** passaram; compilação de produção/PWA, suíte PostgreSQL 17 completa e cenários concorrentes passaram. Chromium móvel com API simulada validou ambos os temas em 320–390 px: compra, falta de saldo, uso único do kit, calendário, manutenção da ofensiva, treino +10, peso +2, edição +0 e persistência após recarregar. Nenhum e-mail, push ou pagamento real foi enviado.
