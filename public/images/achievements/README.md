# Imagens das conquistas

Envie as artes oficiais das conquistas e medalhas nesta pasta.

[Adicionar imagens pelo GitHub](https://github.com/Savitzki/capibora/upload/main/public/images/achievements)

- Prefira PNG ou WebP com fundo transparente.
- Use nomes curtos, sem espaços e sem acentos, como `primeiro-treino.png` ou `consistencia-semanal.webp`.
- Mantenha a identidade flat 2D do Capibora e boa legibilidade em tamanhos pequenos.
- Envie somente artes finais, sem imagens provisórias.

Adicionar arquivos aqui não muda automaticamente as conquistas exibidas no aplicativo. A integração deve associar cada imagem ao identificador existente da conquista, preservando nomes, critérios, recompensas e histórico.

O catálogo definitivo tem 28 chaves em [achievementCatalog.json](../../../src/achievementCatalog.json). A correspondência visual é centralizada em `src/achievements.ts` (`ACHIEVEMENT_MEDAL_ART`), e o componente reutilizável é `AchievementMedal`. Veja [critérios e integração](../../../docs/CONQUISTAS.md). Até que cada arte seja associada explicitamente, o app usa o fallback flat; nenhum arquivo é presumido pelo título.
