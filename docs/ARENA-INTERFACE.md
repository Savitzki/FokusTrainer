# Arena

A Arena organiza os fluxos sociais existentes em **Grupos**, **Amigos** e **Desafios**, sem criar destinos na navegação inferior.

## Organização

- **Grupos:** nome, ofensiva, estado do dia e resumo dos participantes. O card inteiro abre os detalhes. Convites aparecem primeiro e são aceitos ou recusados nos detalhes.
- **Detalhes do grupo:** ofensiva atual, recorde, progresso coletivo, participantes, corrida e horários no fuso do grupo. Regras e ação de encerramento permanecem acessíveis em “Regras e ações do grupo”. A ação existente de sair encerra o grupo para todos; essa regra não mudou.
- **Descanso coletivo:** mantém a lista de participantes e a explicação do descanso, sem ranking, horários ou barra de progresso.
- **Amigos:** linhas compactas, pedidos recebidos, pedidos enviados, busca por nick e compartilhamento por código. Medalhas continuam respeitando o compartilhamento autorizado pelo amigo. A criação de grupo com um amigo reutiliza o formulário atual.
- **Desafios:** resumos de desafios ativos; filtro compacto para encerrados. Classificação, participantes, regras e respostas a convites ficam no detalhe expansível. O formulário de criação e a restrição opcional a treinos cronometrados permanecem disponíveis.

Grupos é a aba inicial. A última seleção fica na memória da sessão de navegação da conta, inclusive ao sair da Arena e voltar; uma nova sessão começa em Grupos. Desafios só monta na primeira visita à aba e permanece montado enquanto a Arena está aberta, preservando rascunhos e evitando consultas por cada alternância.

As setas esquerda/direita, Home e End alternam as abas com foco correspondente. Os detalhes de desafio usam `details`/`summary` nativos. As áreas de ação têm ao menos 44 px de altura, com foco visível e sem animações obrigatórias; o deslocamento existente respeita movimento reduzido.

## Dados e compatibilidade

Reutilizados: `useSocial`, `useGameResource`, `rankGroupMembers`, `Initials`, `FriendMedals`, formulários e RPCs existentes. Os detalhes consultam o grupo pelo identificador no estado atual, acompanhando a sincronização sem copiar um snapshot desatualizado para a interface.

Não há migração, alteração de RPC, regra de ofensiva, critérios de empate, recompensas, notificações ou alteração de dados históricos. O resumo apresenta o status fornecido pelo estado real; não deduz uma interrupção histórica a partir do número zero. Resultados de desafio ausentes aparecem como “Sem resultado ainda”. As fotos de amigos não estão disponíveis no contrato social atual; são usados os avatares de iniciais existentes.

Falhas de atualização continuam mostrando o estado previamente carregado e o botão de nova tentativa. A disponibilidade dos desafios mantém a feature flag existente.

## Verificação

```sh
npm test
npm run build
```

`SocialPanel.test.tsx`, `ChallengesPanel.test.tsx` e os testes de gamificação cobrem abas/teclado, detalhes, convites, criação, estados vazios, falha de atualização, rascunhos, empates, descansos e histórico.

Validação adicional em Chromium mobile com todas as chamadas ao Supabase simuladas: 320, 360, 390 e 430 px, temas claro e escuro; grupos com dois e oito participantes, nomes longos, corrida em andamento, descanso coletivo, dia concluído, criação de grupo, amizade, medalhas, criação/aceite/histórico de desafios e retorno à última aba. No exemplo de dois participantes a altura do resumo passou de aproximadamente 339 px para 119 px.

Os testes de interface não gravam dados reais. Não foram necessárias execuções de SQL para esta alteração. A aparência final e os leitores de tela em aparelhos físicos Android/iPhone ainda precisam de validação nesses dispositivos.
