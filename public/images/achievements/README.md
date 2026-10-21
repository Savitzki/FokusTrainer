# Imagens das conquistas

Envie as artes oficiais das conquistas e medalhas nesta pasta.

[Adicionar imagens pelo GitHub](https://github.com/Savitzki/capibora/upload/main/public/images/achievements)

- Prefira PNG ou WebP com fundo transparente.
- Use nomes curtos, sem espaços e sem acentos, como `primeiro-treino.png` ou `consistencia-semanal.webp`.
- Mantenha a identidade flat 2D do Capibora e boa legibilidade em tamanhos pequenos.
- Envie somente artes finais, sem imagens provisórias.

Adicionar arquivos aqui não muda automaticamente as conquistas exibidas no aplicativo. A integração deve associar cada imagem ao identificador existente da conquista, preservando nomes, critérios, recompensas e histórico.

O catálogo definitivo tem 28 chaves em [achievementCatalog.json](../../../src/achievementCatalog.json). A correspondência visual é centralizada em `src/achievements.ts` (`ACHIEVEMENT_MEDAL_ART`), e o componente reutilizável é `AchievementMedal`. Veja [critérios e integração](../../../docs/CONQUISTAS.md). Até que cada arte seja associada explicitamente, o app usa o fallback flat; nenhum arquivo é presumido pelo título.

Na revisão 040 foram identificadas 19 artes, com 15 associações seguras em `src/achievementArt.json`. As cópias de entrega ficam em `web/<id-permanente>.webp`; os PNGs originais são preservados. Para regenerar essas cópias, execute `npm run prepare:images -- --achievements` com ImageMagick 7. Quatro artes sociais ainda precisam de confirmação de correspondência, e as nove artes de Consistência/Peso não foram encontradas; consulte a tabela por ID em `docs/CONQUISTAS.md`.
