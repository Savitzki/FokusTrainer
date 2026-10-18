# Sincronização e carregamento

O Supabase continua sendo a fonte de verdade. Nenhuma regra de recompensa,
cronograma, confirmação de treino ou proteção foi transferida para o navegador.
Esta atualização não exige migração SQL nem configuração de Realtime.

## Estrutura

- `src/sync.ts`: dependências entre recursos, invalidação seletiva por conta,
  compartilhamento de consultas simultâneas e um único conjunto de listeners.
- `src/useSyncedResource.ts`: transporte dos hooks existentes; cache validado,
  timeout, preservação de dados e descarte de respostas antigas.
- `useTrainingPlan`, `useEconomy`, `useGamification`, `useWorkoutSession`,
  `useWeightSync`, `useSocial` e `useAccount`: mantêm seus contratos de domínio,
  validações, revisões e mecanismos de idempotência.
- `src/SyncFeedback.tsx`: chama inicial, indicador de atualização em segundo
  plano, feedback de falha e nova tentativa. Não há nova página de sincronização.

## Depois de uma gravação confirmada

| Operação | Dados revalidados |
| --- | --- |
| Treino manual ou cronometrado | Histórico/Arena, cronograma, carteira, missões/medalhas, relatórios, desafios e sessão |
| Descanso extra, programação ou reagendamento | Cronograma, Arena, missões/medalhas, relatórios e desafios |
| Uso do Kit Médico | Carteira/inventário, cronograma, Arena, missões/medalhas, relatórios e desafios |
| Compra de Kit Médico | Carteira, inventário e extrato |
| Peso confirmado | Peso, carteira, missões/medalhas e relatórios |
| Amizade ou grupo | Arena, conquistas e desafios |
| Desafio | Desafios, gamificação e carteira |
| Compra de cosmético | Inventário cosmético e carteira/extrato |
| Equipamento ou medalhas em destaque | Gamificação e exibição de medalhas |
| Avaliação de treino | Histórico e relatórios privados |
| Perfil | Perfil e preferências correspondentes |

Quando a RPC devolve um snapshot completo, o hook usa essa resposta e não faz
uma segunda leitura do próprio recurso. As revisões de carteira e programação
continuam impedindo a aplicação de versões inferiores. A revisão econômica
devolvida pela gamificação também invalida a carteira quando uma missão ou
conquista concede recompensa durante a consulta.

Escrever e consultar são resultados diferentes: se a escrita foi confirmada,
uma falha posterior não transforma a operação em fracasso. A interface informa
**“Operação concluída · atualização pendente”** e permite **Sincronizar**, que
repete consultas, sem repetir a compra ou a outra operação já confirmada.
Fechar um formulário durante a gravação não impede a invalidação após a resposta.

## Cache e estados visuais

Os snapshots ficam sob o prefixo da conta no `localStorage`, passam pelos parsers
existentes e são apresentados imediatamente quando válidos. A primeira abertura
sem dados essenciais mostra a chama enquanto perfil, programação e histórico
necessários à tela são consultados. Carteira, missões e outras consultas secundárias
não atrasam a liberação do início. Não há duração mínima nem porcentagem inventada.

Uma atualização com dados já disponíveis mantém a navegação liberada e mostra
um indicador discreto. Apenas ações conflitantes no recurso em gravação ficam
temporariamente indisponíveis. As animações respeitam `prefers-reduced-motion`.
O indicador de atualização não anuncia cada consulta ao leitor de tela; falhas
e o carregamento inicial usam mensagens acessíveis.

Uma falha conserva o último snapshot. Rede indisponível, autenticação expirada,
erro do servidor e validação de negócio são tratados separadamente. As consultas
e operações têm um prazo de 15 segundos para não prender o carregamento.
Um timeout de escrita pode ter resultado indeterminado: os identificadores
idempotentes existentes continuam sendo reutilizados. Não se presume que uma
operação foi desfeita só porque a resposta não chegou.

As sessões cronometradas **não** usam cache local como autoridade. Início,
finalização e duração válida continuam dependendo do servidor. A fila de pesos
e o rascunho manual offline existentes são preservados; dados pendentes não
geram saldo, confirmação ou ofensiva localmente.

## Retorno, conexão e outros dispositivos

Há revalidação das áreas relevantes quando:

- uma gravação termina;
- o documento volta de `hidden` para `visible`, mesmo após uma saída curta;
- a conexão retorna;
- uma área com dados antigos é aberta;
- outra aba da mesma conta anuncia uma alteração.

Eventos próximos de `focus`, `pageshow` e `visibilitychange` compartilham consultas
pendentes. Para eventos de foco sem uma saída real para segundo plano, snapshots
com menos de 15 segundos evitam leituras redundantes. O fallback de 60 segundos
que já existia foi reunido em um só timer, limitado aos recursos das áreas ativas,
com documento visível e conexão disponível. Listeners e timer são removidos ao
desmontar a última inscrição.

Não há assinatura Realtime. Uma alteração em outro celular aparece ao retomar,
reabrir uma área desatualizada ou pelo fallback visível; não existe promessa de
entrega instantânea com a PWA fechada. As regras de Web Push existentes permanecem
independentes. A aparência e preferências que já eram locais continuam locais.

## Segurança e concorrência

Cada consulta é identificada por conta, recurso, parâmetros, geração da sessão
e versão de invalidação. Consultas simultâneas equivalentes compartilham somente
a requisição pendente. Uma invalidação durante uma leitura agenda uma nova
consulta e descarta a resposta anterior. Mudanças de conta, logout e novo login
na mesma conta também invalidam respostas antigas, inclusive as de gravações.

O logout limpa os novos snapshots junto dos dados pessoais existentes; mantém
as proteções já existentes para não perder filas pendentes. Dados do servidor
não são inseridos no cache do service worker: ele continua cuidando dos arquivos
da aplicação. Todas as transações e permissões de banco continuam nas RPCs/RLS.

## Verificação e ativação

Execute `npm test` e `npm run build`. Os testes de sincronização cobrem cache,
carregamento, eventos da PWA, falhas, consultas concorrentes, respostas fora de
ordem, troca de conta, logout, recuperação e propagação entre hooks de domínio.
As regras financeiras e do calendário continuam cobertas pelas suítes existentes.

Para ativar, publique o `dist/` atualizado pelo fluxo existente do GitHub Pages.
A versão do cache de arquivos é gerada pelo build. Não é necessário alterar o
Supabase. Valide também em um aparelho Android/iPhone real: suspensão pelo sistema
e a interface nativa da PWA não são reproduzidas integralmente pelo Chromium
automatizado. Autenticação offline ainda depende de uma sessão local utilizável;
uma sessão expirada pode exigir internet para ser renovada.
