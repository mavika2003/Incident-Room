/**
 * Persisted AI triage reports. Creates flow only through server actions
 * (create: false for clients) so the worker can load the real incident,
 * run the model, and validate structured output before writing.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const AI_ANALYSIS_REVIEW_STATUSES = [
  'pending_review',
  'reviewed',
  'needs_further_investigation',
] as const

export const aiAnalysesSchema: CollectionSchema = {
  name: 'ai-analyses',
  columns: [
    {
      name: 'incidentId',
      storage: 'text',
      interpretation: {
        kind: 'reference',
        targetTable: 'incidents',
        displayColumn: 'displayId',
      },
      required: true,
      immutable: true,
    },
    {
      name: 'findings',
      storage: 'text',
      interpretation: { kind: 'json' },
      required: true,
    },
    {
      name: 'indicators',
      storage: 'text',
      interpretation: { kind: 'json' },
      required: true,
      default: [],
    },
    {
      name: 'modelId',
      storage: 'text',
      interpretation: 'plain',
      required: true,
      immutable: true,
    },
    {
      name: 'createdById',
      storage: 'text',
      interpretation: 'plain',
      userBound: true,
      immutable: true,
    },
    {
      name: 'createdByName',
      storage: 'text',
      interpretation: 'plain',
      default: '',
    },
    {
      name: 'reviewStatus',
      storage: 'text',
      interpretation: {
        kind: 'select',
        options: [...AI_ANALYSIS_REVIEW_STATUSES],
      },
      required: true,
      default: 'pending_review',
    },
    {
      name: 'reviewedById',
      storage: 'text',
      interpretation: 'plain',
      default: '',
    },
    {
      name: 'reviewedByName',
      storage: 'text',
      interpretation: 'plain',
      default: '',
    },
    {
      name: 'reviewedAt',
      storage: 'text',
      interpretation: { kind: 'datetime' },
      default: '',
    },
  ],
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: true, create: false, update: false, delete: false },
    // Writes only via server actions (X-App-Action).
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: false, update: true, delete: true },
  },
}
