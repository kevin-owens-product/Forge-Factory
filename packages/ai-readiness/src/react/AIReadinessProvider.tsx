/**
 * @package @forge/ai-readiness
 * @description React context provider for AI-readiness assessment
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type {
  AIReadinessAssessment,
  AssessmentProgress,
  AssessmentDimension,
  ImprovementRecommendation,
} from '../ai-readiness.types.js';

/**
 * AI-Readiness context value
 */
export interface AIReadinessContextValue {
  /** Current assessment result */
  assessment: AIReadinessAssessment | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Assessment progress */
  progress: AssessmentProgress | null;
  /** Set assessment directly */
  setAssessment: (assessment: AIReadinessAssessment | null) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error state */
  setError: (error: Error | null) => void;
  /** Set progress */
  setProgress: (progress: AssessmentProgress | null) => void;
  /** Clear assessment */
  clearAssessment: () => void;
  /** Get dimension score */
  getDimensionScore: (dimension: AssessmentDimension) => number;
  /** Get recommendations for dimension */
  getRecommendationsForDimension: (dimension: AssessmentDimension) => ImprovementRecommendation[];
  /** Get high priority recommendations */
  getHighPriorityRecommendations: () => ImprovementRecommendation[];
}

/**
 * AI-Readiness context
 */
const AIReadinessContext = createContext<AIReadinessContextValue | null>(null);

/**
 * AI-Readiness Provider props
 */
export interface AIReadinessProviderProps {
  /** Child components */
  children: ReactNode;
  /** Initial assessment (optional) */
  initialAssessment?: AIReadinessAssessment | null;
}

/**
 * AI-Readiness Provider component
 */
export function AIReadinessProvider({
  children,
  initialAssessment = null,
}: AIReadinessProviderProps): React.ReactElement {
  const [assessment, setAssessment] = useState<AIReadinessAssessment | null>(initialAssessment);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<AssessmentProgress | null>(null);

  const clearAssessment = useCallback(() => {
    setAssessment(null);
    setError(null);
    setProgress(null);
  }, []);

  const getDimensionScore = useCallback(
    (dimension: AssessmentDimension): number => {
      if (!assessment) return 0;
      return assessment.breakdown[dimension] ?? 0;
    },
    [assessment]
  );

  const getRecommendationsForDimension = useCallback(
    (dimension: AssessmentDimension): ImprovementRecommendation[] => {
      if (!assessment) return [];
      return assessment.recommendations.filter((r: ImprovementRecommendation) => r.dimension === dimension);
    },
    [assessment]
  );

  const getHighPriorityRecommendations = useCallback((): ImprovementRecommendation[] => {
    if (!assessment) return [];
    return assessment.recommendations.filter((r: ImprovementRecommendation) => r.priority === 'HIGH');
  }, [assessment]);

  const value: AIReadinessContextValue = {
    assessment,
    isLoading,
    error,
    progress,
    setAssessment,
    setLoading,
    setError,
    setProgress,
    clearAssessment,
    getDimensionScore,
    getRecommendationsForDimension,
    getHighPriorityRecommendations,
  };

  return (
    <AIReadinessContext.Provider value={value}>
      {children}
    </AIReadinessContext.Provider>
  );
}

/**
 * Hook to access AI-Readiness context
 */
export function useAIReadinessContext(): AIReadinessContextValue {
  const context = useContext(AIReadinessContext);
  if (!context) {
    throw new Error('useAIReadinessContext must be used within an AIReadinessProvider');
  }
  return context;
}
