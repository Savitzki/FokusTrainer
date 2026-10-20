# Cadastro e primeiro plano

## Auditoria e política de autenticação

O app reutiliza `useAccount`, `AccountForm`, o cliente Supabase e as rotas existentes. Login por e-mail/nickname e integração Google permanecem nos mesmos métodos. A consulta `account_email_exists` e suas permissões não foram alteradas. Nenhuma migração, RPC, RLS, configuração administrativa ou serviço de notificações foi modificado.

Verificação administrativa **somente em leitura**, em 20/10/2026: confirmação obrigatória de e-mail (`mailer_autoconfirm=false`), provedor e-mail ativo, Google desativado, senha mínima de oito caracteres, link válido por 3.600 segundos e limite de envio de dois e-mails por hora. Esses parâmetros são do ambiente consultado e podem mudar pelo administrador.

A política atual impede sessão antes de confirmar o e-mail. O frontend não a contorna. Alterar essa política ou habilitar/configurar Google exige aprovação administrativa específica. O código e a interface de Google foram preservados, incluindo o tratamento do provedor indisponível. Não foram feitos cadastros ou envios reais para validar o fluxo.

## Cadastro

Criar conta começa pelo e-mail e Continua após uma única verificação obrigatória. Não há consulta disparada a cada edição nem sucesso intermediário. Formato vazio/inválido ou acima de 254 caracteres impede a consulta. A normalização da consulta segue o método existente. Contas existentes seguem para o login, mantendo o comportamento de informação já permitido pelo serviço.

A solicitação pendente bloqueia novos envios; uma revisão do formulário e a montagem atual impedem que respostas antigas avancem uma etapa cancelada ou alterada. Corrigir e-mail e senha retira imediatamente os respectivos erros. As etapas seguintes e os requisitos existentes são preservados. Não há botão Voltar; o X fecha e descarta o rascunho, inclusive a senha. Abrir novamente começa limpo. Nenhuma conta é criada antes do envio final, e fechar um fluxo não exclui uma conta criada.

Quando `signUp` fornece uma sessão, o fluxo entra pelo mecanismo normal do SDK e dirige para Início. Sem sessão, mostra confirmação pendente e reenvio, sem autenticação fictícia ou nova solicitação automática de senha. O retorno pelo link é processado pelo SDK já existente e a abertura do app recupera a sessão normal.

## Avisos no Início

O aviso de e-mail permanece enquanto a identidade da sessão possuir e-mail pendente. Não é dispensável. O reenvio usa o serviço atual, com bloqueio concorrente e espera local de 60 segundos após sucesso; limites e erros do Supabase continuam prevalecendo. O endereço não é incluído no texto público do aviso nem em logs.

A consulta existente do perfil já verifica `auth.getUser` em segundo plano. Sua publicação passa a considerar também `email_confirmed_at`, inclusive quando os metadados não mudaram. Retorno ao app, conexão e revisão da sessão continuam utilizando os eventos e as proteções de concorrência existentes. Respostas após logout ou troca de conta não restauram a identidade anterior. Não foi criado polling adicional.

A ausência confirmada de perfil mostra o texto exato aprovado:

> Nova mensagem: Capibora
>
> Complete se perfil, me diga como devo te chamar

Tocar abre a edição existente. Perfil ainda carregando ou com falha não é classificado como incompleto. Salvar remove o aviso. Se ambos forem necessários, e-mail e perfil aparecem em uma pilha compacta, sem encobrir os demais avisos.

## Primeiro plano

Sem plano, a Home mostra “Já está quase tudo pronto...”, sem “Seu primeiro plano”. Registrar treino pulsa suavemente apenas nesse estado, sem deslocamento e respeitando movimento reduzido.

O botão abre um único modal com X e três etapas, reutilizando `TrainingScheduleSettings`:

1. **Quantos dias da semana você quer treinar?** — arte oficial julgando, quantidade de 1 a 7, descansos e aviso de sete dias.
2. **Escolha o dia em que vai treinar** / **Escolha os N dias em que vai treinar** — seleção e limites existentes, sem mascote repetida.
3. **Revisar plano** — dias escolhidos, descansos e vigência real; somente Confirmar e salvar envia ao servidor.

O primeiro plano continua válido hoje; substituições seguem com vigência futura e histórico preservado. A operação pendente bloqueia fechamento e envios repetidos. Falhas mantêm a revisão e não mostram comemoração.

A primeira criação confirmada abre a Capibora feliz com “Agora você já pode treinar à vontade!”. Continuar ou X retorna ao Início atualizado e retira o pulso. Não inicia sessão nem registra treino automaticamente. Substituições não acionam essa comemoração.

## Teclado e validação

O hook existente de viewport atende os modais e é reutilizado pela edição de perfil. Considera altura/deslocamento do viewport visual, faz rolagem somente quando o campo/ação está fora da área útil e libera espaço rolável no formulário de página. Os listeners são removidos e as variáveis restauradas ao desmontar. Zoom continua nativo, sem ser confundido com abertura do teclado. Não há altura fixa para um modelo de aparelho.

```sh
npm test
npm run build
```

Os testes abrangem validação, consulta lenta/duplicada/antiga, erro de rede, cancelamento, sessão emitida/ausente, confirmação reconhecida sem mudança de metadados, logout durante consulta, avisos, reenvio/limite, seleção de 1–7 dias, vigência, salvamento, comemoração e ausência de treino automático. Os testes de browser usam APIs simuladas, sem contas reais; emulação do viewport não equivale a teclado físico Android/iOS ou instalação de PWA. As larguras, resultados e limitações efetivamente verificados constam na entrega/PR.

Criar o primeiro plano pela seção já existente em Treinos também aciona a comemoração por callback do salvamento confirmado. A substituição nessa seção não comemora nem redireciona; calendário e regras permanecem iguais.

## Resultado da revisão

- `npm test`: **833 testes Vitest em 86 arquivos e quatro verificações de cache/assets aprovados**, sem novos avisos de erro no log.
- `npm run build`: aprovado, sem dependências novas; cache offline existente preservado.
- Chromium real com APIs simuladas: 320, 375, 390 e 430 px, nos dois temas. Fluxo do plano, pulso/movimento reduzido, seleção/revisão, envio único, comemoração e ausência de treino automático; cadastro, erro corrigido, checagem única, etapas sem Voltar e teclado via viewport visual.
- Callback de confirmação processado pelo SDK e reabertura com sessão reconhecida, nos dois temas. Cenários separados de sessão emitida no cadastro, perfil incompleto, coexistência dos avisos e teclado na edição do perfil.
- Tela curta de 320 × 568 px nos dois temas, com viewport útil simulado de 240 px e deslocamento: troca de campos, rolagem estável, X sem cadastro e reabertura limpa. Não houve rolagem horizontal nem erros de página/console nos cenários verificados.
- O endereço `https://savitzki.github.io/capibora/` já consta como Site URL e na lista de retornos permitidos da autenticação, conferidos em leitura. Nenhuma atualização administrativa é necessária para os links atuais de confirmação.

Continuam pendentes testes com teclado real e instalação da PWA em Android/iPhone. Login Google real depende da habilitação administrativa do provedor; esta revisão preserva o código e os testes do fluxo existente e não ativa o serviço.
