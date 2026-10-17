export const currencyName = (amount: number) =>
  amount === 1 ? "pote" : "potes";
export const currencyAmount = (amount: number) =>
  `${amount.toLocaleString("pt-BR")} ${currencyName(amount)}`;
