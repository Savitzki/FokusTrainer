# Auditoria de segurança e qualidade — 21/10/2026

> Atualização de 22/10: as pendências de código e de privacidade do e-mail foram tratadas na [entrega 041](SEGURANCA-IMPLANTACAO-041.md), com proteção adicional de login e CSP. Este documento preserva os achados da auditoria inicial.


## Escopo e método

Base analisada: `main` em `f6e9327`, atualizada antes das alterações. Revisão do frontend, autenticação, validação de dados, navegação, cache/offline, sincronização, Service Worker, notificações, Edge Functions, dependências e permissões do Supabase. Nenhuma regra de treino, ofensiva, economia, conquistas, amizades ou desafios foi alterada.

A produção foi consultada **somente para leitura de metadados**: tabelas, permissões, políticas, funções, schemas e indicadores selecionados de configuração do Auth. Não foram consultados perfis, pesos, mensagens, tokens ou registros de usuários para simular ataques. Nenhum SQL foi aplicado em produção. Testes de autorização e concorrência utilizaram bancos Docker descartáveis, sem rede, com usuários sintéticos.

Essa revisão não equivale a um pentest externo, nem garante ausência de vulnerabilidades desconhecidas. Não houve teste em aparelho físico, tentativa de invasão ou envio real de notificações.

## Achados e tratamento

| Achado | Risco/contexto | Tratamento |
| --- | --- | --- |
| Três entradas vulneráveis no grafo npm: Vitest, `@vitest/mocker` e `tinypool` | Dois alertas classificados como críticos e um moderado pelo npm. Atingiam ferramentas de desenvolvimento/testes, não o bundle de produção. Incluíam gadgets de prototype pollution/RCE e leitura arbitrária em servidor de mocks; não foi demonstrada exploração no Capibora. | Vitest atualizado de 3.2.7 para 4.1.12, compatível com Vite 6 e Node do projeto. Dependências vulneráveis removidas/atualizadas pelo lockfile. Auditoria final: zero alertas conhecidos. |
| Login por nickname e aviso de grupos liam o corpo completo antes de verificar seu tamanho | Possível consumo excessivo de memória/tempo com upload grande ou lento; o login é um endpoint público. Não foi feito teste de carga em produção. | Leitor compartilhado com limite efetivo em bytes durante o recebimento, cancelamento do stream e prazo total de leitura de 5 segundos. Mantidos limites de 4096/4000 bytes, autenticação, respostas e contratos existentes. Código das Edge Functions preparado e testado; precisa de deploy para vigorar no servidor. |
| Verificação de credenciais públicas cobria apenas a chave Supabase esperada | Uma futura variável `VITE_*` com segredo poderia escapar da verificação de build. Não foi encontrado segredo privado rastreado. | Guard reutilizável rejeita nomes privados, chaves `sb_secret_` e JWTs com `service_role` em qualquer variável `VITE_*`, sem imprimir valores. Mantida a validação existente da chave pública e das URLs. |
| Imports, variáveis e helpers sem consumidores | Código obsoleto dificulta a manutenção e pode manter comportamentos antigos em paralelo. | Removidos imports/variáveis sem uso e os exports sem consumidores descritos abaixo. TypeScript passa a verificar `noUnusedLocals` e `noUnusedParameters`. |
| Carregamento do perfil compartilhado repetido em duas apresentações | Duplicação do contrato, parser e identidade de sincronização. | `useFriendProfile` centraliza o carregamento para ficha e confirmação de provocação; reutiliza deduplicação, validação e isolamento existentes. Não cria cache persistente de perfis de terceiros. |
| `account_email_exists(text)` é público e distingue contas existentes | Risco de enumeração de e-mails. É uma decisão já documentada em `BANCO-DE-DADOS.md` e usada no cadastro aprovado. Não expõe nome, ID ou metadados, mas o booleano ainda revela existência. | **Pendente de decisão de produto/segurança.** Recomenda-se avaliar respostas indistinguíveis e proteção de abuso no cadastro. Não foi removido nem alterado silenciosamente o fluxo existente. |
| CAPTCHA desativado; cota de nickname é por identificador | Endurecimento contra automação pode ser necessário. A cota de 10 tentativas/15 minutos por nickname limita força bruta por conta, mas permite pressão distribuída sobre vários identificadores e bloqueio temporário direcionado. Não é um substituto de proteção por origem/IP. | **Recomendação operacional**, sem mudança administrativa: avaliar CAPTCHA/rate limiting na infraestrutura e testar a compatibilidade do login por nickname antes de ativar. |

Referências dos avisos corrigidos: [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) e [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr).

## Segurança do banco conferida

- **51 tabelas públicas** com RLS ativada; visitantes sem acesso direto de leitura/escrita.
- Usuários autenticados leem diretamente somente o próprio perfil e o sinal de invalidação da própria caixa de entrada. As políticas usam `auth.uid()`; os demais recursos passam pelas RPCs autorizadas.
- Escrita direta limitada às colunas de personalização do próprio perfil; sem concessão direta de DELETE/TRUNCATE nas tabelas do aplicativo.
- **138 funções `SECURITY DEFINER`** com `search_path=public, pg_temp`. Papéis `anon` e `authenticated` não podem criar objetos em `public`.
- Somente a consulta de existência de e-mail, entre essas funções privilegiadas, é executável por visitantes. Helpers internos e processamento de carteira/push não são executáveis pelo cliente.
- Sem views públicas que contornem as políticas de tabelas.
- `auth.users` não é diretamente legível pelos papéis de visitante/usuário.
- As suítes existentes verificam isolamento entre contas, amizade aceita para perfis compartilhados, privacidade das medalhas, administração de grupos, quotas, idempotência, proteção contra repetição e concorrência de compras/treinos/provocações.
- Novo `supabase/tests/security-boundaries.sql` transforma a conferência de RLS, grants, schemas, caminhos de funções e helpers em regressão executável. Exclui pelo nome somente tabelas auxiliares de snapshot criadas pelas fixtures históricas dos testes.

Não foram apagadas funções SQL antigas: algumas são wrappers de compatibilidade, inclusive a confirmação antiga de treino, que recusa operações para impedir contornar a avaliação/duração atuais.

## Autenticação, dados e frontend

| Área | Verificação |
| --- | --- |
| Auth | Confirmação obrigatória de e-mail ativa; Google habilitado; senha mínima configurada em 8 caracteres; rotação de refresh tokens ativa, reutilização permitida por 10 segundos. Nenhuma configuração alterada. |
| Nickname | Resolver de e-mail restrito a `service_role`; senha validada pelo Auth; resposta só devolve tokens após sucesso, sem e-mail resolvido ou erro interno. Edge valida método, tipo/tamanho do corpo e formato. |
| Sessões | Cliente oficial Supabase; limpeza de estado por conta, gerações para descartar respostas tardias e restrições Guest preservadas. Não há autenticação simulada no aplicativo. |
| Conteúdo | Não foi encontrado uso de `dangerouslySetInnerHTML`, `eval` ou `new Function` no código de produção do frontend. Nomes e mensagens são renderizados como texto React. Avatares enviados são limitados a PNG/JPEG/WebP; SVG externo não é aceito como foto. |
| Navegação | Rotas permitidas para visitantes resolvidas antes de montar telas privadas; retorno confere origem/caminho/proveniência. Links de push usam destinos internos permitidos. |
| Sincronização | Validação dos snapshots, cache por conta, descarte de respostas de uma sessão anterior, filas duráveis existentes e chaves de idempotência preservados. Falhas transitórias mantêm backoff; erros de autorização/validação continuam acionáveis. |
| Service Worker | Cache contém o shell público, sem persistir respostas da API/Auth. Push de provocação continua genérico; recibos não confirmam IDs desconhecidos ou de outra conta. |
| Web Push | Endpoint permitido por lista de provedores HTTPS; sem credenciais/portas arbitrárias ou redirects. Cron validado por segredo; envio de grupos valida o bearer no Auth e a autorização na RPC. Opt-in, silenciamento e revalidação antes do envio mantidos. |
| Segredos | Varredura dos arquivos Git atuais para chaves privadas, tokens GitHub/AWS, chaves Supabase secret e JWTs privilegiados: nenhum candidato encontrado. Não foi varrido todo o histórico Git nem rotacionadas credenciais. |

CORS aberto nos endpoints apropriados não foi tratado como substituto de autenticação: o login precisa ser público e os avisos de grupos exigem validação real do token. Nenhuma credencial privilegiada foi levada ao navegador.

## Limpeza e reutilização

- Novo hook `src/useFriendProfile.ts`, consumido por `FriendProfile` e `ArenaTauntButton`, conserva a mesma RPC, chave de leitura, parser e deduplicação de requisições.
- Novo helper `supabase/functions/_shared/request-json.ts`, usado pelas duas Edge Functions que recebem formulários JSON.
- Novo guard `scripts/public-environment.mjs`, integrado ao preflight já usado por `dev` e `build`.
- Removido `src/currency.ts`, módulo sem importações, com nomenclatura antiga de potes.
- Removidos a função `disablePush` sem uso na aplicação e seu teste isolado; o logout continua desativando o dispositivo com o fluxo existente em `account.ts`, e a recusa continua em `declinePush`. A RPC `disable_push_device` foi preservada.
- Removidos arrays sem consumidores `MANUAL_ASIDES`, `MANUAL_ACKNOWLEDGMENTS` e `MASCOT_POSES`; os catálogos de frases e assets reais permanecem intactos.
- Removido `GroupArtwork`, componente sem consumidores, e a ramificação inacessível da arte de grupo no banner vazio. Nenhuma arte oficial foi apagada.
- Removidos reexports sem uso no adaptador frontend da voz; os exports originais compartilhados com servidor permanecem disponíveis.
- Removidos imports/variáveis sem uso em App, SocialPanel, ArenaGroups e testes relacionados.
- Adaptada uma tipagem de mock para o Vitest corrigido. `allowImportingTsExtensions` permite verificar os helpers Deno `.ts` sem emitir código.
- Mantidos componentes globais de avatar, moldura, modal, mensagem e economia. Não foi feita uma extração ampla de telas ou eliminação automática de CSS/exports usados por contratos legados.
- Novo `npm run check:types`; novo workflow `quality.yml` verifica tipos, auditoria npm, testes e build em PR, com permissão somente de leitura. As suítes SQL existentes passam a executar as invariantes novas.

## Validação executada

| Comando/verificação | Resultado |
| --- | --- |
| `npm run check:types` | Aprovado, incluindo declarações sem uso. |
| `npm test` | 966 testes Vitest em 95 arquivos; 5 testes de assets offline; 2 testes Node do guard de configuração. Aprovados. |
| `npm run build` | Aprovado. Shell offline: 72 arquivos, 2,46 MiB. Não foram adicionadas bibliotecas à aplicação. |
| `npm audit` | Zero alertas conhecidos, incluindo dependências de desenvolvimento. |
| Consulta npm de advisories para os 20 pacotes do `deno.lock` | Nenhum aviso retornado para as versões listadas. |
| Testes Deno de login, grupos e dispatcher | 17 aprovados; Auth/HTTP locais fictícios e criptografia push testada sem entrega real. |
| `bash scripts/test-arena-db.sh` | Aprovado em PostgreSQL 17 descartável: permissões, perfis, convites, amizade, limite diário, revide, sinais globais e concorrência; novas invariantes de segurança incluídas. |
| `bash scripts/test-gamification-db.sh` | Aprovado em PostgreSQL 17 descartável: regressões de treino, planos, carteira, kits, cosméticos, missões, conquistas, desafios e concorrência; novas invariantes incluídas. |
| Chromium real com RPCs/WebSocket sintéticos | Fluxos de navegação, grupos, amigos/provocação, configurações e recuperação de conexão aprovados em 320, 390 e 1280 px, nos dois temas; sem erros de console inesperados ou rolagem horizontal. Sem contas reais. |
| `git diff --check` | Aprovado. |

Os primeiros testes também identificaram duas incompatibilidades de tipagem/configuração do runner atualizado e tabelas auxiliares de testes fora da RLS. Foram corrigidos os testes/configuração, sem liberar acesso a nenhuma tabela de produção ou enfraquecer as invariantes.

## Implantação e decisões pendentes

- **Sem migração SQL.** O arquivo SQL novo é teste, não alteração de schema. Não executar `db push` para esta entrega.
- Frontend e checks entram pela publicação normal do repositório.
- Para ativar a leitura limitada no servidor, publicar as versões revisadas de `login-with-nickname` e `group-notify` usando a configuração existente em `supabase/config.toml`. Não publicar `push-dispatch` por causa desta alteração: não houve mudança no seu fluxo de produção. Não alterar VAPID, Cron ou segredos.
- Avaliar a exceção de enumeração do e-mail e a proteção contra automação como decisão de produto/infraestrutura. Ativar CAPTCHA sem integrar o token no caminho de nickname pode interromper esse login; não deve ser feito isoladamente.
- Avaliar cabeçalhos CSP/segurança em uma hospedagem que permita configurá-los. O app usa scripts/estilos inline no startup e URLs `data:` para avatares, portanto uma CSP precisa ser desenhada e testada antes da ativação. Não foi aplicada uma política que pudesse quebrar login, carregamento ou assets.
- Tokens e caches privados do cliente continuam sujeitos ao modelo de segurança do navegador e à proteção contra XSS; não foi criada uma arquitetura BFF/HttpOnly nesta manutenção.
- Permanecem fora desta validação: Web Push em aparelhos físicos, contas reais, infraestrutura externa, histórico completo de segredos Git e pentest de carga. Os resultados acima não afirmam cobertura desses cenários.
