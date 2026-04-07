const CADENCE_TO_MONTHLY: Record<string, number> = {
  DAILY: 30,
  WEEKLY: 4.333,
  EVERY_TWO_WEEKS: 2.167,
  THIRTY_DAYS: 1,
  SIXTY_DAYS: 0.5,
  NINETY_DAYS: 0.333,
  MONTHLY: 1,
  EVERY_TWO_MONTHS: 0.5,
  QUARTERLY: 0.333,
  EVERY_FOUR_MONTHS: 0.25,
  EVERY_SIX_MONTHS: 0.1667,
  ANNUAL: 0.0833,
  EVERY_TWO_YEARS: 0.0417,
};

export function normalizeCadenceToMonthly(amountCents: number, cadence: string): number {
  const factor = CADENCE_TO_MONTHLY[cadence.toUpperCase()] ?? 1;
  return Math.round(amountCents * factor);
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
