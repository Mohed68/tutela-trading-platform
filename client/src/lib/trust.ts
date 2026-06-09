export const TRUST_SCORE_COMPONENTS = [
  "verification",
  "trade_history",
  "completion_rate",
  "responsiveness",
  "dispute_history",
] as const;

export const TRUST_LEVELS = ["bronze", "silver", "gold", "platinum"] as const;

export type TrustScoreComponent = (typeof TRUST_SCORE_COMPONENTS)[number];
export type TrustLevel = (typeof TRUST_LEVELS)[number];

export type TrustScoreBreakdown = {
  verificationScore: number;
  tradeHistoryScore: number;
  completionScore: number;
  responsivenessScore: number;
  disputeScore: number;
};

export type TrustProfile = {
  overallScore: number;
  level: TrustLevel;
  breakdown: TrustScoreBreakdown;
};

export const TrustWeights = {
  verificationScore: 30,
  tradeHistoryScore: 20,
  completionScore: 25,
  responsivenessScore: 15,
  disputeScore: 10,
} as const;

export function calculateTrustScore(breakdown: TrustScoreBreakdown): number {
  const totalWeight = Object.values(TrustWeights).reduce((total, weight) => total + weight, 0);
  const weightedScore =
    breakdown.verificationScore * TrustWeights.verificationScore +
    breakdown.tradeHistoryScore * TrustWeights.tradeHistoryScore +
    breakdown.completionScore * TrustWeights.completionScore +
    breakdown.responsivenessScore * TrustWeights.responsivenessScore +
    breakdown.disputeScore * TrustWeights.disputeScore;

  return Math.round(Math.min(Math.max(weightedScore / totalWeight, 0), 100));
}

export function getTrustLevel(score: number): TrustLevel {
  if (score >= 80) {
    return "platinum";
  }

  if (score >= 60) {
    return "gold";
  }

  if (score >= 40) {
    return "silver";
  }

  return "bronze";
}

export function isHighTrust(score: number): boolean {
  return score >= 80;
}

export function getTrustColor(level: TrustLevel): string {
  return level;
}
