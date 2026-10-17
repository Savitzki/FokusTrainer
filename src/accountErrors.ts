export class AccountExistsError extends Error {
  constructor() {
    super("Este e-mail já tem uma conta. Entre para continuar.");
    this.name = "AccountExistsError";
  }
}

export type AccountField = "email" | "password";
type AuthOperation = "signup" | "signin" | "resend";

export class AccountAuthError extends Error {
  constructor(
    message: string,
    public readonly field?: AccountField,
  ) {
    super(message);
    this.name = "AccountAuthError";
  }
}

// Never show raw provider messages: they can contain technical or personal data.
export function accountAuthError(
  error: unknown,
  operation: AuthOperation,
): Error {
  const details =
    error && typeof error === "object"
      ? (error as {
          code?: string;
          status?: number;
          name?: string;
          message?: string;
        })
      : {};
  const { code, status, name } = details;
  if (
    operation === "signup" &&
    (code === "user_already_exists" || code === "email_exists")
  )
    return new AccountExistsError();
  switch (code) {
    case "email_address_invalid":
      return new AccountAuthError("Confira se o e-mail está correto", "email");
    case "weak_password":
      return new AccountAuthError(
        "Essa senha foi recusada. Use uma senha mais forte, com pelo menos 8 caracteres",
        "password",
      );
    case "email_not_confirmed":
      return new AccountAuthError(
        "Confirme seu e-mail antes de entrar. Se precisar, toque em Reenviar confirmação",
      );
    case "invalid_credentials":
      return new AccountAuthError(
        "E-mail, nick ou senha incorretos. Confira e tente novamente",
      );
    case "nickname_login_unavailable":
      return new AccountAuthError("O login por nick ainda não está disponível. Entre com seu e-mail");
    case "email_address_not_authorized":
      return new AccountAuthError(
        "O envio de confirmação ainda está restrito. O responsável pelo app precisa liberar o serviço de e-mail",
      );
    case "over_email_send_rate_limit":
      return new AccountAuthError(
        "O limite de envio de e-mails foi atingido. Aguarde e tente novamente mais tarde",
      );
    case "over_request_rate_limit":
      return new AccountAuthError(
        "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente",
      );
    case "signup_disabled":
    case "email_provider_disabled":
      return new AccountAuthError(
        "O cadastro por e-mail está temporariamente indisponível",
      );
    case "user_banned":
      return new AccountAuthError(
        "Esta conta está indisponível. Fale com o responsável pelo app",
      );
    case "captcha_failed":
      return new AccountAuthError(
        "Não foi possível validar a tentativa. Reabra o app e tente novamente",
      );
    case "request_timeout":
    case "hook_timeout":
    case "hook_timeout_after_retry":
      return new AccountAuthError(
        "O serviço demorou para responder. Aguarde um pouco antes de tentar novamente",
      );
  }
  if (status === 429)
    return new AccountAuthError(
      "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente",
    );
  // Older Auth versions use unexpected_failure for SMTP and database failures.
  if (
    /error sending (confirmation|recovery|magic link) email/i.test(
      details.message ?? "",
    )
  )
    return new AccountAuthError(
      "Não foi possível enviar a confirmação. O serviço de e-mail do app precisa ser verificado",
    );
  if (
    /database error (saving|creating) (new )?user/i.test(details.message ?? "")
  )
    return new AccountAuthError(
      "O serviço de cadastro encontrou um problema ao salvar a conta. Tente novamente mais tarde",
    );
  if (status && status >= 500)
    return new AccountAuthError(
      "O serviço de contas está indisponível no momento. Tente novamente mais tarde",
    );
  if (name === "AbortError" || name === "TimeoutError")
    return new AccountAuthError(
      "A conexão demorou para responder. Confira a conexão e tente novamente",
    );
  if (
    status === 0 ||
    name === "AuthRetryableFetchError" ||
    error instanceof TypeError
  )
    return new AccountAuthError(
      "Não foi possível conectar ao serviço de contas. Confira a conexão e tente novamente",
    );
  return new AccountAuthError(
    operation === "signup"
      ? "Não foi possível criar a conta agora. Tente novamente mais tarde"
      : operation === "resend"
        ? "Não foi possível reenviar a confirmação agora. Tente novamente mais tarde"
        : "Não foi possível entrar agora. Tente novamente mais tarde",
  );
}
