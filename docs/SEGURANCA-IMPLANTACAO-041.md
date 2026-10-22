# Segurança, publicação e calendário compacto — 22/10/2026

Esta atualização conclui as correções da [auditoria anterior](SEGURANCA-E-QUALIDADE-2026-10.md), adiciona proteções de autenticação e inclui o calendário compacto. Preserva os registros de usuários e as regras de treinos, ofensiva, kits, economia, conquistas e Arena.

## Cadastro e privacidade do e-mail

O app deixa de consultar `account_email_exists` antes de cadastrar ou entrar. A primeira etapa continua com e-mail e Continuar, valida o formato localmente e abre a senha com um clique. A conta só é criada no envio final ao Supabase Auth. O login envia e-mail/nickname e senha ao sistema existente, mantendo Google e os requisitos atuais.

O resultado ofuscado de uma conta já existente tem a mesma apresentação de confirmação pendente de um cadastro novo. Não há mensagens afirmando se um endereço tem conta, nem criação de sessão simulada. O aviso orienta conferir o e-mail ou utilizar Entrar. Erros reais de senha, rede, limites ou configuração continuam visíveis.

A migração `202610220041_auth_hardening.sql` retira a execução da consulta de existência dos papéis `PUBLIC`, `anon` e `authenticated`, inclusive chamadas diretas fora da interface. A função privada é preservada, sem apagar usuários ou históricos. Respostas e limites nativos do próprio Supabase Auth continuam sob controle do provedor; isso não pretende eliminar todos os canais possíveis de inferência desse serviço.

**Compatibilidade:** a publicação do frontend precede a revogação. Uma versão antiga do aplicativo ainda aberta que dependa da consulta antiga precisará ser atualizada/reaberta para entrar por e-mail ou cadastrar. Sessões existentes, nickname e Google não dependem dessa consulta. Não é possível manter uma consulta pública que revela existência e, simultaneamente, remover essa exposição.

## Proteção do login por nickname

A Edge Function mantém o resolvedor privado e a validação real da senha no Auth. Antes da resolução, passa por uma RPC nova, executável exclusivamente por `service_role`:

- Até **60 requisições por origem/minuto** e **300 requisições globais/minuto**, em janelas fixas do relógio do servidor.
- A cota existente de **10 tentativas por nickname/15 minutos** permanece.
- Incrementos atômicos em ordem global → origem impedem ultrapassar o limite com requisições simultâneas.
- O cliente não fornece limites, timestamps ou chaves de cota à RPC. Sem acesso direto à tabela ou à função administrativa.
- A origem é pseudonimizada com HMAC-SHA-256 e segredo já disponível somente no servidor. Não são armazenados IPs em texto, e-mails, senhas ou tokens nessa tabela.
- Usa o último salto de `x-forwarded-for`; prefixos enviados pelo cliente não escolhem a chave. Cabeçalhos não são uma prova de identidade. Origens ausentes/inválidas compartilham uma chave e a cota global continua valendo mesmo com origens forjadas ou rotacionadas.
- Atrás de um proxy que agregue origens, a cota por origem pode ser compartilhada. Monitorar respostas 429 no piloto sem registrar dados privados. CAPTCHA/WAF continuam possíveis melhorias de infraestrutura, não garantias substituídas por esse limite.
- Contadores antigos têm limpeza limitada durante solicitações, sem novo Cron. Se o serviço de proteção falhar, não são resolvidas credenciais: retorna erro temporário genérico.
- Corpo JSON limitado durante a leitura a 4096 bytes e 5 segundos; `group-notify` recebe a mesma proteção com 4000 bytes. Não se carrega um upload inteiro para só depois recusar seu tamanho.

Nenhuma exigência de confirmação de e-mail, configuração Google, credencial VAPID ou segredo foi alterado. Não foi ativado CAPTCHA sem integração compatível com os três caminhos de autenticação.

## Política de segurança no navegador

O build gera CSP em `dist/index.html`, antes dos scripts, e só então monta o cache offline:

- JavaScript próprio e hashes dos scripts oficiais de inicialização; sem `unsafe-eval` ou `unsafe-inline` para scripts.
- Handlers de carga/erro do stylesheet autorizados somente por seus hashes exatos, preservando a abertura suave do app.
- Conexões somente à própria origem e ao host Supabase configurado, incluindo seu WebSocket.
- Imagens próprias, `data:` e `blob:` para fotos/avatares; fontes próprias. Mantidos estilos inline necessários ao React e ao tema inicial.
- Plugins/objetos e frames internos bloqueados, base e formulários restritos à própria origem.
- Política `no-referrer` evita enviar a URL de origem nas requisições.
- Caminhos relativos funcionam na raiz, em `/capibora/` e em domínio próprio, sem fixar a URL do GitHub Pages na política.

CSP é proteção adicional, não substitui validação, escape de texto, RLS ou autorização. `frame-src` controla frames dentro do app; impedir que outro site incorpore o Capibora exigiria `frame-ancestors`/cabeçalho HTTP na hospedagem. Esse controle não foi falsamente implementado por meta tag.

## Qualidade e interface

- Atualização das dependências de testes com avisos corrigidos; guard de build contra credenciais privadas em qualquer variável `VITE_*`.
- `noUnusedLocals`/`noUnusedParameters`, remoção de helpers/imports sem uso e hook `useFriendProfile` compartilhado, sem cache persistente de terceiros.
- CI de PR com tipos, `npm audit`, testes, build e contratos das Edge Functions usando serviços locais fictícios.
- Calendário com cabeçalho mais compacto, Hoje junto ao mês, dias com altura controlada e espaçamentos menores. Redução medida de cerca de 15% em 375–390 px e 26% no desktop; em 320 px a redução é menor para manter 44 px de altura de toque. Detalhes, navegação e classificações reais preservados.

## Validação executada antes da implantação

- `npm run check:types`: aprovado.
- `npm test`: **962 testes em 96 arquivos**, mais **9 testes Node** de assets, configuração pública e política de segurança, aprovados. Os testes antigos da consulta pública de e-mail foram substituídos por casos de privacidade, entrada direta e falhas reais de autenticação.
- `npm run build`: aprovado; shell offline com 72 arquivos e 2,46 MiB.
- `npm audit`: zero alertas conhecidos nas dependências instaladas.
- Deno com lockfile congelado: **17 testes aprovados**, incluindo resolução privada e Auth fictício local.
- SQL de Arena e gamificação: aprovados em PostgreSQL 17 descartável, sem rede, com migração 041, RLS, cotas, virada de minuto e concorrência real. Uma única requisição venceu quando restava uma vaga na cota.
- Chromium real: CSP, startup, signup e ausência de consulta pública aprovados em 12 combinações de raiz/`/capibora/`, claro/escuro e 320/390/1280 px. Oito cadastros simulados, sem e-mails nem contas reais. Scripts não autorizados e conexão a destino externo foram bloqueados; imagens `data:`/`blob:` e startup oficial continuaram funcionando; `Referer` ausente na requisição recebida pelo servidor local.
- Calendário: 24 combinações de meses de cinco/seis semanas, dois temas e larguras 320/375/390/430/768/1280 px, incluindo teclado, detalhes e navegação, verificadas anteriormente nesta entrega.

Não houve teste físico de Web Push em Android/iPhone, login real Google com usuário ou teste de carga em produção.

## Ordem de implantação

1. Publicar frontend pelo fluxo normal do GitHub Pages após CI aprovado.
2. Conferir a nova CSP e a remoção da consulta no endereço público.
3. Aplicar **somente 041**, em transação, registrando a versão no histórico do Supabase. Não reaplicar migrações antigas ou usar `db push` genérico.
4. Publicar `login-with-nickname` e `group-notify` com a configuração existente (`verify_jwt=false` no gateway e validação no próprio handler). Não publicar outras funções nem alterar segredos.
5. Conferir histórico 041, grants, RLS, versões ativas e respostas inválidas/sem autenticação sem usar contas reais.

O status efetivo da publicação e das verificações de produção é registrado na PR desta entrega. Nenhuma chamada de confirmação de treino, compra, recompensa ou envio de notificação faz parte desse procedimento.
