# Correções consolidadas — 22/10/2026

Base auditada: `41f5b6e` (PR #47). A implementação amplia os fluxos existentes e preserva autenticação, contratos de treino, economia, critérios de conquistas e resultados históricos.

## Resultado por solicitação

| Item | Resultado no código e verificação | Situação |
|---|---|---|
| 1. Web Push | Cron de produção consultado: um `fokus-push-quarter-hour`, ativo em `*/15 * * * *`. Três execuções recentes do Cron com status succeeded e push-dispatch v6 ACTIVE. Horário preferido, chamada noturna, supressão, expiração e recibos existentes preservados. Vibração curta `[120, 60, 120]` na notificação, sem som próprio, ações ou envio adicional. | Código e testes concluídos; vibração/entrega física dependem do aparelho. |
| 2. Permissão | Já usava Capibora feliz, sem a frase removida, com NÃO / SIM; comportamento preservado. | Regressão concluída. |
| 3. Sincronização | Cache, filas duráveis, idempotência, backoff com jitter e retomada existentes preservados. Erros temporários já eram silenciosos; erros acionáveis continuam visíveis. | Regressão concluída. |
| 4. Calendário | Mantidas as marcações apenas de treinos registrados, além da seleção/hoje. O projeto não dispõe de data persistida específica de ativação da ofensiva; não foi inventada. Classificações e detalhes continuam disponíveis. | Regressão concluída. |
| 5. Navegação | Reinício ao repetir a aba, proteção de salvamentos e histórico existentes preservados. Conta recém-autenticada sem perfil vai ao preenchimento somente após leitura confirmada do servidor. Callback de formulário desmontado não sobrescreve esse destino. | Código e testes concluídos. |
| 6. Guest | Cabeçalho somente com a marca. Começar agora é a entrada para autenticação em Início/Treinos; páginas privadas continuam protegidas. | Código e testes concluídos. |
| 7. Entrada | Mascote oficial e Novo por aqui?, seguidos de Entrar, Criar conta, ou e Continuar com Google. | Código e testes concluídos. |
| 8. Senha | E-mail ou nome de usuário; `PasswordInput` compartilhado por login/cadastro. O olho revela por cinco segundos, permite ocultar antes e mantém valor/foco/autocomplete. | Código e testes concluídos. |
| 9. Cadastro | Apenas e-mail e senha. Sem consulta pública de existência do e-mail, sem campos pessoais e sem autenticação simulada. | Código e testes concluídos. |
| 10. Primeiro perfil | Nome de usuário único e sem @, nome obrigatório e escolha explícita de sexo; preservada a opção existente Prefiro não informar. Salvar perfil permanece laranja. Nome/sexo deixam o cadastro e passam a esta etapa. Perfil existente mantém nickname permanente e sexo armazenado. | Código e testes concluídos. |
| 11. Kits | Uso exige ofensiva ativa e não pode ocorrer em datas consecutivas no fuso da conta, inclusive kits comprados, conforme confirmação do usuário. Uso manual/automático, idempotência e concorrência validados no servidor. Comprar continua permitido sem ofensiva. Preço 350, dois gratuitos/mês e demais valores preservados. | Migração 042 validada em banco descartável; consultar implantação abaixo. |
| 12. Não treinei hoje | Duas apresentações na mesma modal: cena inicial e quatro opções. Confirmações existentes reutilizadas. Aceitar a derrota mostra apenas a frase aprovada e confirmação, além do X. Essa confirmação não registra treino/falta, não zera a ofensiva e não desliga kits automáticos. Pausa segue indisponível. | Código e testes concluídos; arte triste pendente. |
| 13. Fusos | Identificadores técnicos visíveis já estavam removidos. Fusos nos contratos, datas, fechamento e sincronização permanecem. | Auditoria e regressão concluídas. |
| 14. Configurações | Ícone e switch de provocações já compartilhados com o padrão de aparência; apenas Permitir provocações. Privacidade das medalhas sem controle visual e estados privados preservados. Sobre o app continua resumido e por último. | Regressão concluída. |
| 15. Provocar | Fluxo existente preservado: arte, nome de apresentação/fallback, Deixa comigo..., Provocar e X. Sorteio, cota diária e revides permanecem no servidor. | Regressão concluída. |
| 16. Adicionar amigo | `AddFriend` reúne busca por nome/código e Copiar meu código. Campo alternativo bloqueado até apagar; resultados antigos ignorados. Código pesquisa antes de enviar convite; copiar não abre outra tela e oferece cópia manual se necessário. | Frontend e RPC 042 testados. |
| 17. Grupos | Vai treinar sozinha? / Vai treinar sozinho?; fallback sem gênero Vai treinar?. Ações e detalhes simplificados existentes preservados, incluindo transferência contextual antes de sair. | Código e regressão concluídos. |
| 18. Amigos | Lista compacta, botão Provocar, ficha modal, Remover amizade / Desafiar, sem menus/cadeados decorativos ou Criar grupo, conforme implementação existente. | Regressão concluída. |
| 19. Conquistas | Quatro correspondências sociais confirmadas pelo usuário e integradas. Total: 19 artes oficiais em 28 conquistas; nove sem arte mantêm fallback. Grade/modal e privacidade existentes preservadas. | Integração concluída para todas as artes fornecidas. |

## Migração 042 e segurança

`202610220042_protection_eligibility_friend_lookup.sql` é incremental. Adiciona o instante de vigência à regra de economia e funções internas de elegibilidade. O cálculo lê os mesmos dias obrigatórios confirmados, classificações e snapshots imutáveis usados pela ofensiva oficial; não chama o fechamento recursivamente. Proteções/descansos preservam pontos existentes e não criam novos pontos. Uma falta anterior sem proteção impede novo uso até haver sequência ativa.

A regra se aplica aos novos fechamentos a partir da data local de ativação. Fechamentos anteriores ainda pendentes conservam a política anterior; nenhuma proteção consumida, treino ou snapshot consolidado é reescrito. A operação manual preserva o retorno idempotente quando o mesmo dia já tem kit. Os locks de conta/carteira continuam serializando dispositivos e fechamento automático.

`kitEligibility` é aditivo no retorno de economia; clientes antigos continuam compatíveis e o servidor bloqueia tentativas inválidas. O frontend apresenta o motivo real e não restringe compras de CapiWhey, cosméticos ou kits.

`find_friend_by_code(uuid)` exige perfil autenticado e reutiliza o contrato de busca por nickname: somente ID, nickname, relação e solicitação pendente. Não retorna e-mail, código de terceiros, peso ou dados privados; não envia convite ao pesquisar. Funções internas de proteção não são executáveis por clientes.

Não há novo Cron, Edge Function, alteração de VAPID, configuração administrativa de Auth ou distribuição de recompensas.

Implantação: aplicar apenas a 042 sobre a 041, com a transação e registro de versão no histórico do Supabase; depois publicar o frontend. Não reaplicar migrações antigas. Em caso de falha, a transação reverte integralmente. Backup das definições anteriores deve preceder a implantação. Reversão posterior deve restaurar as funções anteriores e a função `economy_state` original, preservando registros novos; não apagar kits/históricos para reverter interface.

## Validação

- `npm test`: 975 testes em 98 arquivos, mais nove verificações Node de assets/configuração/CSP, aprovados. Inclui frontend, sincronização, navegação, autenticação, calendário, Arena e conquistas.
- O paralelismo do Vitest foi limitado a dois workers para evitar timeouts de interação sob carga; os timeouts e as assertivas não foram relaxados.
- `npm run check:types` e `npm run build` aprovados, incluindo CSP e cache offline com as 19 artes.
- `scripts/test-gamification-db.sh` e `scripts/test-arena-db.sh`: PostgreSQL descartável, contratos históricos antes da 042 e casos novos após ela.
- `test-protection-eligibility-concurrency.sh`: dois dispositivos usam um único kit; disputa entre atualização do aparelho e fechamento consome uma vez, sem recompensa.
- Aplicativo compilado em `/` e `/capibora/`: 12 combinações de tema/largura e oito cadastros com respostas fictícias; CSP, assets e privacidade do cadastro aprovados. Nenhuma conta criada ou e-mail enviado.
- Chromium real com dados sintéticos: 120 estados, larguras 320/375/390/430/768/1280, temas claro/escuro, sem rolagem horizontal, modais sobrepostas ou erros JavaScript. Foco restaurado, botões alcançáveis e seleção obrigatória do perfil verificados. Capturas locais de 390 px foram inspecionadas.

Os testes SQL usam somente contas sintéticas em bancos descartáveis. Não foram enviados pushes reais nem executadas operações destrutivas em contas de produção. Não houve validação em Android/iPhone físicos, vibração física, bateria/segundo plano ou fluxo real de autorização Google com uma conta humana; os contratos e callbacks são cobertos por testes e a integração existente foi preservada.

## Pendências de arte e produto

- Arte oficial triste/chorando: expressão `sad` preparada; nenhuma imagem é exibida enquanto não existir associação real em `mascotAssets.ts`. Não foram geradas imagens nem usadas mascotes genéricas.
- Arte dramática específica: a expressão `dramatic` conserva a pose oficial julgando como fallback anterior.
- Nove medalhas sem imagem fornecida: `week-1`, `week-2`, `week-4`, `week-8`, `week-10`, `week-20`, `weight-1`, `weight-7`, `weight-30`.
- Pausa de rotina continua indisponível, sem proteção fictícia.
- A emissão de sessão antes de confirmação continua dependente da política atual do Supabase Auth. Sem sessão, cadastro vai para confirmação pendente; não há necessidade de alterar essa política para este pacote.

## Arquivos alterados

A relação abaixo acompanha os arquivos do pacote; os originais PNG não foram modificados.
- `docs/CONQUISTAS.md`
- `docs/CORRECOES-CONSOLIDADAS-2026-10-22.md`
- `public/images/achievements/README.md`
- `public/images/achievements/web/collective-3.webp`
- `public/images/achievements/web/collective.webp`
- `public/images/achievements/web/friend.webp`
- `public/images/achievements/web/group.webp`
- `public/mascot/README.md`
- `public/sw.js`
- `scripts/test-arena-db.sh`
- `scripts/test-gamification-db.sh`
- `scripts/test-protection-eligibility-concurrency.sh`
- `src/AccountForm.test.tsx`
- `src/AccountForm.tsx`
- `src/AddFriend.test.tsx`
- `src/AddFriend.tsx`
- `src/App.missed-workout.test.tsx`
- `src/App.onboarding-shop.test.tsx`
- `src/App.test.tsx`
- `src/App.tsx`
- `src/AppHeader.test.tsx`
- `src/AppHeader.tsx`
- `src/ArenaGroupBanner.tsx`
- `src/EconomyPanel.tsx`
- `src/GuestExperience.test.tsx`
- `src/GuestExperience.tsx`
- `src/MedicalKitConfirmation.test.tsx`
- `src/MedicalKitConfirmation.tsx`
- `src/MissedWorkout.tsx`
- `src/PasswordInput.test.tsx`
- `src/PasswordInput.tsx`
- `src/PhrasePreferencesFields.tsx`
- `src/ProfilePanel.google.test.tsx`
- `src/ProfilePanel.nickname.test.tsx`
- `src/ProfilePanel.tsx`
- `src/SocialPanel.test.tsx`
- `src/SocialPanel.tsx`
- `src/achievementArt.json`
- `src/achievements.test.tsx`
- `src/capiboraEditorial.json`
- `src/capiboraVoice.ts`
- `src/economy.ts`
- `src/notifications.test.ts`
- `src/notifications.ts`
- `src/serviceWorker.test.ts`
- `src/startupScreen.test.tsx`
- `src/styles.css`
- `supabase/migrations/202610220042_protection_eligibility_friend_lookup.sql`
- `supabase/tests/protection-eligibility.sql`
- `vite.config.ts`
