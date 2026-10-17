export class AccountExistsError extends Error {
  constructor() {
    super("Este e-mail já tem uma conta. Entre para continuar.");
    this.name = "AccountExistsError";
  }
}
