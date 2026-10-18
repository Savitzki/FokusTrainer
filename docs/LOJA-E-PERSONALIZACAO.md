# Loja e personalização

## Vitrine

A Loja reutiliza a carteira de potes de proteína, os Kits Médicos, o extrato e o inventário permanentes existentes. O resumo mostra saldo, estoque e gratuitos em uma linha; as regras do kit ficam recolhidas. Comprar um kit ou cosmético exige confirmação antes da escrita no servidor. O histórico permanece recolhido e mantém a paginação e os saldos após cada movimentação.

“Do seu jeito” tem quatro categorias: Molduras, Cards, Temas e Emojis, em grade de duas colunas. Somente o seletor de categorias pode rolar horizontalmente. A prévia abre os detalhes; falta de saldo aparece somente ali. Estados comprado, equipado e bloqueado vêm do Supabase. Equipar um item já adquirido não custa potes. Não existem pagamentos ou transferências.

## Catálogo

Preços ficam em `gf_items`; o frontend não envia valores de compra. Os seis produtos existentes mantêm IDs e preços. A migração 026 adiciona 31 produtos:

| Categoria | Novos itens | Preços iniciais |
| --- | --- | --- |
| Molduras | Energia, Noturna, Neon, Hardcore, Delicada, Capibora, Fera, Vitória, Realeza | 100 ou 250 |
| Cards | Impacto, Noturno, Amanhecer, Fera, Gelo, Minimal, Capibora | 150–250 |
| Temas | Capibora, Energia, Progresso, Power | 200–250 |
| Emojis | Chama, Força, Respeito, Aplausos, Energia, Foco, Campeão, Avante, De olho, Missão cumprida, Parceria | 30–60 |

A moldura Vitória exige a conquista Quatro semanas e custa 250 potes após o desbloqueio. Os bloqueios existentes permanecem. O card Clássico e os modos Claro/Escuro continuam incluídos, sem compra. As variações de tema são permanentes na conta; o modo claro/escuro mantém a preferência existente por aparelho.

## Imagens enviadas

[Enviar novas imagens no GitHub](https://github.com/Savitzki/FokusTrainer/upload/main/public/images/shop).

Os nove PNGs originais enviados pelo usuário permanecem intactos em `public/`. Cópias WebP de 512 px, com transparência, ficam em `public/images/shop/frames`: aproximadamente 720 KB no total, em vez de 14,5 MB dos originais. A PWA pré-carrega as cópias otimizadas e não pré-carrega esses originais ou os READMEs.

| Arquivo original | Moldura |
| --- | --- |
| energy.png | Energia |
| royal.png | Noturna |
| thunder.png | Neon |
| knockout.png | Hardcore |
| pink-power.png | Delicada |
| blaze.png | Capibora |
| beast.png | Fera |
| champion.png | Vitória |
| king.png | Realeza |

`frameImage` e `Avatar` aplicam a mesma arte ao avatar real na Loja, no perfil, no topo e no compartilhamento. Os previews dos cards usam `createShareImage`, o mesmo renderer da exportação, incluindo a moldura equipada. As miniaturas aceitam zero dias para representar a conta atual; exportar uma conquista continua exigindo ofensiva positiva. Não se inventa um treino para gerar a prévia.

Enviar novos arquivos não cria produtos automaticamente: é preciso incluir um produto no catálogo do servidor e seu renderer/mapeamento no cliente. Categorias e produtos desconhecidos não são exibidos como itens utilizáveis.

## Emojis e reações

Comprar um emoji desbloqueia seu uso permanente. Equipar escolhe o favorito, exibido primeiro no seletor. Nos detalhes de um grupo ativo, “Reações aos treinos” permite escolher um emoji adquirido para um treino confirmado de hoje, no fuso do grupo. Cada participante tem uma reação por treino: repetir é idempotente, escolher outra substitui e remover apaga somente a própria reação.

Não existem mensagens livres, emojis arbitrários, recompensas por reagir ou alterações de ofensivas, posições ou resultados. O servidor exige perfil, participação aceita, alvo no mesmo grupo e treino confirmado. O catálogo fechado limita as reações a opções previamente aprovadas.

## Banco, segurança e compatibilidade

Aplicar `202610180026_shop_showcase.sql` depois da 025. A migração amplia as categorias existentes, adiciona produtos e cria `group_workout_reactions`, com RLS e acesso exclusivamente por RPC autenticada.

- Compras continuam usando `buy_cosmetic`, `economy_post`, locks da conta e chave única de inventário; uma compra repetida não debita novamente.
- `equip_cosmetic` também aceita a categoria emoji, sem mudar os estoques existentes.
- `get_group_reactions` e `set_group_reaction` não concedem moedas nem alteram treinos.
- O novo catálogo é solicitado com `get_gamification_state(p_timezone, p_shop_version: 2)`.
- A assinatura antiga e `gf_cosmetics_state` continuam retornando os seis produtos compatíveis com PWAs antigas. O helper privado `gf_shop_catalog_state` retorna o catálogo completo. Não há overload com argumento opcional ambíguo.

Isso permite publicar o banco antes do frontend sem quebrar o parser das PWAs ainda abertas. Após publicar, fechar todas as janelas do app permite ativar o novo service worker. As novas compras e itens aparecem após a atualização.

O app mantém invalidações de economia e gamificação após compra/equipamento. Reações usam o recurso social e os mecanismos existentes de retomada, reconexão e comunicação entre abas; não foi adicionado polling ou Realtime.

## Verificação e ativação

```sh
npm test
npm run build
bash scripts/test-gamification-db.sh
```

A suíte SQL usa PostgreSQL descartável e inclui `shop-showcase.sql` e `test-shop-concurrency.sh`: preços antigos, quatro categorias, bloqueios, saldo insuficiente, repetição de compra, equipamento persistente, isolamento, RPCs/RLS, reações e dois dispositivos simultâneos. Não executar fixtures em produção.

Os testes de componentes cobrem confirmação, botões, falta de saldo, categorias, previews, temas, equipamento, kit e reações. A validação em Chromium mobile cobre 320, 360, 390 e 430 px em ambos os temas, sem escrever em contas reais. Aparelhos físicos e leitores de tela Android/iOS ainda precisam de conferência manual.

Para ativar em outro ambiente: revisar/aplicar a migração 026 com autorização administrativa, executar a compilação e publicar os arquivos Vite com as imagens otimizadas. No GitHub Pages deste projeto, o push em `main` publica automaticamente. Não é necessário configurar serviços externos adicionais.
