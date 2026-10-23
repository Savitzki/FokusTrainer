# Voz e notificações da Capibora

O catálogo compartilhado fica em `supabase/functions/_shared/capibora.ts`, reexportado por `src/capiboraVoice.ts`. Interface, convite de consentimento, lembretes locais e Web Push usam a mesma fonte. A atualização 043 acrescenta chamadas de treino às 6h, 8h e 10h no Cron existente, sem novas preferências. Apenas lembretes de treino podem selecionar mensagens a partir das 6h; os demais tipos mantêm o início às 8h.

## Catálogo

`CAPIBORA_MESSAGES` reúne falas da interface e notificações. Cada entrada possui ID estável, categoria, contexto, período quando pertinente, intensidade (`light`, `teasing`, `exaggerated`), título, corpo, condições de elegibilidade e expressão oficial compatível. IDs do interrogatório e dos contextos existentes foram preservados.

A fala não utiliza ponto final, inclusive no meio de uma frase. Interrogações, exclamações e reticências continuam permitidas. Essa regra não modifica erros, textos funcionais, políticas ou conteúdo do usuário.

- Pendente: “Tá esperando o quê?”, “Vai hoje ou não?”, “Até eu treino, e você?”
- Concluído: “Tá pago”, “Milagre, treinou”, “Fez o mínimo, né?”
- Descanso: “Hoje pode”, “Descansa”, “Hoje nós dois não vamos”
- Manhã: “Bom dia, atleta” / “Atleta é modo de dizer, né”
- Tarde: “Vai treinar não????” / “Eu aqui esperando”
- Noite: “E o treino, hein?” / “Hoje ainda tá pendente”
- Exageros ocasionais: “BOOOOOORA TREINAAAAAAR”, “ALÔOOOOOO”, “NÃO É POSSÍVEEEEEL”
- Peso: “ALÔ, BALANÇA” / “Hoje é dia de registrar o peso”; depois da confirmação, “Anotado” ou outra reação neutra
- Social: “IH, OLHA LÁ 👀” / “Tem treino registrado no seu grupo”

O catálogo também prepara reações para conquistas, recompensas e mudanças reais de classificação. Isso não cria novos disparos push: não há infraestrutura nova para observar todos esses eventos, nem notificações retroativas de medalhas. Afirmações de classificação exigem desafio aceito, posição real e ausência de descanso/proteção.

## Seleção e frequência

O período vem do horário do servidor no fuso fixado da conta: manhã antes das 12h, tarde até 18h e noite depois. O tom **gentle** já salvo seleciona somente textos leves. O tom **dramatic** permite ironia e exageros ocasionais, aproximadamente em um de cada cinco dias elegíveis. O histórico privado da fila exclui IDs recentes; exageros não são autorizados no mesmo dia ou no dia seguinte em outro aparelho. Repetir uma entrega mantém o ID já reservado.

Os horários anteriores permanecem: primeiro push na hora escolhida (08h–20h, padrão 18h), segundo às 21h. Nenhum aviso matinal é criado automaticamente. O primeiro slot expira ao terminar sua hora, evitando que uma recuperação tardia envie a cobrança antiga. O segundo continua dependendo de treino pendente. O servidor não autoriza entregas entre 22h e 08h, nem quando falta tempo para a duração mínima configurada.

Descansos não geram pushes novos. As frases tranquilas aparecem na interface. Registrar treino ou peso mantém confirmação funcional explícita; não gera push redundante de conclusão. O feedback de peso só aparece depois da aceitação pelo servidor, nunca enquanto está apenas na fila offline.

## Elegibilidade e deduplicação

A migração **027** reforça os mecanismos existentes:

- `push_job_allowed` consulta conta/plano, classificação efetiva do dia, confirmação e cronômetro ativo ainda válido; inclui descansos, reagendamentos, proteções e o mínimo configurável
- `claim_push_jobs` mantém os dois slots, leases, limite de tentativas e fila durável; acrescenta metadados para escolha de texto
- `reserve_push_message` valida novamente o estado e salva ID/intensidade sob bloqueio da conta, antes do envio
- `claim_local_reminder` valida relógio e registros no servidor e reserva uma única apresentação por conta/dia/tipo, inclusive entre abas ou aparelhos
- Se a conta possui push habilitado, o lembrete de treino usa esse canal. O registro local também impede um push duplicado no mesmo dia
- O lembrete local de peso continua independente; um registro já confirmado em outro aparelho impede sua entrega
- O navegador mostra notificação do sistema **ou** o fallback dentro do app, sem repetir ambos
- Offline, o aplicativo não dispara uma cobrança cuja elegibilidade não pode confirmar; retomada/visibilidade/conexão utilizam o fluxo existente
- Logout, desmontagem e alteração da preferência enquanto a consulta está pendente impedem a apresentação tardia

Preferências locais permanecem no aparelho, como antes; o cliente verifica o interruptor antes e depois da consulta. O servidor verifica autorização, fatos e deduplicação. Não se criou um segundo cadastro de preferências.

Avisos de grupo continuam exigindo o pedido explícito após um treino confirmado. Associação, consentimento, treino e data do grupo são revalidados. Eventos próximos são consolidados em uma mensagem factual: no máximo um aviso por aparelho a cada 30 minutos; os demais eventos desse intervalo não disparam avisos individuais. A mensagem não cobra quem está descansando e não inventa resultados. Horários de silêncio também valem para grupos.

As filas mantêm a retenção anterior de 30 dias. A nova tabela privada de recibos locais tem RLS, sem acesso direto do navegador. RPCs de envio/reserva são exclusivos do servidor; o cliente autenticado só pode reivindicar seu próprio lembrete local. Não mudam nomes, preços, recompensas, duração, cronograma, ofensivas ou dados de histórico.

## Identidade visual recebida

`public/brand/capibora-text-light.png` fornece a marca do tema claro, sem fundo preto. `capibora-app-icon.png` fornece o símbolo de carregamento, favicon e ícones PNG da PWA. Os originais permanecem intactos; a interface usa versões WebP reduzidas. Identificadores, escopo e caminhos de instalação continuam os mesmos. A troca do ícone de uma PWA já instalada depende também da atualização do WebAPK/sistema operacional.

As expressões das falas usam o catálogo visual atual: julgamento/desconfiança, felicidade, descanso, comemoração e treino. Não foram criadas imagens ou animações. As ilustrações não são anexadas automaticamente às notificações do sistema.

## Validação e publicação

- `npm test`: catálogo, pontuação, períodos, preferências, exclusões, repetição, feedback confirmado, ciclo local, recuperação e logout
- `npm run build`: TypeScript, produção e cache PWA
- `bash scripts/test-gamification-db.sh`: PostgreSQL descartável; regressão de economia/treinos/planos/Arena, nova suíte `capibora-notifications.sql` e conexões simultâneas em `test-notification-concurrency.sh`
- Testes Deno de `push-dispatch/core.test.ts` e `group-notify/core.test.ts`: autorização, destinos, revalidação, retries e criptografia com chaves fictícias

Não executar fixtures no Supabase real. Primeiro aplicar `202610190027_capibora_notification_voice.sql`, depois publicar as versões correspondentes de **push-dispatch e group-notify**, mantendo a autenticação atual e os segredos existentes, e publicar o frontend. O workflow de Pages não aplica migrações nem publica Edge Functions.

A entrega física e a apresentação de notificações podem ser atrasadas pelo provedor/sistema. Uma mensagem já aceita pelo serviço push não pode ser revogada pela aplicação. Os testes automatizados não substituem a verificação em Android/PWA e iPhone instalados; nenhum teste envia notificações a contas reais.

## Arquivos envolvidos

- Catálogo: `supabase/functions/_shared/capibora.ts`, `src/capiboraVoice.ts`
- Interface/entrega local: `src/App.tsx`, `src/reminders.ts`, `src/notifications.ts`, `src/model.ts`, `src/NotificationOptIn.tsx`, `src/useNotificationOnboarding.ts`, `src/useWeightSync.ts`
- Envio no servidor: `supabase/functions/push-dispatch/core.ts`, `_shared/group-delivery.ts`
- Banco: migração `202610190027_capibora_notification_voice.sql`, suíte `supabase/tests/capibora-notifications.sql`, `scripts/test-notification-concurrency.sh` e integração no runner SQL
- Marca: `src/brandAssets.ts`, `src/styles.css`, `index.html`, três manifestos e derivados WebP/PNG em `public/brand/web/` e `public/icons/`
- Regressão: testes de App, voz, notificações, peso, marca e funções Deno; a fixture de plano/Arena foi isolada de outras proteções para testar corretamente em qualquer hora UTC

## Resultado desta entrega — 19/10/2026

Passaram **479 testes do aplicativo**, **16 testes Deno**, a compilação de produção, a suíte SQL e o ensaio administrativo com concorrência real. No Chromium, passaram 240 cenários de layout do Início, a conferência do carregamento e 16 combinações específicas da marca, nos dois temas, em 320/360/390/430 px e com fontes em 100%/200%. APIs foram simuladas nesses testes visuais.

A migração 027 foi aplicada após o ensaio: a transação verificou a preservação por hashes de 37 tabelas públicas existentes e das funções não relacionadas. `push-dispatch` e `group-notify` foram publicadas sem alterar os segredos ou acionar o cron para testes. Depois da validação, um teste manual solicitado explicitamente foi aceito pelo provedor (HTTP 201), após a pessoa ativar o push. Foi um único envio neutro, sem alterar horários ou dados da conta. A função privada temporária usada nesse diagnóstico foi removida; ela não faz parte do aplicativo ou dos testes automatizados. A aceitação pelo provedor não comprova que o sistema do celular já exibiu a mensagem.


### Ícone pequeno da barra de notificações

`public/icons/notification-badge.png` é a silhueta branca da ilustração oficial `neutro.png`, com transparência, exportada em 96 × 96 px para apresentação pequena no Android. O campo `badge` é usado tanto pelo service worker de push quanto pelas notificações locais. O ícone colorido continua no campo `icon`. O arquivo entra no cache offline da PWA. O suporte e a cor final da barra dependem do Android/Chrome; iOS e alguns navegadores podem ignorar `badge`. É necessário ativar o service worker atualizado antes de conferir uma próxima notificação.


## Convite único após o perfil — migração 028

A configuração de notificações foi removida da página de Ajustes. Depois do nick e avatar confirmados, a mascote pergunta se pode enviar lembretes de treino e novidades dos grupos. A fala `notification-invite`, do contexto `notification-opt-in`, é **Deixa que eu te lembro**. O **SIM** laranja solicita permissão nativa no gesto do usuário e inscreve o aparelho no serviço push existente. **NÃO**, com contorno, persiste a recusa sem abrir o pedido nativo. Erros permanecem no convite, sem sucesso antecipado; a decisão nativa não é tratada como uma consulta de rede com timeout.

`notification_consents` registra apenas conta, identificador aleatório da instalação, decisão e horário. A tabela tem RLS e não permite acesso direto pelo frontend. As RPCs `get_notification_consent`, `enable_push_notifications` e `decline_push_notifications` exigem autenticação e perfil, reutilizam `save_push_device` e serializam escritas por conta. A ativação e a escolha são atômicas; uma assinatura inválida não grava aceitação. A recusa só desativa o endpoint da própria conta. O marcador local da instalação não contém dados do perfil e permanece após logout; a decisão pessoal fica no servidor.

O hook usa o controlador de sincronização já existente, com proteção contra respostas antigas e encerramento de sessão. Não bloqueia o carregamento essencial. A abertura com assinatura antiga ativa não provoca novo convite. Após um logout, uma instalação com aceitação salva e permissão ainda concedida pode renovar a assinatura sem outra solicitação nativa. Uma recusa salva não é revertida por simples edição do perfil. Se a pessoa bloqueou no sistema, não se insiste no convite. No iPhone, o convite depende de abrir a PWA instalada e do suporte do sistema.

Não há novos agendadores ou disparos automáticos. Permanecem os lembretes de treino existentes (18h e 21h para inscrições novas, respeitando a configuração anterior das demais) e os avisos reais de grupo. **Avisar o time?** continua sendo uma escolha após confirmar o treino, com seleção de grupos quando necessário e opção **Agora não**. Não se avisa automaticamente cada amigo após um treino. Descansos, cronômetro ativo, confirmações, proteções, fusos, silêncio e deduplicação mantêm as regras anteriores. Reações do catálogo para outros eventos não significam que exista push automático desses eventos.

Para ativar: aplicar `202610190028_notification_onboarding.sql` e publicar o frontend. As funções Edge e seus segredos existentes não precisam ser alterados por esta migração. Nenhuma notificação de teste é enviada automaticamente. Para revogar permissão, usar as configurações do celular/navegador.

Validação desta etapa: 492 testes do aplicativo; compilação de produção; 16 testes Deno; suíte SQL completa e concorrência de inscrições; ensaio da transação administrativa verificando a preservação das 38 tabelas e das funções públicas anteriores. No Chromium, dez fluxos simulados (SIM, NÃO, recusa nativa, falha do servidor e assinatura antiga, nos dois temas) e 16 layouts do convite em 320/360/390/430 px, fontes 100%/200%, com verificação de gesto para a permissão. Essas simulações não comprovam a apresentação nativa em um Android ou iPhone físico.

A migração 028 foi aplicada ao Supabase em transação auditada: as 38 tabelas públicas anteriores e suas funções permaneceram inalteradas; RLS e permissões foram verificadas. Não foram criados consentimentos para pessoas reais, notificações ou fixtures nessa ativação. Também passaram os 96 layouts das seis páginas e quatro layouts do perfil, com Supabase simulado.

## Auditoria de navegação, Perfil e avisos

A revisão dos destinos, verificações de apresentação e lacunas dos eventos sociais está em [AUDITORIA-NAVEGACAO-PERFIL-NOTIFICACOES.md](AUDITORIA-NAVEGACAO-PERFIL-NOTIFICACOES.md). O catálogo aprovado e as regras de envio existentes permanecem preservados.
