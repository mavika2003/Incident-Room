/**
 * Investigation timeline events keyed to an incident recordId.
 * authorId is userBound + immutable so clients cannot impersonate authors.
 * Notes and activity rows are append-only for members (no update/delete).
 */

import type { CollectionSchema } from 'deepspace/schema'

export const INVESTIGATION_EVENT_TYPES = [
  'note',
  'status_change',
  'assignment',
  'ai_analysis',
  'ai_review',
] as const

export const investigationEventsSchema: CollectionSchema = {
  name: 'investigation-events',
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
      name: 'type',
      storage: 'text',
      interpretation: { kind: 'select', options: [...INVESTIGATION_EVENT_TYPES] },
      required: true,
      immutable: true,
    },
    {
      name: 'body',
      storage: 'text',
      interpretation: 'plain',
      required: true,
      default: '',
    },
    {
      name: 'fromValue',
      storage: 'text',
      interpretation: 'plain',
      default: '',
      immutable: true,
    },
    {
      name: 'toValue',
      storage: 'text',
      interpretation: 'plain',
      default: '',
      immutable: true,
    },
    {
      name: 'authorId',
      storage: 'text',
      interpretation: 'plain',
      userBound: true,
      immutable: true,
    },
    {
      // Optional denormalized label; roster lookup is preferred for display.
      name: 'authorName',
      storage: 'text',
      interpretation: 'plain',
      default: '',
    },
  ],
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: false, delete: false },
    admin: { read: true, create: true, update: false, delete: true },
  },
}
