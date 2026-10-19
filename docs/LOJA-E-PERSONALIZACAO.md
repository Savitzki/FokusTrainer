# Loja e personalização

A vitrine tem somente **Molduras** e **Banners**, em seções verticais separadas. Cada produto ocupa uma linha compacta, com arte, nome, preço e ação. Os preços usam o ícone oficial e o valor. Ao tocar na imagem, o detalhe mostra apenas a arte do cosmético e a confirmação, sem simulação do perfil. A confirmação usa a operação de compra existente; saldo, inventário e histórico são atualizados a partir do Supabase. Equipar, trocar e remover itens adquiridos é gratuito.

## Catálogo atual

| Categoria | Item | Preço |
|---|---|---:|
| Moldura | Faixa Esportiva | 80 |
| Moldura | Onda Aquática | 150 |
| Moldura | Chama Viva | 250 |
| Moldura | Clássica | 450 |
| Banner | Entardecer Relax | 100 |
| Banner | Trilha na Floresta | 180 |
| Banner | Noite Ativa | 300 |
| Banner | Churrasco no Pátio | 250 |

Os preços são validados no servidor. `gf_inventory` garante propriedade permanente e `economy_post` mantém um débito por item/conta. Locks da conta serializam operações de dois dispositivos. Não há pagamentos, transferências nem compra de moeda com dinheiro.

## Artes e aplicação

Os oito PNGs oficiais estão em `public/images/shop/frames/` e `public/images/shop/banners/`; nomes e orientações estão no [guia de assets](../public/images/shop/README.md).

`FRAME_LAYOUT` em `src/cosmetics.ts` ajusta escala e posição à abertura transparente de cada moldura. Só a arte é deslocada: o avatar mantém sua caixa e formato circular. Perfil, cabeçalho, Arena e compartilhamento usam a mesma geometria. A Loja exibe a arte isolada. A moldura aquática usa escalas horizontal/vertical adequadas à abertura do PNG atual, mantendo a foto circular e centralizada. Alterar uma imagem exige conferir novamente o encaixe, incluindo o centro transparente.

Banners são capas horizontais do Perfil, atrás do avatar e das informações principais, com camada escura para legibilidade. Banners têm a categoria própria `banner`, independente de `share`. Falha ao carregar a imagem mantém a aparência padrão e bloqueia novas compras/equipamentos sem prévia; remover equipamento continua permitido.

## Carteira e itens antigos

O Kit Médico fica aberto abaixo da vitrine, com compra e uso acessíveis. O botão `?` à direita reúne as regras. A compra de cosméticos usa um botão visual `$`, com nome acessível completo e confirmação antes do débito. O extrato não aparece na Loja; movimentações e usos continuam persistidos, sem exclusão de registros. Valores, concessões mensais, uso e recompensas dos kits não mudaram.

A migração 030 desativa os 37 produtos anteriores. Não apaga inventário, equipamento, compras, saldos ou movimentações. Molduras antigas deixam de ser desenhadas e usam a aparência padrão; o registro de propriedade permanece. Compartilhamentos, temas e emojis adquiridos continuam reconhecidos. Reações antigas são visíveis aos integrantes autorizados, inclusive sem emojis adquiridos, e apenas os emojis já possuídos podem ser usados. Não há links para comprar emojis retirados da Loja.

## Banco e compatibilidade

Aplicar `202610190030_profile_cosmetics.sql` após a 029. A migração amplia as categorias de `gf_items` e `gf_equipped`, cadastra oito produtos, desativa os anteriores e acrescenta a aparência dos amigos/integrantes já autorizados ao estado social. Funções auxiliares são privadas; RLS, operações atômicas e autenticação são preservados.

O novo cliente usa `get_gamification_state(p_timezone, p_shop_version: 3)`. A versão 2 permanece disponível, filtrando a categoria `banner` que clientes antigos não sabem ler. Itens antigos só são retornados quando pertencem à conta. A migração pode ser aplicada antes da publicação do cliente sem quebrar seu parser.

Compras invalidam gamificação e economia; equipamento também atualiza a Arena e a área de medalhas. O sistema existente trata retomada, reconexão, cache e troca de conta. Não foi adicionado outro sistema de compra, polling ou Realtime.

## Validação e ativação

```sh
npm test
npm run build
bash scripts/test-profiles-db.sh
bash scripts/test-gamification-db.sh
```

As suítes SQL usam somente PostgreSQL descartável. Fixtures não devem ser executadas em produção. Os testes incluem migração com compras anteriores, preços exatos, catálogo de oito produtos, saldo insuficiente, idempotência, equipamento persistente, reações, isolamento, RLS e compras simultâneas de dois dispositivos.

Antes da ativação, conferir as imagens oficiais e o encaixe em 320, 360, 390 e 430 px, nos dois temas. Executar a migração autorizada e publicar o frontend correspondente. Em GitHub Pages, integrar na `main` inicia a publicação e substitui tentativas anteriores. Fechar e reabrir a PWA permite ativar o novo service worker. Aparelhos físicos e leitores de tela Android/iOS continuam dependendo de validação manual.
