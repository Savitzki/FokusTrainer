# Capibora — mascote oficial

As expressões enviadas pelo usuário estão preservadas nos PNGs originais. O app usa cópias WebP menores em `web/`, com transparência preservada e sem redesenhar a arte.

| Arquivo oficial | Contextos visuais |
| --- | --- |
| `neutro.png` | neutro, primeiro plano, cadastro e retorno |
| `julgando.png` | julgamento, suspeita e impaciência |
| `feliz.png` | treino confirmado e compra concluída |
| `chill.png` | descanso válido e proteção |
| `wink.png` | pequena celebração |
| `determinado.png` | treino em andamento e incentivo |
| `empolgada.png` | treino confirmado, conquistas e primeira comemoração (`excited`) |
| `deboa.png` | deboche, convite, registro e descanso (`smug`) |
| `tedio.png` | espera pelo treino e aviso de duração (`bored`) |
| `capi-sosa.png` | estado vazio de grupos, via `ArenaGroupBanner` |

O registro central é `src/mascotAssets.ts`. Expressões compatíveis podem reutilizar o mesmo arquivo; isso não cria uma nova pose. Não há arte específica cadastrada para `tired` ou `running`, nem arquivos animados. Esses casos continuam sem imagem até receberem arquivos oficiais.

Para regenerar somente as três novas cópias leves: `node scripts/prepare-web-images.mjs --mascot` (ImageMagick 7). Os PNGs não são modificados. O catálogo editorial de títulos, complementos e poses fica em `src/capiboraEditorial.json`; a seleção e a elegibilidade permanecem no contrato compartilhado existente.

Novas imagens devem seguir o estilo flat 2D, com formas simples, cores sólidas e contornos consistentes, legíveis a 48–136 px. Preferir SVG sem scripts ou WebP/PNG transparente otimizado. Não usar 3D, texturas realistas ou gradientes complexos. Não publicar arquivos de exemplo sem a arte correspondente.

Animações exigem uma imagem estática equivalente, `animatedSrc` e `durationMs`. O componente só inicia quando solicitado, volta à imagem estática em até 2,5 segundos e respeita movimento reduzido. Não há loop permanente. Erros removem a ilustração sem afetar as ações ou o texto.

As imagens usam carregamento lazy, com prioridade no banner do Início. As cópias em `mascot/web/` fazem parte do cache offline existente; os PNGs originais não são baixados pela interface. Imagens indisponíveis são ocultadas sem perder a mensagem. Avatares e molduras dos usuários permanecem independentes.

[Enviar novas expressões pelo GitHub](https://github.com/Savitzki/capibora/upload/main/public/mascot).

No Início, a mascote ocupa de 90 a 160 px conforme o espaço disponível, ao lado do título e complemento, com a ação abaixo da composição. Os WebP de 320 px preservam a nitidez em telas de alta densidade.

O contexto visual `dramatic` da tela “Não treinei hoje” usa temporariamente a arte oficial `julgando.webp`. Falta receber a ilustração flat 2D da Capibora fingindo estar caída/morta de maneira cartunesca (ou chorando exageradamente). Quando enviada, basta registrar sua cópia otimizada em `MASCOT_ASSETS.dramatic`; nenhum caminho inexistente é carregado hoje. Não há GIF ou animação dramática cadastrada.

A expressão `sad` está reservada no tipo `MascotPose` para a arte oficial triste/chorando de “Aceitar a derrota”. Ainda não há arquivo compatível no repositório: `Mascot` não renderiza uma imagem ausente. Quando a arte for fornecida, associar seu caminho real em `src/mascotAssets.ts`, preservando o original. A pose `dramatic` continua com o fallback oficial julgando até a entrega da arte dramática.
