# Interface da página inicial

A atualização reutiliza `StreakFlame`, `Stat`, `WeeklyTrainingProgress`, `WeeklyGoals` e `MissionRing`. As mudanças se limitam à apresentação do Início e aos refinamentos solicitados no cabeçalho e na navegação inferior compartilhados.

## Estado real do dia

`homeDayPresentation.ts` recebe a classificação efetiva de `trainingDayKind`, a existência de treino confirmado e a frase motivacional atual. Ele só escolhe textos; não calcula pontos ou modifica registros.

- Descanso programado sem treino informa que a ofensiva está protegida.
- Treino voluntário no descanso mostra “Treino extra concluído!” e explica que não soma pontos.
- Kit Médico, descanso extra e descanso por reagendamento mantêm sua classificação específica, inclusive se houver treino voluntário.
- A data de compensação aparece como “Treino compensatório”.
- Treinos obrigatórios mantêm as frases motivacionais e os fluxos de confirmação atuais.

O horário aparece junto ao status de conclusão, usando o fuso da conta quando disponível. Dias sem treino confirmado não exibem horário. A descrição acessível da chama não anuncia treino pendente em um dia protegido.

## Resumos

**Sua semana** usa o mesmo `weeklyTrainingProgress`: quantidade de treinos obrigatórios concluídos, meta efetiva, percentual e saldo de treinos restantes. A versão compacta só é habilitada no Início. Semanas de transição podem ter uma meta diferente de cinco. Treinos voluntários não aumentam esse cumprimento; descansos, proteções e reagendamentos seguem a classificação já existente.

**Dias ativos** mantém a contagem de dias distintos com treino confirmado na semana, incluindo voluntários. **Peso** mostra o último registro. **Tempo treinado** mantém a soma de minutos de todo o histórico confirmado. Esses períodos estão identificados nas descrições acessíveis e nos títulos dos indicadores.

**Metas da semana** conta metas atingidas separadamente de recompensas recebidas. As pendentes recebem destaque; todas continuam acessíveis nos detalhes. Quando todas são atingidas, o resumo recolhe os indicadores e mostra uma mensagem curta. Recompensas ainda não confirmadas aparecem como “em apuração”, sem antecipar moedas. Ciclos antigos com quatro metas continuam acessíveis.

A navegação mantém seis destinos, ícones, nomes acessíveis e destaque laranja. Apenas o destino ativo ganha legenda visível; Configurações usa a legenda curta “Ajustes”. A área inferior considera `safe-area-inset-bottom` e mantém a legenda ativa legível com fontes ampliadas. O logotipo, o pote de proteína, saldo e avatar mantêm os acessos existentes.

## Comparação visual

Exemplos medidos em Chromium, viewport 390 × 844 px, fonte normal, com os mesmos estados de conta simulados nos dois temas:

| Estado | Altura anterior da ofensiva | Altura nova | Redução |
| --- | ---: | ---: | ---: |
| Treino obrigatório pendente | 323 px | 274 px | 15% |
| Treino obrigatório concluído | 296 px | 246 px | 17% |
| Descanso programado | 291 px | 246 px | 16% |
| Descanso com treino voluntário | 318 px | 262 px | 18% |

O tamanho final varia conforme o texto, a largura e a fonte. A chama e o número permanecem centrais. Mensagens podem ocupar mais linhas quando necessário para preservar a leitura; não há altura fixa que corte conteúdo. Telas pequenas ou fontes ampliadas podem exigir rolagem vertical para alcançar informações reais.

## Verificação

```sh
npm test
npm run build
```

`App.home.test.tsx`, `WeeklyTrainingProgress.test.tsx`, `gamification.test.tsx` e `navigation.test.tsx` cobrem os estados, o horário no fuso da conta, o acesso aos detalhes, as metas pendentes/concluídas/legadas, a exclusão de treinos voluntários do cumprimento obrigatório, semanas de transição com compensações e proteções, e as legendas da navegação. A suíte existente continua cobrindo os sistemas de treino, sincronização e economia. A execução final passou nos 433 testes, em 51 arquivos, e na compilação de produção.

Validação visual adicional em Chromium com todas as chamadas ao Supabase simuladas: larguras 320, 360, 390 e 430 px; temas claro/escuro; fonte raiz normal e ampliada para 200%, totalizando 208 combinações de estados e layouts. Também foram verificadas as seis legendas ativas em 320 px com fonte ampliada. Foram verificados ausência de rolagem horizontal, textos sem corte, controles da ofensiva e navegação com pelo menos 44 px, alinhamento do cabeçalho e acesso às metas sem a barra inferior encobrir o conteúdo.

A validação em Android/iPhone físicos, o comportamento das áreas seguras reais e a leitura por tecnologias assistivas nesses aparelhos continuam dependendo de testes nos dispositivos. Não foram necessárias migrações nem alterações de RPCs, regras de negócio ou dados de produção.
