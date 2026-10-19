# Auditoria de navegação, Perfil e notificações

## Navegação

A estrutura existente de páginas por fragmento permanece em `src/navigation.ts`. Não foi adicionado um roteador paralelo.

Problemas identificados e tratados:

- O retorno do cronômetro estava fixo em Início. Agora usa o histórico criado pelo aplicativo; um acesso direto sem predecessor conhecido tem um retorno seguro dentro da PWA. Sair dessa tela não cancela a sessão.
- As abas da Arena existiam somente em memória. `#/arena?aba=groups`, `friends` ou `challenges` preservam a seleção após recarregar e ao voltar/avançar. O componente acompanha a aba restaurada sem fechar o formulário de adicionar amigo por uma atualização da própria Arena.
- Os atalhos de personalização e Kits Médicos abriam o mesmo topo da Loja. Usam `#/loja?secao=molduras`, `banners` ou `kits`. A seção é posicionada quando seus dados estão disponíveis, sem repetir a rolagem depois de cada compra/equipagem.
- Um clique numa notificação apenas focava uma janela existente, mesmo em outra página. Os avisos existentes de grupo abrem Grupos na Arena; os lembretes locais de peso abrem Peso; lembretes de treino mantêm Início. Destinos recebidos são restritos ao diretório e à origem da instalação.

O fechamento explícito dos modais mantém a página de origem. Os fluxos de registro manual, confirmação e avaliação continuam na tela atual; a sessão cronometrada permanece recuperável. Visitantes continuam limitados a Início e Treinos, inclusive ao abrir endereços privados provenientes de notificações. Os fragmentos de retorno da autenticação permanecem preservados.

O acesso da Arena às medalhas de um amigo continua usando `get_friend_showcase` e suas permissões. Não existe uma página pública completa do perfil de amigos no fluxo atual; esta revisão não cria essa funcionalidade. O acesso ao próprio Perfil usa a navegação existente.

## Edição do Perfil

A prévia e o envio/substituição/remoção de foto continuam usando `Avatar`, a moldura equipada e o processamento existente da imagem. A edição mostra, nesta ordem: prévia/foto, estilo, cor, nome de exibição, dados da conta e ações Cancelar/Salvar. A capa permanece na visualização do perfil, sem ocupar o editor compacto.

Para um perfil já criado:

- O nome usa o rótulo “Como quer ser chamado no app?” e mantém a personalização das frases.
- Não há campo ou consulta de disponibilidade do nickname. O @nickname com cadeado e o e-mail são somente leitura em uma seção sempre visível.
- Sexo não aparece no editor nem nos dados da conta. O valor armazenado é preservado ao salvar nome/avatar.
- Cancelar restaura o rascunho anterior e não envia alterações.

A criação inicial do nickname, as sugestões quando ocupado, o cadastro e o tratamento das frases armazenado na conta permanecem existentes. Não foi alterado o contrato de salvamento nem a imutabilidade no servidor.

## Notificações auditadas

O catálogo aprovado em `supabase/functions/_shared/capibora.ts` não é alterado. Título e corpo continuam separados; horários, escolha das frases e intensidades permanecem existentes.

| Evento | Infraestrutura atual | Resultado da auditoria |
| --- | --- | --- |
| Lembrete de treino | Agendador Supabase, `push-dispatch`, `claim_push_jobs` e `reserve_push_message` | Existente, sem novo horário ou tipo de aviso |
| Lembrete de peso | Preferência local existente e `claim_local_reminder` | Existente; não é um novo push agendado |
| Treino confirmado para o grupo | Escolha “Avisar o time?”, `group-notify` e fila do grupo | Existente, continua dependendo da escolha do usuário |
| Pedido de amizade | Solicitações visíveis na Arena | Sem push de convite implementado |
| Convite para grupo | Convites visíveis em Grupos | Sem push de convite implementado |
| Convite para desafio | Convites visíveis em Desafios | Sem push de convite implementado |
| Quebra/recorde da ofensiva coletiva | Estado e resultados reais do grupo | Sem tipo específico de push automático |
| Ganhos, missões, conquistas e compras | Feedback visual e catálogo de reações | Não criam novos disparos nesta revisão |

Os convites podem futuramente aproveitar a infraestrutura de Web Push, mas exigem decisão prévia sobre quais eventos enviar, consentimento, privacidade, limitação de frequência e deduplicação. Nenhum desses tipos foi ativado nesta tarefa.

### Elegibilidade e consistência

As funções SQL existentes verificam plano vigente, descanso/reagendamento/proteção, treino confirmado, sessão ativa ainda válida e o fuso fixado para a conta. A reserva de mensagem revalida o estado antes do envio. As restrições de silêncio são 08h–22h; o primeiro slot usa a hora já configurada para o dispositivo (padrão existente: 18h), e a segunda chamada permanece às 21h. Não foram substituídas por 17h/20h30.

O canal local continua usando uma autorização do servidor por conta/dia/tipo e é suprimido para treino quando a conta tem push ativo. Antes de apresentar um aviso local, a interface agora também reconfere o estado disponível mais recente: conclusão, descanso/proteção/reagendamento, sessão ativa, troca de dia, conta, conexão e visibilidade. A permissão nativa é reconferida depois da preparação assíncrona do service worker.

As filas e os recibos de deduplicação, os leases e as tags estáveis continuam existentes. Os avisos de grupo verificam participantes aceitos, treino real confirmado, grupo ativo, silêncio e limitação de eventos próximos. Nenhum peso ou dado privado adicional foi incluído no payload.

A aceitação pelo provedor não confirma que o sistema operacional mostrou uma notificação. Retentativas de rede não oferecem garantia absoluta de entrega exatamente uma vez; as tags e os registros existentes limitam repetições. Não foram enviados testes para pessoas reais nesta auditoria.

## Validação

- `npm test`: 692 testes aprovados em 72 arquivos, incluindo destinos, histórico real do navegador simulado, modais, restrições de visitante, retorno da sessão, edição do perfil e invalidação de lembretes durante consultas.
- `npm run build`: compilação TypeScript, Vite e geração do cache offline concluídas. Permanece o aviso de um chunk acima de 500 kB; esta revisão não adiciona dependências.
- Testes Deno de `push-dispatch/core.test.ts` e `group-notify/core.test.ts`: 16 aprovados, com provedores e operações simulados.
- `bash scripts/test-gamification-db.sh`: aprovado em PostgreSQL 17 descartável, incluindo elegibilidade, deduplicação entre canais/dispositivos, consentimento, isolamento, planos, registro, recompensas e cosméticos. Nenhum dado real foi usado ou modificado.
- Chromium com APIs simuladas: oito combinações aprovadas (320, 375, 430 e 1280 px, nos temas claro e escuro). Foram conferidos foto/remoção, estilo/cor/nome, Cancelar/Salvar, persistência após recarregar, moldura, destinos da Loja, Arena com Voltar/Avançar, fechamento por botão/Escape, retorno da sessão sem cancelamento, logout, bloqueio de páginas privadas e login. Sem rolagem horizontal no editor nem novos erros de console nos fluxos testados; capturas dos editores claro e escuro também foram inspecionadas.

A apresentação física de push, o gesto Voltar do sistema e a aparência da PWA em Android/iPhone exigem conferência em dispositivo. Não há migração nova nem necessidade de modificar dados em produção.

## Arquivos desta revisão

- Navegação e integração: `src/navigation.ts`, `src/App.tsx`, `src/SocialPanel.tsx` e `src/WorkoutRegistration.tsx`.
- Editor do perfil: `src/ProfilePanel.tsx`, `src/PhrasePreferencesFields.tsx` e `src/styles.css`.
- Notificações existentes: `src/notifications.ts` e `public/sw.js`.
- Regressões: `src/navigation-history.test.tsx`, `src/navigation.test.tsx`, `src/App.session-navigation.test.tsx`, `src/App.reminders.test.tsx`, `src/ProfilePanel.nickname.test.tsx`, `src/SocialPanel.test.tsx`, `src/workoutRecording.test.tsx`, `src/notifications.test.ts` e `src/serviceWorker.test.ts`.
- Documentação: este arquivo e `docs/LINGUAGEM-E-NOTIFICACOES.md`.
