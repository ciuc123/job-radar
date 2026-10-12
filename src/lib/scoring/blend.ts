/** Blends the deterministic rules score with an AI second opinion. weight 0 (the default) leaves ranking untouched. */
export function blendScores(rulesScore: number, aiScore: number | null | undefined, weight: number): number {
  const w = Number.isFinite(weight) ? Math.min(1, Math.max(0, weight)) : 0;
  if (aiScore === null || aiScore === undefined || w === 0) return rulesScore;
  return Math.round(Math.min(100, Math.max(0, rulesScore * (1 - w) + aiScore * w)));
}
