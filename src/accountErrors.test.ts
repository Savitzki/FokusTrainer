import { expect, it } from "vitest";
import { accountAuthError, AccountExistsError } from "./accountErrors";

it.each([
  [{ code: "email_address_invalid" }, /e-mail está correto/, "email"],
  [{ code: "weak_password" }, /senha mais forte/, "password"],
  [
    { code: "email_address_not_authorized" },
    /liberar o serviço de e-mail/,
    undefined,
  ],
  [
    { code: "over_email_send_rate_limit" },
    /limite de envio de e-mails/,
    undefined,
  ],
  [{ code: "over_request_rate_limit" }, /Muitas tentativas/, undefined],
  [{ code: "signup_disabled" }, /temporariamente indisponível/, undefined],
  [
    { code: "email_provider_disabled" },
    /temporariamente indisponível/,
    undefined,
  ],
  [{ code: "email_not_confirmed" }, /Reenviar confirmação/, undefined],
  [{ code: "invalid_credentials" }, /E-mail, nick ou senha incorretos/, undefined],
  [{ code: "request_timeout" }, /demorou para responder/, undefined],
  [new TypeError("Failed to fetch"), /Confira a conexão/, undefined],
  [
    { name: "AuthRetryableFetchError", status: 503 },
    /serviço de contas está indisponível/,
    undefined,
  ],
  [
    { name: "AuthRetryableFetchError", status: 0 },
    /Confira a conexão/,
    undefined,
  ],
  [{ status: 429 }, /Muitas tentativas/, undefined],
  [
    {
      code: "unexpected_failure",
      status: 500,
      message: "Error sending confirmation email",
    },
    /serviço de e-mail do app/,
    undefined,
  ],
  [
    {
      code: "unexpected_failure",
      status: 500,
      message: "Database error saving new user",
    },
    /problema ao salvar a conta/,
    undefined,
  ],
] as const)(
  "traduz a falha %j sem confundir conexão, dados e serviço",
  (error, message, field) => {
    expect(accountAuthError(error, "signup")).toMatchObject({
      message: expect.stringMatching(message),
      field,
    });
  },
);

it("só direciona uma conta existente ao login durante o cadastro", () => {
  expect(accountAuthError({ code: "email_exists" }, "signup")).toBeInstanceOf(
    AccountExistsError,
  );
  expect(
    accountAuthError({ code: "email_exists" }, "resend"),
  ).not.toBeInstanceOf(AccountExistsError);
});

it.each([
  null,
  "SMTP password=secret",
  { message: "private@example.invalid database details" },
])(
  "trata respostas desconhecidas sem exibir detalhes do provedor: %j",
  (error) => {
    expect(accountAuthError(error, "signup").message).toBe(
      "Não foi possível criar a conta agora. Tente novamente mais tarde",
    );
    expect(accountAuthError(error, "resend").message).toMatch(
      /reenviar a confirmação/,
    );
    expect(accountAuthError(error, "signin").message).toMatch(/entrar agora/);
  },
);
