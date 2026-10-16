# Configurar o banco do FokusTrainer

O caminho mais simples para este projeto é **Supabase**: ele oferece PostgreSQL, cadastro/login e uma API que o app no GitHub Pages pode acessar. O GitHub Pages hospeda os arquivos do app; ele não executa um banco de dados.

## O que já está preparado

- Sem configuração externa: nick, avatar, foto, treinos e pesos ficam neste navegador. O perfil local não é uma conta.
- Com Supabase: cadastro com e-mail e senha, confirmação do e-mail, login, logout e sincronização do **nick e avatar**. As senhas são gerenciadas pelo Supabase Auth, nunca pela tabela de perfis.
- **Treinos, pesos e lembretes ainda são locais.** Cada conta tem um armazenamento separado neste dispositivo. Os registros feitos sem login continuam no modo sem login; não são importados automaticamente para uma conta. Ao sair da conta, eles reaparecem. Não há sincronização desses registros entre aparelhos nesta etapa.

## 1. Criar o projeto

1. Crie uma conta em [supabase.com](https://supabase.com/) e um projeto.
2. Escolha a região mais próxima de seus usuários. Guarde a senha do banco em um gerenciador de senhas; ela **não é usada no frontend**.
3. Aguarde o banco ficar disponível.

## 2. Criar a tabela de perfis

No projeto Supabase, abra **SQL Editor → New query**. Copie o conteúdo de [202610160001_profiles.sql](../supabase/migrations/202610160001_profiles.sql) e execute uma vez.

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

Nas configurações de API do Supabase, encontre a **Project URL** e a chave **Publishable** (`sb_publishable_...`). A chave **anon** legada também é aceita, se o projeto ainda a utilizar.

No repositório GitHub, entre em **Settings → Secrets and variables → Actions → Variables** e crie duas **Repository variables**:

| Nome                            | Valor                               |
| ------------------------------- | ----------------------------------- |
| `VITE_SUPABASE_URL`             | Project URL do seu projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave Publishable do mesmo projeto  |

As duas são configuração pública do frontend: ficam no JavaScript publicado. **Nunca coloque senha do banco, chave Secret ou `service_role` em variáveis `VITE_` ou no código.** A segurança do acesso aos dados vem da autenticação e das políticas RLS, não de esconder a chave pública.

O workflow já lê essas variáveis. Abra **Actions → Publicar no GitHub Pages → Run workflow → main** para gerar e publicar o app conectado ao banco. Salvar as variáveis sem recompilar não atualiza o site.

Se as duas variáveis estiverem vazias, o app continua funcionando com perfil local. Se apenas uma estiver preenchida ou uma chave privada for usada por engano, a compilação para e informa o problema sem imprimir o valor.

## 5. Testar na sua máquina

Copie `.env.example` para `.env.local` e preencha as duas variáveis com os valores públicos do projeto. Não envie `.env.local` ao GitHub; ele já é ignorado pelo Git.

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

O segundo comando exige Docker. Ele cria um PostgreSQL 17 descartável, sem porta aberta ou acesso de rede, aplica a migração com uma simulação de `auth.users`/`auth.uid()` e verifica isolamento entre duas contas, bloqueio de leitura anônima, restrições de avatar e atualização das datas. O container é removido ao terminar. Nunca rode os arquivos de `supabase/tests/` no projeto real do Supabase.

Os testes do app simulam o cliente Supabase para verificar cadastro, leitura, gravação e troca de sessão. **Eles não enviam e-mails nem substituem um teste no projeto real.** Depois da configuração, valide com duas contas: uma não deve conseguir ler ou alterar o perfil da outra, inclusive pela API. Confirme também o fluxo de e-mail no endereço publicado e o login em outro dispositivo.

## Próxima etapa: levar treinos e peso para o banco

A estrutura recomendada para essa expansão é:

| Tabela futura  | Dados e regra principal                                                           |
| -------------- | --------------------------------------------------------------------------------- |
| `workout_days` | Usuário, data local do treino, atividade e minutos; chave única `(user_id, date)` |
| `weight_logs`  | Usuário, data e kg; um registro por usuário/dia                                   |
| `reminders`    | Usuário, tipo, horário e estado ativado                                           |

Todas devem ter RLS por usuário. Para o treino, a confirmação precisa passar por uma função no banco que valida a data no fuso cadastrado da conta e impede atualização/exclusão; uma restrição só no navegador não protege uma API. A ofensiva pode continuar sendo calculada a partir dos dias confirmados, sem apagar o histórico quando a sequência zera.

Também será necessário implementar importação explícita dos registros locais, sincronização offline e tratamento de conflitos. Essas tabelas e essa sincronização **ainda não estão conectadas ao app**. Avisos com o app fechado exigirão ainda um agendador e Web Push; criar o banco ou instalar a PWA não ativa isso automaticamente.
