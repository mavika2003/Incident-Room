import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { analyzeIncident } from './analyze-incident'
import { reviewAiAnalysis } from './review-ai-analysis'

export const actions: Record<string, ActionHandler<Env>> = {
  analyzeIncident,
  reviewAiAnalysis,
}
