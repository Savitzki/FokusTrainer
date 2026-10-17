# Recuperar pesos em outros aparelhos e ativar a corrida diária

Até a versão anterior, o peso ficava no navegador do aparelho onde foi registrado, mesmo com uma conta conectada. Por isso ele não aparecia ao entrar em outro celular ou navegador. Agora há sincronização privada por conta, que precisa desta atualização do Supabase.

## Atualizar o banco existente

Se você já executou o SQL de perfis e a atualização de treinos, amigos e grupos:

1. Abra [Supabase → SQL Editor](https://supabase.com/dashboard/project/qfzoeshhogoilsmvxlif/sql/new).
2. Copie **todo** o arquivo [202610170004_weights_and_times.sql](../supabase/migrations/202610170004_weights_and_times.sql), cole numa nova consulta e toque em **Run**.
3. O resultado deve dizer: **Pronto! Pesos privados sincronizados e horários dos treinos disponíveis.**

O arquivo não recria perfis, treinos, amigos ou grupos. Pode ser executado novamente. Em uma instalação nova, aplique primeiro as migrações 001–003, conforme [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md).

Publicar o app no GitHub não executa esse SQL no Supabase. A chave pública não permite criar tabelas. Enquanto a migração não for aplicada, o app preserva seus pesos locais e mostra a pendência de sincronização. Se a resposta do Supabase mencionar `PGRST202` ou função `sync_weights` ausente, a conexão chegou ao banco: aplique esta migração. Esse erro não significa falta de internet.

## Recuperar ontem e hoje

1. **No aparelho e na versão do navegador/PWA onde você registrou os pesos**, abra o app atualizado e entre na mesma conta. Não limpe os dados nem desinstale antes da recuperação.
2. Vá a **Meu peso**. Os pesos já associados à conta entram automaticamente na fila. Aguarde **Pesos salvos na conta**.
3. Se os registros foram feitos sem login, toque em **Importar N pesos sem conta**. Essa ação envia a cópia para a conta atual e preserva os dados sem login no aparelho.
4. No outro navegador, entre na mesma conta e toque em **Sincronizar pesos**, ou reabra o app com internet.

Se o mesmo dia tiver pesos diferentes em dois aparelhos, o app mostra as duas opções para você escolher qual deve ficar na conta. Nada é escolhido silenciosamente com base no relógio do celular. Um registro excluído permanece marcado no servidor para um aparelho offline não recriá-lo sozinho.

Ao sair da conta, os dados pessoais em cache neste aparelho são removidos, inclusive registros do modo sem login. O app impede a saída manual se ainda há pesos pendentes ou conflitos: primeiro sincronize e aguarde **Pesos salvos na conta**. Pesos confirmados continuam no servidor e reaparecem ao entrar novamente.

Sem conta, o peso continua local. Alterações offline de uma conta ficam na fila persistida do aparelho e são reenviadas ao reconectar ou reabrir. Limpar os dados do navegador apaga registros que ainda não chegaram ao servidor. Amigos e participantes dos grupos não têm acesso aos seus pesos.

## Corrida de quem acende primeiro

Cada confirmação recebe um horário imutável no Supabase. O grupo mostra a ordem e o horário dos participantes que confirmaram no dia, no fuso do grupo. A primeira confirmação recebe **#1**; instantes exatamente iguais compartilham a posição. A corrida reinicia a cada dia do grupo.

A ordem considera **quando o servidor recebeu a confirmação**. O horário local de um treino offline é salvo no aparelho, mas não antecipa a posição: ele conta quando sincroniza, ainda dentro do dia do grupo. Alterar o relógio do celular não muda a classificação. A chama coletiva só é salva quando todos treinam; um dia incompleto zera a sequência.

Registros antigos que já estavam online recuperam o horário que o servidor guardou. Para treinos antigos apenas locais, não é possível inventar a hora original. A animação de foguinhos aparece só ao confirmar um treino novo, nunca ao carregar ou sincronizar um histórico.
