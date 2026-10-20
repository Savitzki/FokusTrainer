# Logos oficiais da Capibora

[Enviar arquivos pelo GitHub](https://github.com/Savitzki/capibora/upload/main/public/brand).

Preferir SVG ou PNG/WebP com fundo transparente. Sugestões de nomes:

- `capibora-logo-dark`: logo para o fundo escuro.
- `capibora-logo-light`: logo para o fundo claro, se houver uma versão diferente.
- `capibora-symbol`: símbolo quadrado para o ícone do aplicativo.

Esses são nomes sugeridos, não arquivos existentes. Envie somente as versões oficiais disponíveis, em estilo flat 2D. Os arquivos serão integrados após a revisão, preservando o nome acessível do app, os avatares dos usuários e os identificadores da PWA.

Ilustrações e expressões da mascote ficam em [public/mascot](../mascot/README.md).

## Arquivos recebidos e uso

- `capibora-text.png`: marca no cabeçalho do tema escuro.
- `capibora-text-light.png`: texto oficial do tema claro, transparente, sem fundo preto.
- `logo-full-capibora.png`: versão completa disponível para materiais da marca.
- `capibora-app-icon.png`: composição original anterior com fundo laranja, preservada sem alterações.
- `logo-capibora-sem-fundo.png`: capivara transparente utilizada no carregamento e como base dos ícones de instalação e favicon.

Os originais permanecem intactos. As cópias WebP em `web/` são usadas pela interface e registradas em `src/brandAssets.ts`. O preparo remove apenas margens transparentes e ajusta resolução/formato; não redesenha o logo. Os ícones PNG de instalação ficam nos caminhos anteriores de `public/icons/`, preservando a identidade da PWA e a atualização das instalações existentes.

Os ícones de instalação e o favicon têm fundo laranja sólido `#ff7900`. Somente as exportações do ícone recebem essa cor: carregamento, barras nativas e fundos da PWA continuam acompanhando o tema. A arte original permanece intacta.

Os manifestos agora apontam para arquivos com novos nomes físicos, evitando reutilizar URLs do ícone anterior:

- `public/icons/capibora-orange-v3-192.png`
- `public/icons/capibora-orange-v3-512.png`
- `public/icons/capibora-orange-v3-maskable.png` (igual nos dois temas)
- `public/icons/capibora-orange-v3-apple.png`
- `public/icons/capibora-orange-v3.svg`

A exportação remove margens transparentes e resíduos quase invisíveis do canvas (alfa até 15/255). A capivara ocupa 492 px de largura no ícone de 512 px, aproximadamente 14% maior. No adaptável do Android ocupa 364 px: a silhueta inteira fica dentro do círculo seguro de raio 204,8 px, inclusive o focinho e as orelhas. O Android pode aplicar um recorte circular ou quadrado arredondado sem cortar a mascote. Os caminhos anteriores continuam disponíveis para clientes existentes.

Para reproduzir as exportações mecânicas, executar `node scripts/prepare-app-icons.mjs` com ImageMagick 7 instalado. Nenhum original é redesenhado. ID, escopo e endereço de instalação permanecem iguais. Novos nomes permitem ao navegador detectar a mudança; uma instalação existente ainda depende do prazo de atualização do WebAPK/launcher, que a página não controla.

O pequeno ícone monocromático da barra Android é `public/icons/notification-badge.png`, derivado da silhueta da mascote oficial `neutro.png`, sem fundo colorido. É usado como `badge` nas notificações.

## Abertura do aplicativo

`logo-capibora-sem-fundo.png` é a arte oficial da tela de carregamento. O HTML inicial e o componente React usam a mesma cópia transparente otimizada, `web/logo-capibora-sem-fundo.webp` (400 × 398), pré-carregada e disponível no cache offline. O original permanece intacto.

O fundo da abertura acompanha o tema e as barras do sistema. A capivara transparente pulsa sobre esse fundo e esmaece em 240 ms ao liberar a interface pronta; movimento reduzido desativa os dois efeitos. A meta `theme-color`, `theme_color` e `background_color` dos manifestos, assim como o fundo do documento, seguem o modo escolhido: carvão (`#121212`) no escuro e claro (`#faf8f5`) no modo claro, inclusive durante o carregamento. ID, escopo, endereço de instalação e sessões existentes permanecem os mesmos; o fundo laranja é exclusivo dos ícones de instalação/favicon. Instalações Android existentes podem manter a configuração anterior até o Chrome atualizar o WebAPK; a página não controla essa janela nativa do sistema.
