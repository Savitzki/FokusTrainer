# Desempenho e auditoria — 20/10/2026

## Escopo e referência

Revisão do carregamento React/Vite, imagens, inicialização, sincronização, cache/PWA, navegação, cálculos de planejamento e estrutura/consultas do Supabase. A referência anterior é o commit `ab2c142` e o banco na versão 034. Não houve consulta de dados pessoais para a auditoria nem testes de escrita em contas reais.

As medições são de arquivos reais da compilação, não estimativas de tempo de abertura. Tempo percebido depende do aparelho, rede, cache e latência do Supabase; não foram executados Lighthouse em aparelho físico ou testes de carga de produção.

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Download do cache inicial | 38.586.697 bytes | 1.737.285 bytes (aprox.; o hash do bundle pode variar) |
| Arquivos no cache inicial | 59 | 41 |
| JavaScript principal, sem compressão | 534,55 KB | 458,82 KB |
| JavaScript principal, gzip | 163,01 KB | 142,57 KB |
| Cópias de entrega dos 8 cosméticos e 2 ícones da economia | PNGs com vários MB | cerca de 284 KB em WebP |

O cache inicial caiu **95,5%**. O bundle principal caiu aproximadamente **14%** sem adicionar dependências, e ficou abaixo do aviso de 500 KB. O Supabase continua em um chunk separado de aproximadamente 228 KB, gzip 59 KB.

## Principais correções

- **Robustez offline:** a busca no cache de arquivos públicos agora tolera `Vary: Origin`, pois requisições de módulos/CSS diferem das usadas na instalação. O worker continua restrito a GETs no escopo público do app, sem interceptar Supabase ou escritas. Grupos em cache continuam visíveis quando a atualização do perfil falha; o aviso de conexão permanece.
- **Cache de instalação:** o build baixava 24,7 MB de medalhas ainda não usadas pelo renderer e outros PNGs originais grandes. `scripts/offline-assets.mjs` agora seleciona somente o shell, todos os chunks JS/CSS, manifestos/ícones e imagens otimizadas utilizadas. Um orçamento de 5 MiB impede reintroduzir silenciosamente um cache enorme.
- **Imagens:** `npm run prepare:images` reproduz cópias WebP da moeda, Kit Médico, quatro molduras e quatro banners. Mantém enquadramento, proporções, transparência e originais. O script requer ImageMagick 7; os resultados são versionados para que CI/publicação não dependam da ferramenta. Não há mudança nos preços ou no inventário.
- **Telas secundárias:** Arena, desafios, perfil, relatórios e compartilhamento carregam sob demanda. Todos os chunks continuam no cache offline. Indicador acessível e erro restrito à seção mantêm a navegação disponível; o foco do título é restaurado após carregar uma rota, sem desviar o foco de modais.
- **Avatar reutilizável:** extraído para `src/Avatar.tsx`, evitando que o cabeçalho importe a tela inteira do perfil. A exportação antiga foi preservada para compatibilidade.
- **Renderização:** treinos confirmados, ordenação dos pesos, dias treinados e ofensiva no App são memorizados por suas dependências. A seleção da versão de plano percorre as versões uma vez, sem filtrar/ordenar em cada chamada, e a classificação do dia reutiliza o resultado. As regras históricas, revisões e datas de vigência continuam iguais.
- **Hidratação:** uma mesma entrada validada do cache não é lida/parseada novamente no primeiro efeito. Ao alternar um recurso, a memória válida prevalece até a atualização do servidor. Mudanças de conta/geração continuam isoladas.
- **Atualização seletiva:** inbox e reações têm canais próprios na infraestrutura existente. Ler/enviar uma provocação não dispara `get_social_state`, gamificação ou reações. Reagir não recarrega o histórico inteiro. Remover amizade invalida também o inbox, e gerenciar o grupo invalida reações. Nenhum segundo sistema de sincronização, Realtime ou intervalo adicional foi criado.

Os arquivos PNG originais e cosméticos antigos continuam no repositório e disponíveis nos caminhos anteriores para compatibilidade. Eles não entram no download inicial apenas por estarem hospedados. Não foram apagados arquivos, dados de conta, compras ou caches de outros aplicativos.

## Banco de dados

Auditoria de metadados em leitura: **50 tabelas públicas, 103 índices e 141 funções** na versão 034. Todas as tabelas públicas tinham RLS ativada e todas as funções `SECURITY DEFINER` tinham `search_path` fixo. Isso verifica essas configurações; não equivale a uma certificação de segurança completa.

O volume atual é pequeno: a maior relação observada tinha cerca de 200 KB. Scans sequenciais em tabelas com poucas linhas são decisões normais do PostgreSQL, não evidência suficiente para criar índices indiscriminadamente.

`pg_stat_statements` foi consultado sem retornar parâmetros ou conteúdo pessoal. As médias acumuladas de algumas variantes das RPCs de economia, cronograma, peso e gamificação estavam aproximadamente entre 80 e 150 ms. São estatísticas históricas, com períodos e versões distintos; não foram usadas para prometer uma redução de latência SQL. Evitar chamadas desnecessárias é a prioridade imediata.

A migração incremental **035 — `202610200035_query_indexes.sql`** prepara quatro acessos para crescimento:

1. `gf_challenges(owner_id, settled_at)`: quotas de desafios abertos e referências ao criador.
2. `gf_badge_memberships(user_id, group_id, accepted_at)`: histórico de participação por conta e FK.
3. `gf_badge_group_points(membership_id, user_id, group_id)`: suporte à FK composta das evidências.
4. `arena_taunt_push_jobs(device_id, created_at DESC)`: consulta da tentativa mais recente por aparelho.

A migração não altera RPCs, RLS, permissões, registros, resultados, recompensas ou configurações de push. É transacional, usa limites de espera/execução e foi testada em PostgreSQL 17 descartável. **Não foi aplicada em produção; depende de autorização explícita.** O frontend otimizado funciona na versão 034 e não depende desses índices.

Outras FKs sem índice foram inventariadas. Não foi criado um índice por FK automaticamente: algumas apontam para catálogos pequenos e imutáveis, e novos índices também têm custo de escrita/manutenção. A serialização atual de operações sociais foi preservada; alterar locks globais exige um ensaio de carga e revisão de concorrência próprios.

## Verificação e publicação

- `npm test`: **751 testes em 80 arquivos**, sem falhas, incluindo seleção histórica de planos, hidratação única, isolamento, invalidação direcionada, falha de chunk e foco após carregamento. O comando também executa **3 testes** da política de cache com o runner nativo do Node.
- `npm run build`: TypeScript, Vite e geração do service worker com orçamento de cache.
- `bash scripts/test-profiles-db.sh` e `bash scripts/test-gamification-db.sh`: PostgreSQL descartável, regressões anteriores, concorrência e teste dos índices da 035.
- Chromium com APIs sintéticas: **8 cenários** em 320/375/430/1024 px, claro/escuro, sem overflow ou erros de console; **1 cenário adicional** com service worker instalado, 8 cosméticos WebP carregados, banner/moldura de perfil e reabertura/navegação offline em grupos e desafios. Nenhuma escrita real foi feita.
- Ensaio isolado da seleção de planos: 30.000 consultas em 80 versões históricas, resultados idênticos; cerca de 63 ms antes e 27 ms depois neste ambiente. Isso mede somente a função, não o tempo total de abertura.

O GitHub Pages publica o frontend após testes/build. A atualização do service worker ativa quando as janelas antigas fecham, preservando uma versão coerente do app; não é necessário apagar dados nem desinstalar. Instalações existentes já têm o cache grande anterior até essa atualização ativar.

Para aplicar a 035 após autorização: revisar o SQL, confirmar a versão 034, aplicar uma vez, registrar o script no histórico de migrações e verificar índices válidos/RLS sem executar operações em contas reais. Em tabelas grandes, avaliar uma implantação com índices concorrentes em migração específica; a versão atual usa uma transação curta com `lock_timeout=5s`. Para rollback dos índices, remover somente os quatro nomes novos; não reverter migrações anteriores nem apagar dados.
