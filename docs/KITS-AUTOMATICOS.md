# Kits Médicos no encerramento do dia

A migração incremental [031](../supabase/migrations/202610200031_automatic_medical_kits.sql) mantém a economia existente e acrescenta a proteção automática. Não cria treinos nem concede moedas ou pontos de ofensiva.

## Regra de consumo

- O usuário pode registrar o treino durante todo o minuto das **23:59**. O dia encerra às **00:00 no fuso fixado da conta**, determinado pelo servidor.
- Depois do encerramento, um dia obrigatório sem treino confirmado consome um kit disponível. Descansos programados, extras, origem de reagendamento, proteções existentes, dias sem plano e treinos concluídos não consomem outro kit.
- Uma compensação de reagendamento é uma obrigação normal: se ficar pendente, pode receber proteção.
- São **2 kits gratuitos por mês civil**, sem acumulação. O servidor usa os gratuitos do mês correspondente ao dia encerrado antes dos comprados. O fechamento do último dia do mês não gasta a cota do mês seguinte.
- Novas compras custam **350 CapiWhey**. Kits comprados não expiram e não possuem limite adicional de usos semanal ou mensal. Continua existindo somente uma proteção por dia.
- Compras feitas depois de um dia encerrar não podem salvar aquele dia. Um kit já consumido não pode ser reutilizado. O estoque e o histórico anterior permanecem preservados, incluindo compras de 50/250 e suas tentativas repetidas.
- O consumo manual continua disponível com confirmação, somente para hoje, seguindo as regras anteriores.

## Execução com o aplicativo fechado

O job `capibora-medical-kits-midnight` do **pg_cron** executa `process_medical_kit_rollovers()` a cada minuto. O instante exato depende do agendador: a proteção é um evento do fechamento do dia, e o horário real de processamento permanece registrado separadamente. Não há promessa de execução exatamente às 00:00:00.

A sincronização autenticada também realiza o fechamento pendente. Os cálculos de missões/relatórios/desafios e a consolidação dos grupos passam pelo mesmo fechamento antes de criar novos snapshots. O relógio do aparelho não autoriza consumo. A função global é privada para clientes e pode ser executada somente pelo serviço/agendador.

O trabalho é limitado a 500 contas por execução e 62 dias por conta para evitar transações excessivas. Havendo indisponibilidade prolongada ou concorrência, execuções seguintes continuam a partir do cursor persistido. Uma conta bloqueada por outra operação é adiada; um grupo não consolida resultados parciais enquanto um integrante precisa de fechamento. Isso evita deadlocks entre integrantes que atualizam simultaneamente.

## Histórico e grupos

A automação vale a partir do dia local de ativação da migração. Não resgata faltas anteriores, não altera treinos e não reescreve snapshots individuais já consolidados. As revisões das contas e carteiras são incrementadas quando há consumo.

Nos grupos, a proteção é considerada apenas se o encerramento do dia da conta ocorrer até o encerramento daquela data no fuso do grupo. Se o dia do grupo acabar antes, a proteção posterior da conta não reabre o resultado coletivo. Dias coletivos já consolidados, inclusive falhas registradas no cursor do grupo, permanecem imutáveis. Todos descansando/protegidos preservam a sequência sem acrescentar um ponto coletivo.

## Aviso na próxima abertura

O estado da carteira inclui os consumos automáticos ainda não lidos. Depois da consulta confirmada ao servidor, o aplicativo mostra as datas protegidas e informa que o kit não acrescenta pontos nem CapiWhey. Isso é um aviso **dentro do aplicativo**, sem criar um novo tipo de Web Push.

Ao fechar ou tocar em **Entendi**, `acknowledge_medical_kit_notice` registra a leitura somente dos itens da própria conta. Repetir a confirmação é idempotente. Se a rede falhar, a janela fecha normalmente e o aviso pode reaparecer em uma próxima visita, até o servidor confirmar a leitura. Um cache não verificado não dispara o aviso.

## Formulários de treino

Registro e avaliação de treino não fecham ao tocar no fundo ou solicitar cancelamento nativo/Escape. Somente **X** descarta o formulário não enviado. Voltar entre perguntas permanece disponível. Durante uma gravação enviada ao servidor, X fica temporariamente desabilitado para evitar uma falsa indicação de cancelamento.

Na avaliação opcional do cronômetro, X descarta somente a avaliação: o treino já confirmado permanece válido. O cronômetro, mínimo de 35 minutos, expiração de 4 horas, fila offline e recompensas não mudam.

## Ativação e verificação

1. Executar `npm test`, `npm run build`, `bash scripts/test-profiles-db.sh` e `bash scripts/test-gamification-db.sh`. Os testes SQL usam PostgreSQL descartável, nunca contas reais.
2. Aplicar a **031 depois da 030**, em transação única, e registrar sua versão no histórico de migrações. Não reaplicar funções de migrações anteriores.
3. Conferir preço 350, concessão mensal 2, ACLs e o job ativo de minuto em minuto. Em ambientes sem pg_cron a migração mantém a recuperação ao abrir, mas é necessário configurar o agendador para proteção com o aplicativo fechado.
4. Publicar o frontend correspondente. Uma PWA antiga precisa fechar suas janelas e reabrir online para ativar o novo cache, sem apagar dados da conta.

Android/iPhone físicos, comportamento do botão Voltar nativo em cada fabricante e execução real do cron na próxima virada de dia exigem acompanhamento após a publicação. Testes de navegador e SQL não substituem esses ensaios físicos.

## Validação desta entrega

- `npm test`: **711 testes em 74 arquivos**, sem falhas.
- `npm run build`: concluído, com o aviso de tamanho do bundle principal acima de 500 kB.
- `test-profiles-db.sh` e `test-gamification-db.sh`: passaram em PostgreSQL 17 descartável. A nova suíte cobre preservação da migração, consumo único, dias elegíveis/ineligíveis, virada de mês, estoque gratuito/comprado, compra antiga e preço 350, fusos, snapshots, privacidade e concorrência real.
- Chromium com APIs sintéticas: **10 cenários**, temas claro/escuro e larguras 320/375/430 px. Escape/fundo/X, descarte de respostas, aviso automático, leitura persistente, preço na Loja e avaliação opcional do cronômetro passaram, sem overflow horizontal ou erros de console.
- A transação administrativa foi ensaiada em banco descartável. A **031 foi aplicada ao Supabase autorizado em 19/10/2026**, com comparação de hashes preservando registros em 22 tabelas e funções não relacionadas. Nenhuma conta ou atividade real foi utilizada para testes. O histórico da migração conserva o SQL aplicado.
