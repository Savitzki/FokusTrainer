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
- `capibora-app-icon.png`: capivara com fundo laranja usada no carregamento inicial, nos ícones instaláveis (incluindo maskable) e no favicon.

Os originais permanecem intactos. As cópias WebP em `web/` são usadas pela interface e registradas em `src/brandAssets.ts`. O preparo remove apenas margens transparentes e ajusta resolução/formato; não redesenha o logo. Os ícones PNG de instalação ficam nos caminhos anteriores de `public/icons/`, preservando a identidade da PWA e a atualização das instalações existentes.

O pequeno ícone monocromático da barra Android é `public/icons/notification-badge.png`, derivado da silhueta da mascote oficial `neutro.png`, sem fundo colorido. É usado como `badge` nas notificações.
