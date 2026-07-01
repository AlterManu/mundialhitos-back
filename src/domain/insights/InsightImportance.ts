export const InsightImportance = {
  Low: 25,
  Medium: 50,
  High: 75,
  Historic: 95,
} as const;

export function isPublishableImportance(score: number): boolean {
  return score >= InsightImportance.Medium;
}
