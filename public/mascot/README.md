# Capibora — mascote oficial

As seis expressões enviadas pelo usuário estão preservadas nos PNGs originais. O app usa cópias WebP menores em `web/`, com transparência preservada e sem redesenhar a arte.

| Arquivo oficial | Contextos visuais |
| --- | --- |
| `neutro.png` | neutro, primeiro plano, cadastro e retorno |
| `julgando.png` | julgamento, suspeita e impaciência |
| `feliz.png` | treino confirmado e compra concluída |
| `chill.png` | descanso válido e proteção |
| `wink.png` | pequena celebração |
| `determinado.png` | treino em andamento e incentivo |

O registro central é `src/mascotAssets.ts`. Expressões compatíveis podem reutilizar o mesmo arquivo; isso não cria uma nova pose. Não há arte específica cadastrada para `tired` ou `running`, nem arquivos animados. Esses casos continuam sem imagem até receberem arquivos oficiais.

Novas imagens devem seguir o estilo flat 2D, com formas simples, cores sólidas e contornos consistentes, legíveis a 48–136 px. Preferir SVG sem scripts ou WebP/PNG transparente otimizado. Não usar 3D, texturas realistas ou gradientes complexos. Não publicar arquivos de exemplo sem a arte correspondente.

Animações exigem uma imagem estática equivalente, `animatedSrc` e `durationMs`. O componente só inicia quando solicitado, volta à imagem estática em até 2,5 segundos e respeita movimento reduzido. Não há loop permanente. Erros removem a ilustração sem afetar as ações ou o texto.

As imagens da mascote são carregadas sob demanda; não entram no pré-cache obrigatório da PWA. A navegação offline continua funcionando e imagens indisponíveis são ocultadas. Avatares e molduras dos usuários permanecem independentes.

[Enviar novas expressões pelo GitHub](https://github.com/Savitzki/capibora/upload/main/public/mascot).

No Início, a mascote ocupa de 112 a 136 px, com ações abaixo da imagem e da frase. Os WebP de 320 px preservam a nitidez em telas de alta densidade.
