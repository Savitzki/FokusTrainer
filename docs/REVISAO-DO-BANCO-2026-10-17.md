# Revisão do Supabase em 17/10/2026

Projeto: `qfzoeshhogoilsmvxlif`. Revisão feita com acesso administrativo, comparando as migrações e o código do aplicativo com o banco real. Nenhuma credencial ou informação pessoal foi incluída neste relatório.

## O que já estava atualizado

As migrações 001–005 já estavam aplicadas. As 11 tabelas do aplicativo e as 22 funções definidas nas migrações correspondiam ao repositório, incluindo sincronização de peso, horários de confirmação e fila de avisos opcionais aos grupos.

Nome, tratamento das frases e estado são preferências em `user_metadata` do Supabase Auth. Não precisam de colunas adicionais nas tabelas públicas. As mudanças de aparência, textos do cadastro e instalação no celular também não exigem alterações no banco.

As verificações de integridade não encontraram perfis sem conta, pesos sem conta, treinos sem perfil, fusos inválidos ou eventos de grupo atribuídos a um usuário diferente do dono do treino. As tabelas têm RLS ativo; pesos, amizades, treinos e filas são acessados por funções autorizadas, sem acesso direto do navegador. O perfil só pode ser consultado e editado pelo próprio usuário.

## Alterações aplicadas

A migração [202610170006_database_maintenance.sql](../supabase/migrations/202610170006_database_maintenance.sql) foi testada e aplicada no projeto real:

- Oito índices adicionados para as chaves estrangeiras de amizades, donos de grupos, aparelhos e avisos de grupo. Eles cobrem consultas e verificações de exclusão em cascata.
- Revogada a execução direta de `fokus_profile_updated_at()` por `PUBLIC`, `anon` e `authenticated`. O gatilho continua atualizando perfis normalmente.
- Revogada a execução direta de `rls_auto_enable()` pelos mesmos papéis, quando a função de evento fornecida pelo Supabase existe. Sua definição e registro foram preservados, mantendo a ativação automática de RLS nas novas tabelas.

O Supabase Auth foi configurado para exigir no mínimo **8 caracteres** em novas senhas, acompanhando a validação do aplicativo. Essa configuração é separada da migração SQL e deve ser repetida nas configurações de autenticação de novos projetos. Senhas e contas existentes não foram modificadas. A URL do site e o redirecionamento permitido já apontavam para `https://savitzki.github.io/FokusTrainer/`.

Não foi necessário remover tabelas, colunas ou registros. As contagens dos registros existentes permaneceram iguais após a atualização.

## Validação

- 109 testes do aplicativo aprovados e build de produção concluída.
- 14 testes das funções de notificações aprovados, com envios simulados.
- Testes em PostgreSQL 17 descartável aprovados: isolamento de contas, revisões e conflitos de peso, horários imutáveis, convites, ofensiva coletiva, concorrência, filas, tentativas e cancelamento de push.
- A migração 006 foi reaplicada no banco descartável, tanto sem a função de evento da plataforma quanto com ela instalada. Os testes confirmaram a cobertura de todas as chaves estrangeiras, as restrições de execução e o funcionamento dos gatilhos após a revogação.
- No projeto real, uma transação explicitamente somente de leitura validou `sync_weights` com lote vazio e `get_social_state` sob o papel `authenticated`, sem expor dados pessoais. Também confirmou os horários dos treinos e o bloqueio de acesso direto a pesos e de execução anônima das funções privadas.
- Os diagnósticos oficiais do Supabase deixaram de apontar chaves estrangeiras sem índice e função `SECURITY DEFINER` executável por visitantes.

Os avisos sobre tabelas sem políticas de acesso direto e RPCs autenticadas `SECURITY DEFINER` correspondem à arquitetura do app: essas funções verificam a conta e a participação antes de acessar tabelas privadas. Não foram criadas políticas que exponham dados apenas para silenciar avisos. Índices novos podem aparecer como ainda não utilizados enquanto há pouco tráfego. O diagnóstico de proteção contra senhas vazadas continua pendente; é uma opção distinta da senha mínima.

## Serviços externos ainda pendentes

O banco está preparado para push, mas o projeto não tem as funções `push-dispatch` e `group-notify` publicadas nem agendamento Cron instalado. Não foi criado um agendador que chamaria um serviço ausente. A ativação do envio está descrita em [PUSH-E-GRUPOS.md](PUSH-E-GRUPOS.md) e [AVISOS-DO-GRUPO.md](AVISOS-DO-GRUPO.md).

O cadastro por e-mail está habilitado e exige confirmação. O provedor Google está desabilitado no Supabase; ativá-lo exige configurar as credenciais OAuth do projeto Google. Nenhuma dessas pendências exige apagar ou recriar as tabelas.
