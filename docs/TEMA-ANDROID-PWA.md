# Tema da barra do Android no PWA

Uma aba do Chrome e o FokusTrainer instalado usam janelas diferentes do Android. A aba pode mostrar uma barra escura enquanto a instalação mantém outra cor. Essa comparação não determina, sozinha, se há metadados antigos ou uma falha do Chrome/sistema.

O app informa `theme-color`, `color-scheme`, fundos e safe areas conforme o tema escolhido. Os manifestos escuros usam `#121212`. Os três manifestos preservam o mesmo ID, escopo e endereço inicial. O service worker consulta os manifestos pela rede, com prazo de cinco segundos e sem reutilizar o cache HTTP. A última resposta válida fica disponível offline. Os arquivos do aplicativo continuam vinculados ao cache da versão instalada. Essa mudança melhora a atualização do manifesto, mas não força uma atualização do pacote instalado nem comprova a correção da barra nativa.

## Atualizar a instalação existente sem apagar dados

No Chrome do Android:

1. Abra o FokusTrainer conectado à internet e selecione o modo escuro. Feche as janelas antigas do app para permitir a ativação do novo service worker.
2. Digite **`chrome://webapks`** na barra de endereços do Chrome.
3. Localize **FokusTrainer** e, se disponível, toque em **Update FokusTrainer**.
4. Abra o app pelo ícone para que ele procure a atualização. Depois, feche-o pela tela de aplicativos recentes e aguarde alguns minutos para a atualização ser instalada antes de abrir novamente.

A página interna permite acompanhar **Update Status**, **Theme color**, **Dark theme color** e **Manifest URL**. O comando pode não aparecer se a instalação não for um WebAPK atualizável gerenciado por esse Chrome. Não solicite atualizações repetidas em menos de um minuto. Não é necessário limpar armazenamento, remover a conta, desinstalar o app ou ativar tela cheia.

Se continuar branco depois da atualização, confira os campos acima antes de atribuir a causa ao manifesto ou ao fabricante do celular. Metadados escuros com a barra ainda branca exigem investigação do comportamento nativo do Chrome/Android; emulação de celular no computador não reproduz essa barra.

## Evidência no Chromium

- [Correção para usar a cor do tema na barra de navegação dos aplicativos instalados](https://github.com/chromium/chromium/commit/0a6ab4f0e2ce17e572b05400ae6eacd7fc5389f0), incorporada no desenvolvimento do Chrome 153, sob o controle `WebAppNavigationBarThemeColor`. A versão do navegador, isoladamente, não prova o estado desse controle no aparelho.
- [Implementação da tela `chrome://webapks`](https://github.com/chromium/chromium/blob/main/chrome/browser/resources/webapks/about_webapks.ts): o botão agenda uma verificação na próxima abertura, e a atualização é instalada com o app fechado.
- [Agendamento de atualizações](https://github.com/chromium/chromium/blob/main/chrome/android/java/src/org/chromium/chrome/browser/webapps/WebApkUpdateManager.java): verificações e instalação do pacote seguem regras próprias do Chrome; atualizar o JavaScript da página não equivale a atualizar o pacote Android.

Os testes automatizados verificam a renovação do manifesto, fallback offline e preservação dos arquivos do shell. O resultado visual na barra do Android precisa ser confirmado no aparelho afetado.
