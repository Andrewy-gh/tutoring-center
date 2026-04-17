export type CreditBalance = {
  available_minutes: number;
  pending_minutes: number;
};

export const EMPTY_CREDIT_BALANCE: CreditBalance = {
  available_minutes: 0,
  pending_minutes: 0,
};
