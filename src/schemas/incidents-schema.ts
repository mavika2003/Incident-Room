/**
 * Incidents collection - security investigation records.
 *
 * Assignment uses ownerField + update: 'unclaimed-or-own' so the Durable
 * Object enforces claim/release atomically: a client may only set
 * assigneeId to their own user id (or clear it when they own the claim).
 * Concurrent claims are serialized in the DO; the second write fails
 * canUpdate once the first claim lands.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const INCIDENT_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const
export const INCIDENT_STATUSES = [
  'open',
  'investigating',
  'contained',
  'resolved',
  'closed',
] as const
export const INCIDENT_SOURCES = ['live', 'synthetic'] as const

export const incidentsSchema: CollectionSchema = {
  name: 'incidents',
  ownerField: 'assigneeId',
  columns: [
    {
      name: 'displayId',
      storage: 'text',
      interpretation: 'plain',
      required: true,
      immutable: true,
    },
    {
      name: 'title',
      storage: 'text',
      interpretation: 'plain',
      required: true,
    },
    {
      name: 'description',
      storage: 'text',
      interpretation: 'plain',
      default: '',
    },
    {
      name: 'severity',
      storage: 'text',
      interpretation: { kind: 'select', options: [...INCIDENT_SEVERITIES] },
      required: true,
    },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: [...INCIDENT_STATUSES] },
      required: true,
      default: 'open',
    },
    {
      // Verified investigator user id. Empty string = unclaimed.
      // Not userBound: release must clear the field, and claim must set it to
      // the caller. The DO's unclaimed-or-own + checkUnclaimedOwnerTransition
      // refuse forging another user's id.
      name: 'assigneeId',
      storage: 'text',
      interpretation: 'plain',
      default: '',
    },
    {
      // Denormalized display name for the assignee (and synthetic demo labels).
      name: 'assigneeName',
      storage: 'text',
      interpretation: 'plain',
      default: '',
    },
    {
      name: 'source',
      storage: 'text',
      interpretation: { kind: 'select', options: [...INCIDENT_SOURCES] },
      required: true,
      default: 'live',
      immutable: true,
    },
  ],
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: true, create: false, update: false, delete: false },
    // Members may update only while unclaimed, or when they hold the claim.
    member: {
      read: true,
      create: true,
      update: 'unclaimed-or-own',
      delete: 'own',
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
