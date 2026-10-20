# Arena

A Arena organiza os fluxos sociais existentes em **Grupos**, **Amigos** e **Desafios**, sem criar destinos na navegação inferior.

## Organização

- **Grupos:** banner compacto “Seu grupo”, com a ofensiva real recebida do servidor, arte oficial da Capibora e avatares com indicadores de situação. Não apresenta um banner de um convite ainda não aceito. A lista mostra nome, estado do dia, avatares e ofensiva em uma linha. O item em destaque corresponde ao banner. O card inteiro abre os detalhes. Ao voltar, o banner acompanha o último grupo consultado; se ele desaparecer após sincronizar, utiliza outro grupo disponível. Convites continuam acessíveis na lista e são aceitos ou recusados nos detalhes.
- **Detalhes do grupo:** ofensiva atual, recorde, progresso coletivo, participantes, corrida e horários no fuso do grupo. Regras e ação de encerramento permanecem acessíveis em “Regras e ações do grupo”. A ação existente de sair encerra o grupo para todos; essa regra não mudou.
- **Descanso coletivo:** mantém a lista de participantes e a explicação do descanso, sem ranking, horários ou barra de progresso.
- **Amigos:** linhas compactas, pedidos recebidos, pedidos enviados, busca por nick; usar/compartilhar código fica em Adicionar amigo → Convites por código. Medalhas continuam respeitando o compartilhamento autorizado pelo amigo. A criação de grupo com um amigo reutiliza o formulário atual.
- **Desafios:** contador dos ativos aceitos e resumos com tipo, progresso, participantes e prazo. Convites pendentes ficam em uma seção própria somente quando existem; o filtro compacto mantém os encerrados separados. Classificação, participantes, regras e respostas a convites ficam no detalhe expansível. O formulário de criação e a restrição opcional a treinos cronometrados permanecem disponíveis.

Grupos é a aba inicial. A última seleção fica na memória da sessão de navegação da conta, inclusive ao sair da Arena e voltar; uma nova sessão começa em Grupos. Desafios só monta na primeira visita à aba e permanece montado enquanto a Arena está aberta, preservando rascunhos e evitando consultas por cada alternância.

As setas esquerda/direita, Home e End alternam as abas com foco correspondente. Os detalhes de desafio usam `details`/`summary` nativos. As áreas de ação têm ao menos 44 px de altura, com foco visível e sem animações obrigatórias; o deslocamento existente respeita movimento reduzido.

## Dados e compatibilidade

Reutilizados: `useSocial`, `useGameResource`, `rankGroupMembers`, `Avatar`, `ArenaAvatar`, `ArenaGroupBanner`, `Mascot`, `FriendProfile`, formulários e RPCs existentes. Os detalhes consultam o grupo pelo identificador no estado atual, acompanhando a sincronização sem copiar um snapshot desatualizado para a interface.

Não há migração, alteração de RPC, regra de ofensiva, critérios de empate, recompensas, notificações ou alteração de dados históricos. O resumo apresenta o status fornecido pelo estado real; não deduz uma interrupção histórica a partir do número zero. Resultados de desafio ausentes aparecem como “Sem resultado ainda”. Fotos e molduras disponíveis no estado social utilizam o componente `Avatar`, inclusive quando nenhuma moldura está equipada. Nos desafios, reutilizam-se os dados já carregados da própria conta e dos amigos. Quando não há foto ou avatar disponível, são utilizadas as iniciais do nickname informado pelo servidor, sem nova consulta nem dados inventados. O catálogo oficial `mascotAssets` determina a arte do banner, separada de sua composição.

O progresso coletivo soma os treinos da classificação existente e usa a meta recebida do servidor. Consistência usa o percentual da própria classificação, sem recalculá-lo a partir do relógio ou do plano local. Resultados ausentes não geram uma barra. Frequência mostra a contagem de treinos válidos; não recebe uma barra com uma meta arbitrária. Pesos e demais informações privadas não são expostos.

A interface atual permite consultar medalhas compartilhadas, criar grupos e responder solicitações. Não existe ação de remover amizades ou uma página pública completa de perfil nesse fluxo; o redesign não acrescenta esses recursos.

Falhas de atualização continuam mostrando o estado previamente carregado e o botão de nova tentativa. A disponibilidade dos desafios mantém a feature flag existente.

## Verificação

```sh
npm test
npm run build
```

`SocialPanel.test.tsx`, `ChallengesPanel.test.tsx` e os testes de gamificação cobrem abas/teclado, detalhes, convites, criação, estados vazios, falha de atualização, rascunhos, empates, descansos e histórico.

Validação adicional em Chromium mobile com todas as chamadas ao Supabase simuladas: 320, 375, 430 e 1024 px, temas claro e escuro; grupos com dois e oito participantes, nomes longos, corrida em andamento, descanso coletivo, dia concluído, criação de grupo, amizade, medalhas, criação/aceite/histórico de desafios e retorno à última aba. Nesta revisão, o resumo de dois participantes passou de aproximadamente 119 px para 72 px. O banner ocupa aproximadamente 133 px nesse exemplo e não sobrepõe textos ou avatares. Os testes de unidade verificam dados reais do estado, descansos protegidos, reagendamentos, ausência de plano, seleção do banner, avatares sem moldura e métricas de cada tipo de desafio.

Os testes de interface não gravam dados reais. Não foram necessárias execuções de SQL para esta alteração. A aparência final e os leitores de tela em aparelhos físicos Android/iPhone ainda precisam de validação nesses dispositivos.

O build conclui com o aviso de tamanho do chunk principal (aproximadamente 501 kB antes de gzip). Não foram adicionadas dependências; a variação desta interface é de cerca de 3,4 kB antes de gzip. Não foi ampliado o escopo para refatorar o carregamento global do app.


## Perfil de um amigo

Na aba Amigos, o nome é um botão que abre o perfil em um modal centralizado e somente de leitura. O X no canto superior direito é a única ação de fechamento; tocar no fundo ou usar Escape não fecha. Ao sair pelo X, o foco retorna ao nome e a aba Amigos permanece selecionada. Logout ou remoção da amizade retiram o conteúdo privado, mesmo com o modal aberto.

A consulta reutiliza `get_friend_showcase(uuid)`, ampliada pela migração incremental **036 — `202610200036_friend_profile.sql`**. O servidor exige autenticação e amizade aceita; convites pendentes, amizades removidas e desconhecidos não têm acesso. A autorização da amizade fica protegida durante a transação. Não foram concedidas permissões novas de leitura direta de tabelas.

O retorno contém apenas nickname, nome de exibição escolhido no aplicativo, avatar, moldura e banner ativos, ofensiva atual, recorde e as três medalhas em destaque que o amigo autorizou compartilhar. E-mail, peso, preferências, saldo e fatos privados usados nas conquistas não são enviados. Sem cosméticos, utiliza a aparência gratuita. Medalhas privadas continuam ocultas.

A ofensiva vem de `gf_streak`, mantendo o fuso fixado da conta e as regras oficiais de descanso, reagendamento e proteção. Como nas consultas existentes, essa função pode executar o fechamento normal de dias e persistir snapshots imutáveis; não altera a regra de proteção automática nem cria recompensas. A visualização não oferece ações de edição.

A consulta acontece ao abrir o perfil, usa a deduplicação e a proteção de respostas atrasadas já existentes e mantém os dados apenas em memória. Não persiste o perfil de terceiros no localStorage. Remover amizade invalida também esse recurso; uma resposta de acesso negado oculta imediatamente os dados anteriormente carregados. Falhas apresentam tentativa de atualização sem bloquear o X.

### Ativação

1. Aplicar a migração 036 depois da 035, somente com autorização para produção. Não executar fixtures de teste em produção.
2. Publicar o frontend correspondente. A versão anterior do retorno (`nickname` e `badges`) continua aceita, mas banner, nome e ofensiva precisam da 036 para serem exibidos integralmente.
3. Conferir com contas destinadas a teste, respeitando a permissão de compartilhar medalhas. Não é necessária Edge Function, Cron, alteração de preço ou novo serviço.

Validação local desta extensão: `npm test`, `npm run build`, `bash scripts/test-arena-db.sh` e `bash scripts/test-gamification-db.sh`. As suítes SQL usam somente PostgreSQL descartável e verificam acesso, privacidade, cosméticos, pontos oficiais, idempotência e preservação financeira/histórica. Chromium com API simulada verifica 320, 375, 430 e 1024 px nos temas claro e escuro, assets reais, ausência de rolagem horizontal e erros de console, fechamento pelo X e restauração de foco. Android/iPhone físicos e leitores de tela nesses aparelhos não foram testados.


### Registro de ativação da migração 036

Aplicada em **20/10/2026**, após autorização do usuário para migrar e publicar. A implantação foi transacional, verificou a predecessora 035 e registrou o SQL completo em `supabase_migrations.schema_migrations`. A conferência posterior em leitura confirmou o corpo exato da função revisada, acesso restrito a autenticados e bloqueio de `anon`. As outras funções, permissões de tabelas, RLS e políticas permaneceram iguais. Nenhum teste foi executado sobre contas reais; a consulta de perfil não foi chamada em nome de usuários em produção durante essa validação. A publicação do frontend segue o workflow de GitHub Pages após o merge do PR #33.

## Avisos sociais (037)

Provocações deixam a seção permanente de Amigos e passam a avisos transitórios em todas as abas da Arena, com X e revide por ícone. O retorno é um modal global, com apenas uma resposta permitida por provocação. As preferências existentes ficam no menu de opções de um amigo. A foto aparece independentemente de moldura. Regras, limitações e ativação estão em [ARENA-EVOLUCAO.md](ARENA-EVOLUCAO.md#037--avisos-de-provocação-e-revide-único). A migração 037 e o serviço de push foram ativados mediante autorização em 20/10/2026; o resultado da publicação do frontend está registrado no [PR #34](https://github.com/Savitzki/capibora/pull/34).
