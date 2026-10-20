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
- `capibora-app-icon.png`: versão anterior com fundo laranja, preservada como original; os ícones de abertura novos não utilizam esse fundo.
- `logo-capibora-sem-fundo.png`: capivara transparente utilizada no carregamento e como base dos ícones de instalação e favicon.

Os originais permanecem intactos. As cópias WebP em `web/` são usadas pela interface e registradas em `src/brandAssets.ts`. O preparo remove apenas margens transparentes e ajusta resolução/formato; não redesenha o logo. Os ícones PNG de instalação ficam nos caminhos anteriores de `public/icons/`, preservando a identidade da PWA e a atualização das instalações existentes.

Os ícones comuns (`icon-192.png`, `icon-512.png` e `apple-touch-icon.png`) mantêm transparência, sem disco laranja. O favicon reutiliza a mesma arte transparente otimizada. As versões adaptáveis (`maskable-512.png` e `maskable-light-512.png`) têm fundo exatamente igual ao tema da abertura: `#121212` e `#faf8f5`, respectivamente. A capivara cabe no círculo seguro do Android sem recorte. O sistema pode aplicar sua própria máscara ao ícone; o fundo neutro se mistura à abertura.

Para reproduzir as exportações mecânicas, executar `node scripts/prepare-app-icons.mjs` com ImageMagick 7 instalado. Nenhum original é alterado ou redesenhado. Os três manifestos e os links de ícone usam a revisão `capivara-1`, mantendo ID, escopo e caminhos da PWA.

O pequeno ícone monocromático da barra Android é `public/icons/notification-badge.png`, derivado da silhueta da mascote oficial `neutro.png`, sem fundo colorido. É usado como `badge` nas notificações.

## Abertura do aplicativo

`logo-capibora-sem-fundo.png` é a arte oficial da tela de carregamento. O HTML inicial e o componente React usam a mesma cópia transparente otimizada, `web/logo-capibora-sem-fundo.webp` (400 × 398), pré-carregada e disponível no cache offline. O original permanece intacto.

O fundo da abertura acompanha o tema e as barras do sistema. A capivara transparente pulsa sobre esse fundo e esmaece em 240 ms ao liberar a interface pronta; movimento reduzido desativa os dois efeitos. A meta `theme-color`, `theme_color` e `background_color` dos manifestos, assim como o fundo do documento, seguem o modo escolhido: carvão (`#121212`) no escuro e claro (`#faf8f5`) no modo claro, inclusive durante o carregamento. A identidade, os ícones de instalação e as sessões existentes não mudam. Instalações Android existentes podem manter a configuração anterior até o Chrome atualizar o WebAPK; a página não controla essa janela nativa do sistema.
