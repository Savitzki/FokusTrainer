# Capibora — ilustrações oficiais

Esta pasta ainda não contém ilustrações aprovadas. O aplicativo exibe somente a marca tipográfica e textos enquanto os assets não forem disponibilizados; não há imagem substituta da mascote.

Arquivos esperados, conforme a expressão disponível: `capibora-neutral`, `capibora-judging`, `capibora-suspicious`, `capibora-happy`, `capibora-resting`, `capibora-tired`, `capibora-celebrating`, `capibora-impatient`, `capibora-running`, `capibora-training`.

Preferir SVG sem scripts ou WebP/PNG transparente otimizado. Capivara com faixa esportiva, flat 2D, cores sólidas, contornos consistentes, legível a 48–80 px. Não usar 3D, texturas realistas ou gradientes complexos. Não enviar arquivos com nomes de exemplo sem a arte oficial correspondente.

Após enviar um arquivo real, registrar seu caminho relativo em `src/mascotAssets.ts`, por exemplo `mascot/ARQUIVO-REAL.svg`. Não apontar para arquivos ausentes. Caminhos relativos preservam a publicação na subpasta atual.

Animações são opcionais: exigem uma imagem estática equivalente, `animatedSrc` e `durationMs`. O componente só inicia quando solicitado, volta à imagem estática em até 2,5 segundos e respeita movimento reduzido. A animação deve ser curta e preparada para uma execução. Erros removem a ilustração sem afetar a ação ou o texto.

O ícone “C” é a marca tipográfica do aplicativo; não representa uma mascote provisória. Avatares e molduras dos usuários são independentes.
