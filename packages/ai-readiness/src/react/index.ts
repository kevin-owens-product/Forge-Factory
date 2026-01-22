/**
 * @package @forge/ai-readiness
 * @description React components and hooks for AI-readiness assessment display
 */

export { AIReadinessProvider, useAIReadinessContext } from './AIReadinessProvider.js';
export {
  useAssessment,
  useAssessmentScore,
  useRecommendations,
  useDimensionScore,
  useEffortEstimate,
} from './hooks.js';
export { ScoreCard } from './ScoreCard.js';
export { ScoreBreakdown } from './ScoreBreakdown.js';
export { RecommendationList } from './RecommendationList.js';
export { AssessmentDashboard } from './AssessmentDashboard.js';
