# Revisão de organização do Capibora

A revisão examinou Início, Treinos, Peso, Arena, Loja, perfil, Ajustes, cadastro, cronômetro, registro manual, notificações e seus pontos de sincronização. O critério foi dar um lugar principal a cada configuração, manter ações frequentes à vista e abrir detalhes somente quando solicitados. Não há métricas de utilização que justifiquem apagar sistemas inteiros.

## Alterações implementadas

| Área | Organização atual |
| --- | --- |
| Início | Treino de hoje, ofensiva, semana e metas permanecem visíveis. Dias ativos, último peso e tempo total ficam em **Seu progresso**, recolhido inicialmente. Os valores usam os mesmos cálculos. |
| Treinos | O plano existente fica em **Plano semanal**, antes do calendário. A primeira configuração continua aberta e obrigatória. Fechar a seção não descarta o rascunho de substituição. Uma mudança futura é sinalizada no resumo. |
| Relatórios | O gráfico de peso do período fica recolhido; a aba Peso continua sendo o destino principal de pesagens. O filtro de período e a privacidade do relatório permanecem. |
| Arena | A busca por @nick é o caminho principal. **Adicionar amigo → Convites por código** reúne usar um código e mostrar o próprio código. Convites antigos continuam aceitos. |
| Loja | O estoque e os gratuitos aparecem no produto Kit Médico, evitando repeti-los no resumo. O saldo exato permanece visível. **Histórico** reúne movimentações e a subseção **Kits utilizados**. |
| Aparência | Claro/escuro é configurado em **Ajustes → Aparência**. Os botões globais duplicados foram retirados da Loja; as prévias dos cosméticos continuam mostrando os dois modos. Equipar um tema e alternar claro/escuro não remove compras. |
| Notificações | **No celular** concentra o Web Push quando disponível. **Lembretes com o app aberto** separa os horários locais e fica recolhido quando o push pode ser configurado. Sem suporte/configuração, o controle local aparece aberto. Nenhuma preferência é redefinida nem unificada silenciosamente. |
| Perfil | Avatar, edição, trajetória, medalhas e saída permanecem acessíveis. E-mail e sexo ficam em **Dados da conta**, recolhido. O selo técnico “Perfil da conta” foi retirado; visitantes ainda são informados sobre o perfil local. |
| Visitante | Retirado o atalho de sino do cabeçalho, que repetia o destino de Ajustes. A entrada na conta e o acesso ao perfil continuam disponíveis. |

As seções usam `details`/`summary` nativos, com foco visível, teclado e alvo de toque mínimo de 44 px. Não houve inclusão de bibliotecas, nova aba na navegação ou alteração da identidade visual.

## Sistemas examinados e mantidos

- Cadastro, login por e-mail/nick e Google, confirmação e saída: validações e fluxos de recuperação continuam os mesmos.
- Registro manual e cronometrado: interrogatório, mínimo de duração, confirmação no servidor, expiração e limite diário não mudaram.
- Plano, versões históricas, reagendamento, descanso extra e Kit Médico são mecanismos distintos. A reorganização não altera suas cotas nem os cálculos individual/coletivo.
- Metas, conquistas, grupos permanentes e desafios com prazo têm finalidades diferentes. Nenhum foi desativado ou teve recompensa alterada.
- Compras, inventário, reações e medalhas preservam persistência, bloqueios, privacidade e equipamentos.
- Pesagens continuam privadas, com fila offline e registros imutáveis. O acesso de visitantes a novos registros continua bloqueado.
- Estados de sincronização, erros de gravação, confirmações de compra/uso e avisos que exigem ação continuam visíveis. O recolhimento não desmonta os componentes nem passa a disparar novas consultas.
- Instalação permanece em Ajustes e se oculta quando o app já está instalado.

A pergunta de sexo no cadastro é um candidato a uma revisão de produto posterior: as frases atuais usam nome/contexto e não dependem desse campo. Nesta rodada, sua coleta e os dados existentes foram mantidos; apenas a visualização da conta foi recolhida. Não foram removidos dados pessoais nem reescritas preferências.

## Arquivos principais

- `src/App.tsx`: Início e agrupamento dos avisos.
- O antigo `src/PushPanel.tsx` foi substituído pelo convite `NotificationOptIn` e pelo hook `useNotificationOnboarding` na migração 028; os controles de notificações saíram de Configurações.
- `src/WorkoutCalendar.tsx`: acesso compacto ao plano já criado.
- `src/ProfilePanel.tsx`: detalhes de conta sob demanda.
- `src/SocialPanel.tsx`: alternativas por código dentro da adição de amigos.
- `src/CosmeticShop.tsx`: remoção do controle global duplicado de aparência e de seu listener.
- `src/EconomyPanel.tsx`: totais não repetidos e histórico unificado.
- `src/ProgressReports.tsx`: evolução do peso recolhida por período.
- `src/styles.css`: estilo reutilizável das seções e remoção de seletores sem uso.

Nenhum hook de persistência, contrato RPC, tabela, migração, regra econômica ou dado de produção foi modificado. As permissões de push continuam sendo solicitadas por ação do usuário, com as verificações existentes.

## Verificação

- `npm test`: **453 testes aprovados em 54 arquivos**.
- `npm run build`: TypeScript, Vite e cache da PWA aprovados.
- Novos testes de integração verificam a separação dos horários locais e push, o fallback sem suporte, a primeira criação de plano visível, o rascunho de substituição após recolher/reabrir e o histórico de kits.
- Testes atualizados cobrem acesso aos dados do perfil, convites por código, indicadores do Início e prévias sem um segundo controle global de aparência.
- Chromium com Supabase simulado: 240 combinações de estados do Início, 96 layouts das seis páginas e quatro do perfil, mais 144 combinações de seções abertas/fechadas. Larguras de 320, 360, 390 e 430 px, temas claro/escuro e fonte em 100%/200%.
- Loja: oito cenários de largura/tema com compra, equipamento, troca de aparência em Ajustes, reação de grupo, compra/uso de kit, extrato e recarga. Servidor simulado, sem compras ou alterações em contas reais.

Leitores de tela e dispositivos Android/iPhone físicos continuam dependendo de validação manual. A revisão visual usa Chromium com viewport móvel. Não foi necessária execução de SQL para esta rodada.
