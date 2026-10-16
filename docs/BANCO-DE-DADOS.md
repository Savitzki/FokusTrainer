# Configurar o banco do FokusTrainer

O caminho mais simples para este projeto é **Supabase**: ele oferece PostgreSQL, cadastro/login e uma API que o app no GitHub Pages pode acessar. O GitHub Pages hospeda os arquivos do app; ele não executa um banco de dados.

## O que já está preparado

- Sem configuração externa: nick, avatar, foto, treinos e pesos ficam neste navegador. O perfil local não é uma conta.
- Com Supabase: cadastro com e-mail e senha, confirmação do e-mail, login, logout, perfil e novos treinos sincronizados, amizades e grupos. As senhas são gerenciadas pelo Supabase Auth, nunca pela tabela de perfis.
- **Peso e lembretes locais continuam no dispositivo.** Cada conta tem armazenamento separado. Registros sem login não são importados automaticamente. Treinos antigos de dias passados também não são importados para o servidor. Novos treinos confirmados hoje tentam sincronizar ao abrir o app com internet.
- Web Push é opcional e precisa de chaves e agendador além do banco: siga [PUSH-E-GRUPOS.md](PUSH-E-GRUPOS.md).

## 1. Criar o projeto

1. Crie uma conta em [supabase.com](https://supabase.com/) e um projeto.
2. Escolha a região mais próxima de seus usuários. Guarde a senha do banco em um gerenciador de senhas; ela **não é usada no frontend**.
3. Aguarde o banco ficar disponível.

## 2. Criar a tabela de perfis

No projeto Supabase, abra **SQL Editor → New query**. Copie o conteúdo de [202610160001_profiles.sql](../supabase/migrations/202610160001_profiles.sql) e execute uma vez.

Depois aplique também as migrações `202610160002_social.sql` e `202610160003_push.sql`, conforme [o guia de amigos e push](PUSH-E-GRUPOS.md#1-ativar-amigos-e-grupos). Os arquivos já incluem transações; execute cada um inteiro. Se perfis já estiverem configurados, comece pelas migrações novas.

Para quem já executou **somente o primeiro arquivo**, há uma opção de copiar e executar tudo de uma vez: [ATUALIZAR-BANCO.sql](../supabase/ATUALIZAR-BANCO.sql). Ele reúne as migrações 002 e 003 e preserva os perfis existentes. Use esse arquivo único **ou** as duas migrações individuais.

O script cria a tabela `public.profiles`, as validações e as regras de acesso. Ele é destinado a um projeto novo; se já houver uma tabela `profiles`, não a apague para repetir o script. Ajuste a migração ao esquema existente.

| Campo                          | Uso                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `id`                           | ID da conta em `auth.users`                                                   |
| `nickname`                     | Nome de exibição; 3 a 24 caracteres, não é um identificador público exclusivo |
| `avatar_style`, `avatar_color` | Estilo e cor do avatar                                                        |
| `avatar_photo`                 | Foto opcional reduzida a 256 × 256 e armazenada como imagem pequena           |
| `created_at`, `updated_at`     | Datas de criação e atualização                                                |

O app cria o perfil após o usuário entrar e salvá-lo pela primeira vez. Não é preciso inserir usuários ou senhas manualmente.

**Row Level Security (RLS)** garante que uma conta leia e altere apenas seu próprio perfil. A tabela não permite leitura anônima. Mantenha essas regras habilitadas; não abra acesso público para resolver um erro de configuração. O card para redes sociais é gerado no dispositivo e não depende de expor a tabela ao público.

Para um volume maior de fotos, migre `avatar_photo` para um bucket do Supabase Storage com políticas próprias. Nesta versão as fotos pequenas ficam no perfil para também poderem ser usadas offline pelo app.

## 3. Configurar o cadastro e o e-mail

1. Em **Authentication**, mantenha o provedor **Email** e a confirmação de e-mail habilitados.
2. Em **URL Configuration**, configure o **Site URL** como:

   ```text
   https://savitzki.github.io/FokusTrainer/
   ```

3. Adicione esse mesmo endereço à lista de **Redirect URLs**. Se usar domínio próprio, use o endereço real, com a pasta correta.
4. Para desenvolvimento local, adicione também o endereço do servidor de desenvolvimento à lista de redirecionamentos, por exemplo `http://localhost:5173/`.
5. Configure um provedor SMTP para enviar e-mails de confirmação a usuários reais. O envio padrão do Supabase é limitado e pode restringir destinatários; consulte os limites apresentados no painel do seu projeto. O app não envia e-mails por conta própria.

Depois do cadastro, o usuário confirma o e-mail e entra no app para escolher o nick e o avatar. Se o perfil local já existir, ele não é publicado automaticamente na conta.

## 4. Conectar o app publicado no GitHub

**Este repositório já tem o projeto `qfzoeshhogoilsmvxlif` configurado em [`.env.production`](../.env.production), com a URL e a chave Publishable públicas fornecidas pelo proprietário.** Não é necessário cadastrar variáveis no GitHub para publicar usando esse projeto. Execute o workflow depois de preparar as tabelas e o cadastro. A presença da configuração não comprova que as tabelas já foram criadas ou que a conexão online foi validada.

Nas configurações de API do Supabase, encontre a **Project URL** e a chave **Publishable** (`sb_publishable_...`). A chave **anon** legada também é aceita, se o projeto ainda a utilizar.

Para substituir a configuração pública sem editar o arquivo, entre em **Settings → Secrets and variables → Actions → Variables** no GitHub e configure estas duas **Repository variables**, sempre juntas:

| Nome                            | Valor                               |
| ------------------------------- | ----------------------------------- |
| `VITE_SUPABASE_URL`             | Project URL do seu projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave Publishable do mesmo projeto  |

As duas são configuração pública do frontend: ficam no JavaScript publicado. **Nunca coloque senha do banco, chave Secret ou `service_role` em variáveis `VITE_` ou no código.** A segurança do acesso aos dados vem da autenticação e das políticas RLS, não de esconder a chave pública.

O workflow já lê essas variáveis. Abra **Actions → Publicar no GitHub Pages → Run workflow → main** para gerar e publicar o app conectado ao banco. Salvar as variáveis sem recompilar não atualiza o site.

Variáveis vazias no workflow deixam valer `.env.production`. Para publicar uma versão exclusivamente local, remova a URL e a chave desse arquivo e deixe as variáveis vazias. Uma chave privada usada por engano interrompe a compilação sem imprimir seu valor.

## 5. Testar na sua máquina

Para usar o projeto já configurado no desenvolvimento, copie `.env.production` para `.env.local`. Para outro projeto, copie `.env.example` e preencha as duas variáveis públicas. Não envie `.env.local` ao GitHub; ele já é ignorado pelo Git. Os testes unitários limpam essas configurações e usam clientes simulados, sem acessar o projeto real.

```sh
npm ci
npm run dev
```

Reinicie o servidor após alterar `.env.local`. No app, toque no avatar no canto superior direito → **Cadastro / entrar**. Crie a conta, confirme o e-mail, entre e salve seu perfil.

Para verificar a versão de produção e a PWA:

```sh
npm run build
npm run preview
```

## Validar o banco e a integração

```sh
npm test
bash scripts/test-profiles-db.sh
```

O segundo comando exige Docker. Ele cria um PostgreSQL 17 descartável, sem porta aberta ou acesso de rede, aplica as migrações com uma simulação de `auth.users`/`auth.uid()` e verifica isolamento entre contas, perfis, aceite dos convites, confirmação coletiva, perda da sequência e fila de push. O container é removido ao terminar. Nunca rode os arquivos de `supabase/tests/` no projeto real do Supabase.

Os testes do app simulam o cliente Supabase para verificar cadastro, leitura, gravação e troca de sessão. **Eles não enviam e-mails nem substituem um teste no projeto real.** Depois da configuração, valide com duas contas: uma não deve conseguir ler ou alterar o perfil da outra, inclusive pela API. Confirme também o fluxo de e-mail no endereço publicado e o login em outro dispositivo.

## Tabelas adicionais

`workout_days` guarda novos treinos com confirmação imutável do servidor. `friendships`, `streak_groups`, `group_members` e `group_days` cuidam dos convites e conclusões coletivas. `push_devices` e `push_jobs` guardam assinaturas privadas e a fila de envio. Todas têm RLS e não permitem leitura/escrita direta pelo navegador; funções autenticadas verificam quem pode executar cada ação. As funções administrativas de push só podem ser chamadas pelo servidor.

O próximo passo para sincronizar peso seria uma tabela `weight_logs` com RLS por usuário, importação explícita e resolução de conflitos. Ela não faz parte desta versão. O card para redes sociais continua gerado no próprio aparelho.
