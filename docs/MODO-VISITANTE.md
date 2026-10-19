# Modo visitante

Sem login, o Capibora oferece somente **Início** e **Treinos**. Ambas as telas usam cabeçalho, navegação, mascote, temas e controles existentes.

- **Início:** logo, Entrar, arte oficial `mascot/web/julgando.webp`, “Duvido que você comece”, explicação curta, Começar agora e três benefícios compactos.
- **Treinos:** semana de segunda a domingo, identificada como **Demonstração**, com segunda/quarta/sexta como exemplo de treino e quatro descansos. Os dias são uma lista estática; não são botões bloqueados nem registros de atividade. Criar meu plano abre a autenticação.
- **Autenticação:** os três botões usam `AccountForm`, com o login/cadastro e Google já existentes. Não há outra implementação de autenticação. Após entrar, o painel autenticado é montado com suas seis abas e os mesmos hooks. Após sair, o painel é desmontado e reaparece a apresentação visitante.

## Isolamento e compatibilidade

`App` monta `GuestExperience` quando não há conta, em vez de montar o painel pessoal e esconder seus controles. Portanto, a apresentação não inicia hooks de treinos, calendário, economia, grupos ou missões. A autenticação continua utilizando `useAccount`. A abertura existente de dois segundos e a recuperação de autenticação permanecem.

`usePageNavigation(true)` permite somente Início e Treinos. URLs restritas e navegação interna são resolvidas como Início antes de renderizar; o endereço restrito é substituído para não criar um ciclo ao voltar. Fragmentos e parâmetros usados pelos retornos de autenticação são preservados. O controle não substitui as políticas e validações do Supabase, que permanecem inalteradas.

`AppHeader` e `AppNavigation` são compartilhados. O cabeçalho visitante aceita somente entrada e marca, sem receber saldo, avatar ou ofensiva. O painel autenticado mantém seus controles e navegação anteriores.

O arquivo legado `fokus-trainer:v1` não é lido, exibido ou sobrescrito pela apresentação. O logout continua invalidando requisições pendentes e limpando os caches da conta, mas preserva esse arquivo antigo. Nenhum treino demonstrativo é criado no banco ou no armazenamento. Dados antigos não se tornam treinos confirmados ao entrar; os mecanismos anteriores de recuperação opcional de pesos permanecem disponíveis somente na área autenticada.

Não há migração, nova dependência, mudança de autenticação ou alteração das regras de confirmação, cronograma, ofensiva, descanso, economia ou notificações.

## Validação

Nesta entrega, `npm test` passou com **641 testes em 70 arquivos** e `npm run build` foi aprovado. Os testes cobrem as duas abas, conteúdo das telas, os três acessos à autenticação, URLs e navegação interna restritas, preservação de callbacks, entrada/saída sem recarga e arquivo legado preservado. As suítes anteriores continuam cobrindo as funções autenticadas.

A revisão no Chromium usa APIs e credenciais inteiramente simuladas, com as imagens oficiais servidas pelo build. Abrange 320, 375, 430 e 1024 px, temas claro/escuro, fonte ampliada a 200%, alvos de toque, foco de teclado, ausência de consultas pessoais no visitante e login/logout pelo SDK. Nenhuma conta real é utilizada para testes. Android/iPhone físicos e leitores de tela ainda dependem de validação manual.
