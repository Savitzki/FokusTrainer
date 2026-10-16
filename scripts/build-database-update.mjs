import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const migrations = [
  "202610160002_social.sql",
  "202610160003_push.sql",
];
const parts = migrations.map((name) => {
  const sql = readFileSync(new URL(`supabase/migrations/${name}`, root), "utf8");
  if (!/^begin;$/m.test(sql) || !/commit;\s*$/.test(sql))
    throw new Error(`Migração sem transação reconhecida: ${name}`);
  return `-- Origem: ${name}\n${sql.replace(/^begin;\n/m, "").replace(/commit;\s*$/, "").trim()}\n`;
});
const combined = `-- ATUALIZAR O FOKUSTRAINER DEPOIS DE CRIAR A TABELA DE PERFIS
-- Copie este arquivo inteiro no Supabase > SQL Editor > New query > Run.
-- Não inclui nem recria a primeira tabela. Preserva os perfis já cadastrados.
-- Cria treinos online, amizades, grupos e a estrutura de dados do push.
-- O envio de push ainda precisa das chaves, da Edge Function e do agendador.
-- Execute uma vez. Arquivo gerado por: node scripts/build-database-update.mjs

begin;

do $fokus_check$
begin
  if to_regclass('public.profiles') is null
     or to_regprocedure('public.fokus_profile_updated_at()') is null then
    raise exception 'Primeiro execute o SQL de perfis do FokusTrainer (202610160001_profiles.sql). Esta atualização não recria a primeira tabela.';
  end if;
  if to_regclass('public.workout_days') is not null
     or to_regclass('public.friendships') is not null
     or to_regclass('public.streak_groups') is not null
     or to_regclass('public.group_members') is not null
     or to_regclass('public.group_days') is not null
     or to_regclass('public.push_devices') is not null
     or to_regclass('public.push_jobs') is not null
     or exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='friend_code') then
    raise exception 'Uma atualização de amigos ou push já existe. Nada foi alterado. Use as migrações individuais que ainda faltam, conforme docs/PUSH-E-GRUPOS.md.';
  end if;
end
$fokus_check$;

${parts.join("\n")}
commit;

select 'Pronto! Banco atualizado para treinos, amigos e grupos. O push ainda precisa ativar o serviço de envio.' as resultado;
`;
const output = new URL("supabase/ATUALIZAR-BANCO.sql", root);
if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== combined)
    throw new Error("ATUALIZAR-BANCO.sql desatualizado. Execute node scripts/build-database-update.mjs.");
} else {
  writeFileSync(output, combined);
  console.log(`Arquivo pronto: ${fileURLToPath(output)}`);
}
