/**
 * @package @forge/ai-readiness
 * @description React hooks for AI-readiness assessment
 */

import { useMemo } from 'react';
import { useAIReadinessContext } from './AIReadinessProvider.js';
import type {
  AIReadinessAssessment,
  AssessmentDimension,
  FullScoreBreakdown,
  ImprovementRecommendation,
  EffortEstimate,
} from '../ai-readiness.types.js';
import type { AIReadinessGrade } from '@forge/analysis';

/**
 * Hook to get the current assessment
 */
export function useAssessment(): {
  assessment: AIReadinessAssessment | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { assessment, isLoading, error } = useAIReadinessContext();
  return { assessment, isLoading, error };
}

/**
 * Hook to get the overall score and grade
 */
export function useAssessmentScore(): {
  score: number;
  grade: AIReadinessGrade;
  isLoading: boolean;
} {
  const { assessment, isLoading } = useAIReadinessContext();

  return useMemo(
    () => ({
      score: assessment?.overallScore ?? 0,
      grade: assessment?.grade ?? 'F',
      isLoading,
    }),
    [assessment, isLoading]
  );
}

/**
 * Hook to get recommendations
 */
export function useRecommendations(options?: {
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  dimension?: AssessmentDimension;
  limit?: number;
}): {
  recommendations: ImprovementRecommendation[];
  totalCount: number;
  isLoading: boolean;
} {
  const { assessment, isLoading } = useAIReadinessContext();

  return useMemo(() => {
    if (!assessment) {
      return { recommendations: [], totalCount: 0, isLoading };
    }

    let filtered = assessment.recommendations;

    if (options?.priority) {
      filtered = filtered.filter((r) => r.priority === options.priority);
    }

    if (options?.dimension) {
      filtered = filtered.filter((r) => r.dimension === options.dimension);
    }

    const totalCount = filtered.length;

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return { recommendations: filtered, totalCount, isLoading };
  }, [assessment, isLoading, options?.priority, options?.dimension, options?.limit]);
}

/**
 * Hook to get a specific dimension score
 */
export function useDimensionScore(dimension: AssessmentDimension): {
  score: number;
  penalties: Array<{ amount: number; reason: string }>;
  bonuses: Array<{ amount: number; reason: string }>;
  isLoading: boolean;
} {
  const { assessment, isLoading } = useAIReadinessContext();

  return useMemo(() => {
    if (!assessment) {
      return { score: 0, penalties: [], bonuses: [], isLoading };
    }

    const score = assessment.breakdown[dimension] ?? 0;
    const dimensionResult = assessment.dimensionScores.get(dimension);

    return {
      score,
      penalties: dimensionResult?.penalties ?? [],
      bonuses: dimensionResult?.bonuses ?? [],
      isLoading,
    };
  }, [assessment, dimension, isLoading]);
}

/**
 * Hook to get effort estimate
 */
export function useEffortEstimate(): {
  estimate: EffortEstimate | null;
  totalHours: number;
  targetScore: number;
  isLoading: boolean;
} {
  const { assessment, isLoading } = useAIReadinessContext();

  return useMemo(() => {
    if (!assessment) {
      return { estimate: null, totalHours: 0, targetScore: 0, isLoading };
    }

    return {
      estimate: assessment.effortEstimate,
      totalHours: assessment.effortEstimate.totalHours,
      targetScore: assessment.effortEstimate.targetScore,
      isLoading,
    };
  }, [assessment, isLoading]);
}

/**
 * Hook to get score breakdown
 */
export function useScoreBreakdown(): {
  breakdown: FullScoreBreakdown | null;
  isLoading: boolean;
} {
  const { assessment, isLoading } = useAIReadinessContext();

  return useMemo(
    () => ({
      breakdown: assessment?.breakdown ?? null,
      isLoading,
    }),
    [assessment, isLoading]
  );
}

/**
 * Hook to get assessment progress
 */
export function useAssessmentProgress(): {
  progress: { phase: string; step: string; percentage: number } | null;
  isLoading: boolean;
} {
  const { progress, isLoading } = useAIReadinessContext();

  return useMemo(
    () => ({
      progress: progress
        ? {
            phase: progress.phase,
            step: progress.step,
            percentage: progress.percentage,
          }
        : null,
      isLoading,
    }),
    [progress, isLoading]
  );
}

/**
 * Hook to get quick wins (low effort, high impact)
 */
export function useQuickWins(limit: number = 5): {
  recommendations: ImprovementRecommendation[];
  isLoading: boolean;
} {
  const { assessment, isLoading } = useAIReadinessContext();

  return useMemo(() => {
    if (!assessment) {
      return { recommendations: [], isLoading };
    }

    const quickWins = assessment.recommendations
      .filter(
        (r) =>
          r.effort === 'LOW' && (r.impact === 'HIGH' || r.impact === 'MEDIUM')
      )
      .slice(0, limit);

    return { recommendations: quickWins, isLoading };
  }, [assessment, isLoading, limit]);
}

/**
 * Hook to get assessment details
 */
export function useAssessmentDetails(): {
  largeFilesCount: number;
  complexFunctionsCount: number;
  antiPatternsCount: number;
  isLoading: boolean;
} {
  const { assessment, isLoading } = useAIReadinessContext();

  return useMemo(() => {
    if (!assessment) {
      return {
        largeFilesCount: 0,
        complexFunctionsCount: 0,
        antiPatternsCount: 0,
        isLoading,
      };
    }

    return {
      largeFilesCount: assessment.details.largeFiles.length,
      complexFunctionsCount: assessment.details.complexFunctions.length,
      antiPatternsCount: Object.values(assessment.details.antiPatternsByCategory).reduce(
        (sum, patterns) => sum + patterns.length,
        0
      ),
      isLoading,
    };
  }, [assessment, isLoading]);
}

/**
 * Hook to check if assessment meets a target score
 */
export function useMeetsTarget(targetScore: number): {
  meetsTarget: boolean;
  gap: number;
  isLoading: boolean;
} {
  const { assessment, isLoading } = useAIReadinessContext();

  return useMemo(() => {
    if (!assessment) {
      return { meetsTarget: false, gap: targetScore, isLoading };
    }

    const meetsTarget = assessment.overallScore >= targetScore;
    const gap = meetsTarget ? 0 : targetScore - assessment.overallScore;

    return { meetsTarget, gap, isLoading };
  }, [assessment, targetScore, isLoading]);
}
