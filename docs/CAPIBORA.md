# Capibora

Capibora incentiva uma rotina de movimento com treinos, amigos, desafios e pequenas vitórias. A ofensiva permanece como um recurso de motivação. A arquitetura React/TypeScript/Vite e os sistemas existentes de Supabase, treinos, planejamento, recompensas, grupos e sincronização foram reutilizados.

## Marca e sistema visual

O nome público mudou na interface, autenticação, carregamento, compartilhamentos, notificações, instalação, três manifestos PWA, título do navegador, metadados e documentação do usuário. A paleta mantém carvão, marrom, branco quente e laranja. O destaque passou de `#cf470c` para `#cf4909`, com texto de destaque mais quente e tokens semânticos para sucesso, erro e recompensas. O laranja principal mantém contraste de texto branco de pelo menos 4,5:1.

Ícones Lucide, controles segmentados, modais, formulários, avatares, molduras e os modos claro/escuro continuam os mesmos. As imagens de personalização já compradas são preservadas. Itens cujo nome público era “Fokus” aparecem como “Capibora”, mantendo IDs, preço, inventário e histórico de transações intactos.

## Linguagem contextual

O catálogo central está em `supabase/functions/_shared/capibora.ts`, compartilhado pelo frontend e pelo serviço de Web Push. Cada fala tem identificador, contexto, condições, expressão, canto de apresentação e texto. A expressão combina com a fala e a capivara pode ocupar quatro cantos do card, em células reservadas do layout. A posição permanece estável durante a visita e não cobre botões ou mensagens; sessões ativas mantêm o acesso ao cronômetro em largura integral. `capiboraVoice.ts` expõe o catálogo para a interface.

- Treino obrigatório pendente: provocação curta, sem humilhação.
- Treino concluído: celebração curta junto de “Treino registrado” e seu horário.
- Descanso válido ou proteção: mensagem tranquila, sem cobrança.
- Retorno após ausência: mensagem discreta de recomeço. O contexto usa apenas datas confirmadas e a classificação já existente do cronograma; não recalcula a ofensiva.
- Competição: uma fala competitiva exige participação aceita e posição real, além de ausência de descanso válido. Nenhuma posição é inventada; não há cobrança social genérica na Arena.
- Cadastro, perguntas manuais e compra: frases curtas, sem substituir confirmação, erro ou instrução funcional.

A seleção do Início fica estável durante a visita, evita repetir a última fala do mesmo contexto ao reabrir e usa a limpeza de armazenamento da conta já existente. O nome preferido continua sendo usado ocasionalmente, sem gírias regionais ou tratamento forçado.

O registro manual mantém exatamente duas perguntas sorteadas, a confirmação final obrigatória de 35 minutos, IDs de perguntas, três respostas positivas e contrato de servidor. Apenas a redação mudou. Uma resposta negativa não é transmitida nem gera registro, falta imediata ou recompensa. O cronômetro, sua validação online, expiração e avaliação opcional permanecem inalterados.

## Telas

- **Início:** treino de hoje e sua ação primeiro; resumo menor de ofensiva, recorde e compartilhamento; semana efetiva; indicadores e metas. Uma sessão ativa abre “Voltar ao treino” no card. Nenhum cálculo mudou.
- **Treinos:** cronômetro, registro manual, interrogatório, calendário, descansos e reagendamentos preservados; linguagem e identidade visual atualizadas.
- **Arena:** Grupos, Amigos e Desafios, resumos e detalhes compactos preservados. Convites e mensagens de compartilhamento usam Capibora. Não há alteração de capacidade, permissões ou resultados.
- **Loja:** categorias, previews, compra, equipamento, Kits Médicos e extrato preservados. Compra confirmada pode mostrar a expressão feliz; ela não interfere no processamento.
- **Perfil:** avatares e personalizações pertencem ao usuário. A mascote não substitui o avatar.
- **Configurações e cadastro:** mesma organização e etapas, textos mais curtos, nome público e contexto da marca atualizados.

## Logos e mascote oficiais

Os arquivos enviados pelo usuário em `public/brand/` e `public/mascot/` foram preservados. Cópias menores em `web/` removem apenas margens transparentes e ajustam resolução/formato. Não foram criadas ilustrações substitutas.

`Brand.tsx` usa o logo oficial, acompanha o tema e mantém o nome textual se a imagem falhar. O símbolo oficial com fundo laranja aparece no carregamento inicial, a 128 px. No tema claro, um fundo carvão mantém o contraste do logo com letras claras. O símbolo oficial é usado no favicon e nos PNGs de instalação, mantendo seus caminhos anteriores. A versão maskable usa o mesmo logo com fundo laranja, dentro da área segura.

`Mascot.tsx` usa somente os arquivos cadastrados em `mascotAssets.ts`, com carregamento sob demanda, dimensões reservadas, descrição decorativa silenciosa e remoção discreta em caso de erro. Início, cadastro, interrogatório e compra possuem pontos de integração. A ausência de um asset não ocupa espaço nem impede ações.

Seis imagens oficiais foram integradas:

| Origem | Contexto |
| --- | --- |
| `neutro.png` | neutro e retorno |
| `julgando.png` | julgamento, suspeita e impaciência |
| `feliz.png` | conclusão e compra |
| `chill.png` | descanso e proteção |
| `wink.png` | celebração |
| `determinado.png` | treino em andamento e incentivo |

As seis cópias para interface somam cerca de **106 KB**, contra **4,44 MB** dos originais. As três cópias dos logos somam cerca de **49 KB**, contra **2,11 MB**. A mascote não entra no pré-cache obrigatório; os logos otimizados e ícones essenciais entram. A navegação offline continua disponível mesmo sem imagem da mascote.

Ainda não há animações oficiais nem poses específicas de corrida/cansaço. O componente já aceita um arquivo animado acompanhado de imagem estática e duração limitada a 2,5 segundos, apenas quando solicitado. Movimento reduzido mantém a imagem estática. Não há animação de mascote em loop permanente nem bibliotecas novas.

[Enviar logos](https://github.com/Savitzki/FokusTrainer/upload/main/public/brand) · [Enviar expressões](https://github.com/Savitzki/FokusTrainer/upload/main/public/mascot).

## Compatibilidade

Permanecem intactos: nome do repositório, endereço público `/FokusTrainer/`, URLs de autenticação, ID/escopo/start URL da PWA, chaves `fokus-trainer:*` e `fokus-push:*`, tags de deduplicação, IDs de cosméticos, contratos RPC, tabelas, contas e dados. Não há migração nem reset de preferência, saldo ou histórico.

O nome e o ícone de uma instalação existente são atualizados pelo navegador/sistema no seu próprio ciclo. Não é necessário recriar contas ou apagar o armazenamento. A atualização do service worker continua aguardando o fechamento das janelas antigas. O nome externo exibido no consentimento do Google é administrado no Google Cloud, separadamente do código; suas URLs de retorno devem continuar as mesmas.

## Verificação e publicação

```sh
npm test
npm run build
```

A suíte cobre marca, metadados, continuidade da instalação, cache, nomes, contexto das falas, não repetição, limpeza por conta, mascote ausente, erro de imagem, movimento reduzido, duração de animação, retorno ao registro manual e todos os sistemas existentes. Testes Deno do `push-dispatch` e `group-notify` verificam autorização, destinatários, revalidação, deduplicação e criptografia Web Push.

A revisão visual em Chromium usa Supabase simulado, sem dados reais: 320, 360, 390 e 430 px; dois temas; fonte raiz em 100%/200%; estados do Início, seis páginas, perfil, autenticação e registro manual. A aparência de instalações Android/iPhone e leitores de tela físicos ainda exige conferência nos dispositivos.

Publicar `main` utiliza o workflow existente do GitHub Pages. O novo texto dos lembretes automáticos exige publicar somente a função `push-dispatch` existente, mantendo `verify_jwt = false` e a autenticação privada por `x-cron-secret`; não alterar segredos nem disparar o cron para testar com usuários reais. Não são necessárias operações SQL. A função `group-notify` e as regras de entrega não precisam de alteração.

### Arquivos principais

- Marca e voz: `src/brand.ts`, `src/brandAssets.ts`, `src/Brand.tsx`, `src/capiboraVoice.ts`, `src/useCapiboraVoice.ts`, `src/motivation.ts` e `supabase/functions/_shared/capibora.ts`.
- Mascote: `src/Mascot.tsx`, `src/mascotAssets.ts`, fontes oficiais e derivados em `public/mascot/` e `public/brand/`.
- Interface: `src/App.tsx`, `src/homeDayPresentation.ts`, `src/styles.css`, `src/SyncFeedback.tsx`, `src/AccountForm.tsx`, `src/ManualWorkoutInterrogation.tsx`, `src/manualConfirmation.ts`, `src/AppearanceSettings.tsx`, `src/NotificationOptIn.tsx`, `src/PushPanel.tsx`, `src/SocialPanel.tsx`, `src/GroupWorkoutPrompt.tsx`, `src/ProfilePanel.tsx`, `src/profile.ts`, `src/WorkoutCalendar.tsx`, `src/CosmeticShop.tsx`, `src/useEconomy.ts`, `src/main.tsx`.
- Compartilhamento: `src/SharePanel.tsx` e `src/sharing.ts`.
- Instalação/cache: `index.html`, `public/manifest*.webmanifest`, `public/icon.svg`, `public/icons/`, `public/sw.js`, `scripts/build-sw.mjs`.
- Lembretes: somente textos de `supabase/functions/push-dispatch/core.ts` e respectivo teste.
- Testes: novos `src/Capibora.test.tsx` e `src/Mascot.test.tsx`; ajustes nos testes existentes de Início, marca, motivação, cadastro, compartilhamento, loja, cache, navegação, carregamento e notificações.
- Documentação: este guia, README, guias de instalação, banco, Google, moedas, push, Loja, interface inicial e Android/PWA; URLs e identificadores técnicos mantidos.

### Resultados da validação desta versão

- `npm test`: **447 testes aprovados em 53 arquivos**.
- `npm run build`: compilação TypeScript/Vite e geração de cache PWA concluídas.
- Deno: **14 testes aprovados**, cobrindo `push-dispatch` e `group-notify`.
- Chromium: **240 combinações de layout do Início**, com 15 estados, dois temas, quatro larguras e fonte em 100%/200%; **96 combinações das seis páginas e quatro do perfil**.
- Quatro cantos da mascote: **64 combinações explícitas**, sem sobreposição de imagem, texto ou ação; contraste do botão principal verificado em pelo menos 4,5:1 nos dois temas.
- Cadastro/login: oito cenários de largura/tema, com as quatro etapas existentes e texto ampliado; nenhum cadastro real criado.
- Registro: seis cenários, incluindo manual, cronometrado, cancelamento e expiração nos dois temas; confirmações e recompensas simuladas.
- Loja: oito cenários de largura/tema; previews reais, compra/equipamento, reações, Kit Médico, extrato e recarga, com servidor simulado.
- Compartilhamento: geração real de imagens Story e quadrada nos dois temas com o logo oficial.

As verificações de navegador usam Chromium com viewport móvel e Supabase simulado. Não equivalem a testes em um Android/iPhone físico, leitor de tela ou entrega real de push. Não foram executadas migrações nem alterados registros de usuários para validar o rebranding.


## Ampliação da mascote e nome do projeto

A mascote do Início passou de 64 px para 112–136 px. A imagem e a frase dividem a primeira linha, com o botão principal ocupando toda a largura abaixo. Os quatro alinhamentos continuam disponíveis e estáveis durante a visita. Os títulos repetidos foram removidos; descanso, proteção, reagendamento e treino compensatório continuam identificados. Explicações repetidas saíram da apresentação visual, preservando a descrição acessível; o treino voluntário informa que não soma pontos extras.

A ordem agora é treino de hoje, ofensiva, Sua semana, indicadores e metas. `Brand` aceita a variante `symbol`, usada no carregamento, com o mesmo arquivo oficial que os ícones da PWA. Os arquivos originais foram mantidos e os WebP da mascote passaram a 320 px para acompanhar o tamanho maior. O nome do pacote local passou a `capibora`; as chaves de armazenamento e sessões continuam intactas.

A renomeação remota para `Savitzki/Capibora` foi solicitada à API do GitHub, mas a integração retornou **403 — Resource not accessible by integration**. Até a renomeação administrativa, repositório, URL pública e Site URL do Supabase continuam em `/FokusTrainer/`. O workflow de Pages agora calcula a URL pelo nome real do repositório. O Supabase já permite também o retorno `https://savitzki.github.io/Capibora/`, preservando o retorno anterior. Nenhuma tabela, conta ou registro foi alterado.

Após renomear em Settings → General → Repository name, publicar novamente e conferir o novo endereço. Atualizar também `.env.production`, o Site URL do Supabase e os links de documentação para a URL confirmada. O Google continua usando o mesmo callback do Supabase. Instalações PWA antigas precisam ser verificadas: o escopo/start URL muda com a subpasta e pode exigir reinstalação pelo novo endereço; os dados da conta permanecem no servidor.
