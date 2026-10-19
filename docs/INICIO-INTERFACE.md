# Interface da página inicial

A Home apresenta somente **treino de hoje → progresso semanal → metas da semana**, além do cabeçalho compartilhado e dos avisos operacionais necessários (por exemplo, um registro aguardando sincronização). Não cria outro painel de estatísticas.

## Cabeçalho

A logo oficial continua à esquerda. À direita, três acessos compactos:

- **Ofensiva:** contagem real e estado da chama; abre Treinos no calendário do mês atual. O recorde permanece no perfil e no título do chip.
- **CapiWhey:** saldo confirmado pelo servidor, abre a Loja. No Início, a legenda visual fica oculta, mantendo ícone e número; o nome continua no rótulo acessível. Números grandes são abreviados visualmente, com o saldo completo no nome acessível. O símbolo usa a arte oficial existente em `brand/web/capibora-symbol.webp`; não há um asset exclusivo de moeda no repositório.
- **Perfil:** avatar e comportamento anteriores. Compartilhar ofensiva foi realocado para o perfil, sem remover o compartilhamento.

CapiWhey é a identificação visual desse saldo no cabeçalho. Os IDs, tabelas, preços, recompensas, inventário, transações e demais nomes de itens não mudam.

## Treino de hoje e resumos

O card mantém frase contextual com fonte maior e quebra natural de linhas, mascote ampliada e alinhada ao texto, registro manual/cronometrado, retomada da sessão e confirmação com horário no fuso da conta. “Registrar treino” exibe somente um ícone e o texto; o fluxo abre o [registro centralizado](REGISTRO-DE-TREINOS.md#apresentação-do-registro). Não contém botões permanentes de descanso ou Kit Médico.

`homeDayPresentation` continua selecionando os textos segundo o estado real. Descanso, proteção, reagendamento e treino voluntário preservam suas classificações. As regras de confirmação, duração e ofensiva não foram alteradas.

`WeeklyTrainingProgress` vem imediatamente depois do card. Reutiliza `weeklyTrainingProgress`, com semana de **segunda-feira a domingo**, versões históricas de planos, descansos e reagendamentos. A meta é a obrigação efetiva do período, não um cinco fixo; treinos voluntários não aumentam esse cumprimento. Mostra concluídos, total, percentual, barra e saldo restante.

`WeeklyGoals` permanece depois do progresso. Mantém contagens, metas, prazo e acesso aos detalhes, inclusive metas históricas. Não há mudanças em emissão ou recompensas.

Foram retirados da Home o resumo separado de ofensiva, o bloco “Seu progresso” e os indicadores de dias ativos, peso e tempo treinado. Perfil, Peso e relatórios em Treinos continuam disponíveis. Não foram removidos registros ou funcionalidades do sistema.

## Proteção contextual após 23h

`useHomeProtection` pode sugerir uma proteção quando:

- O usuário está na Home, com conexão, tela visível e sem outro modal.
- Há uma ofensiva positiva a preservar e treino obrigatório ainda pendente.
- Não há sessão cronometrada ativa nem registro manual aguardando confirmação.
- Há descanso extra disponível ou kit disponível dentro dos limites atuais.
- O relógio indica **23:00 até antes das 00:00 no fuso fixado da conta**, e as datas do cronograma e da economia correspondem ao dia atual.

Antes de abrir a sugestão, atualiza cronograma, economia, treinos sociais e sessão pelas consultas existentes. Uma falha não produz sugestão baseada apenas no cache. Respostas atrasadas de outra conta ou de uma consulta interrompida são ignoradas. As condições são reavaliadas após a atualização; treino confirmado, descanso válido ou virada de dia retiram a sugestão.

O modal informa o encerramento às **00:00** e oferece somente os benefícios disponíveis. “Usar Kit Médico” abre a confirmação existente com regras e consumo definitivo. “Descansar hoje” abre a confirmação existente de descanso. Fechar não consome nada, não registra falta e silencia a sugestão daquele dia na aba/PWA atual (`sessionStorage`, separado por conta). Outras janelas/aparelhos podem apresentar sua própria sugestão; a transação no servidor continua protegendo contra consumo duplicado.

A hora local é somente um gatilho de apresentação. O servidor permanece responsável por validar data, autenticação, estoque, sobreposições e consumo. Não há uso retroativo, alteração do encerramento do dia ou concessão automática de proteção. A sugestão funciona com o app aberto; não é uma nova notificação push ou serviço em segundo plano. Descanso e kit seguem acessíveis em Treinos e na Loja.

## Arquivos e verificação

- `src/App.tsx`, `src/styles.css`: organização, cabeçalho e modal contextual.
- `src/CapiWheyToken.tsx`: apresentação do símbolo oficial no saldo.
- `src/useHomeProtection.ts`: elegibilidade temporal, consulta prévia e dispensa por dia/conta.
- Testes: `App.home.test.tsx`, `App.home-protection.test.tsx`, `useHomeProtection.test.tsx`, além dos testes de navegação, registro e Loja afetados.

Validação desta entrega: `npm test` passou em **551 testes, 63 arquivos**, e `npm run build` passou. Não há migração, nova RPC ou mudança no banco de produção.

A revisão de navegador usa contas e respostas simuladas, sem gravações em contas reais. Valida oito estados (pendente, concluído, descanso, voluntário, kit, extra, reagendamento e sugestão noturna), dois temas, 320/360/390/430 px e fontes 100%/200%: 128 combinações. Android/iPhone físicos e tecnologias assistivas nesses aparelhos continuam dependendo de validação nos dispositivos.
