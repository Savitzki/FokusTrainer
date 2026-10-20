# Tema da barra do Android no PWA

Uma aba do Chrome e o Capibora instalado usam janelas diferentes do Android. A aba pode mostrar uma barra escura enquanto a instalação mantém outra cor. Essa comparação não determina, sozinha, se há metadados antigos ou uma falha do Chrome/sistema.

O app informa `theme-color`, `color-scheme`, fundos e safe areas conforme o tema escolhido. As cores solicitadas são `#121212` no modo escuro e `#faf8f5` no claro, tanto em `theme_color` quanto em `background_color`. O laranja anterior no fundo dos manifestos foi removido: o pacote Android pode reaproveitar esse fundo em sua janela nativa, independentemente da meta `theme-color` da página. O HTML também deixa de forçar laranja no fundo de `html`, `body` e `#root`, inclusive durante a abertura. O componente de carregamento também usa exatamente o fundo do tema, com a capivara já disponível antes do React. A imagem pulsa, mas o fundo não troca de cor. Os três manifestos preservam o mesmo ID, escopo e endereço inicial. O service worker consulta os manifestos pela rede, com prazo de cinco segundos e sem reutilizar o cache HTTP. A última resposta válida fica disponível offline. Os arquivos do aplicativo continuam vinculados ao cache da versão instalada. Essa mudança melhora a atualização do manifesto, mas não força uma atualização do pacote instalado nem comprova a correção da barra nativa.

A tela de lançamento do Android/Chrome não pode ser desativada pela página web. Seu fundo agora acompanha o tema, priorizando a consistência das barras nativas. O carregamento dentro da página mantém a capivara e os dois segundos mínimos existentes. Ao liberar a interface pronta, a camada esmaece em 240 ms sobre ela; movimento reduzido desativa pulsação e esmaecer. Igualar os fundos evita uma troca brusca de cor entre a janela nativa, o HTML inicial, o carregamento e a interface, mas a PWA não consegue suprimir a janela de lançamento do Android. Instalações existentes podem conservar o fundo laranja antigo até o Chrome atualizar o WebAPK; fechar e reabrir apenas o JavaScript não garante essa atualização nativa.

## Ícone sem círculo laranja

A abertura nativa utiliza o ícone de instalação, independentemente da imagem mostrada no HTML. Os PNGs comuns e o favicon agora reutilizam a arte oficial transparente `logo-capibora-sem-fundo.png`. Para o Android, os manifestos escuro e claro selecionam versões `maskable` com fundo igual ao tema da abertura e a mesma capivara dentro da área segura; assim, a máscara nativa não acrescenta um disco laranja. O Android ainda pode definir sua própria forma de ícone. A revisão dos arquivos é `capivara-1`; não há mudança de ID, escopo ou dados da instalação.

As imagens exportadas foram decodificadas no Chromium: transparência dos PNGs comuns/Apple/favicon, dimensões dos PNGs, fundo exato do tema nas bordas adaptáveis e preservação da arte dentro do círculo seguro. Os 701 testes e o build passaram. Essa verificação não substitui a conferência da tela nativa no aparelho com o WebAPK atualizado.

## Atualizar a instalação existente sem apagar dados

No Chrome do Android:

1. Abra o Capibora conectado à internet e selecione o modo escuro. Feche as janelas antigas do app para permitir a ativação do novo service worker.
2. Digite **`chrome://webapks`** na barra de endereços do Chrome.
3. Localize **Capibora** e, se disponível, toque em **Update Capibora**.
4. Abra o app pelo ícone para que ele procure a atualização. Depois, feche-o pela tela de aplicativos recentes e aguarde alguns minutos para a atualização ser instalada antes de abrir novamente.

A página interna permite acompanhar **Update Status**, **Theme color**, **Dark theme color** e **Manifest URL**. O comando pode não aparecer se a instalação não for um WebAPK atualizável gerenciado por esse Chrome. Não solicite atualizações repetidas em menos de um minuto. Não é necessário limpar armazenamento, remover a conta, desinstalar o app ou ativar tela cheia.

Se continuar branco ou laranja depois da atualização, confira os campos acima antes de atribuir a causa ao manifesto ou ao fabricante do celular. Metadados escuros com a barra ainda de outra cor exigem investigação do comportamento nativo do Chrome/Android; emulação de celular no computador não reproduz essa barra.

## Evidência no Chromium

- [Correção para usar a cor do tema na barra de navegação dos aplicativos instalados](https://github.com/chromium/chromium/commit/0a6ab4f0e2ce17e572b05400ae6eacd7fc5389f0), incorporada no desenvolvimento do Chrome 153, sob o controle `WebAppNavigationBarThemeColor`. A versão do navegador, isoladamente, não prova o estado desse controle no aparelho.
- [Implementação da tela `chrome://webapks`](https://github.com/chromium/chromium/blob/main/chrome/browser/resources/webapks/about_webapks.ts): o botão agenda uma verificação na próxima abertura, e a atualização é instalada com o app fechado.
- [Agendamento de atualizações](https://github.com/chromium/chromium/blob/main/chrome/android/java/src/org/chromium/chrome/browser/webapps/WebApkUpdateManager.java): verificações e instalação do pacote seguem regras próprias do Chrome; atualizar o JavaScript da página não equivale a atualizar o pacote Android.

Os testes automatizados verificam a renovação do manifesto, fallback offline e preservação dos arquivos do shell. O resultado visual na barra do Android precisa ser confirmado no aparelho afetado.

Na revisão da abertura por tema, `npm test` passou com 701 testes e `npm run build` foi concluído. No Chromium, 16 cenários conferiram os temas claro/escuro, 320/375/430 px, primeira pintura sem JavaScript, opacidade intermediária real do esmaecer com a interface pronta por baixo, movimento reduzido, JavaScript lento e reabertura offline. Não houve troca de cor nos fundos, camada presa ou novo erro de JavaScript nos fluxos online testados. Essa conferência não emula a barra nativa do Xiaomi nem a atualização de um WebAPK já instalado.
