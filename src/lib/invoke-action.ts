/**
 * Thin client helper for POST /api/actions/:name.
 */

import { getAuthToken } from 'deepspace'

export type ActionClientResult<T = unknown> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string }

export async function invokeAction<T = unknown>(
  name: string,
  params: Record<string, unknown> = {},
): Promise<ActionClientResult<T>> {
  const token = await getAuthToken()
  if (!token) {
    return { success: false, error: 'Not signed in' }
  }

  let response: Response
  try {
    response = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    })
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error calling action',
    }
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return {
      success: false,
      error: `Action failed with HTTP ${response.status}`,
    }
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    typeof (payload as { success: unknown }).success === 'boolean'
  ) {
    const result = payload as ActionClientResult<T>
    if (!result.success && !result.error) {
      return { success: false, error: `Action failed with HTTP ${response.status}` }
    }
    return result
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Action failed with HTTP ${response.status}`
    return { success: false, error: message }
  }

  return { success: false, error: 'Unexpected action response' }
}
