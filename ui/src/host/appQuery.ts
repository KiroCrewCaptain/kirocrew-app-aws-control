/**
 * `useAppQuery` / `useAppQueryKey`, the app-namespaced query cache.
 *
 * The dashboard's own hooks take the namespace from the host's identity context,
 * which grants one to built-in pages only, and are not on the App SDK. These keep
 * the built-in's keys exactly (`['aws-control', ...key]`), so the page's own
 * invalidations still match its queries, over the host's shared `@tanstack/react-query`.
 */
import { useCallback } from 'react'
import {
  useQuery,
  type DefaultError,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query'

export const APP_ID = 'aws-control'

export function resolveAppQueryKey(key: QueryKey): QueryKey {
  if (key.length > 0 && key[0] === APP_ID) return key
  return [APP_ID, ...key]
}

export function useAppQueryKey(): (key: QueryKey) => QueryKey {
  return useCallback((key: QueryKey) => resolveAppQueryKey(key), [])
}

export function useAppQuery<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData>(
  key: QueryKey,
  options: Omit<UseQueryOptions<TQueryFnData, TError, TData, QueryKey>, 'queryKey'>,
): UseQueryResult<TData, TError> {
  return useQuery<TQueryFnData, TError, TData, QueryKey>({
    ...options,
    queryKey: resolveAppQueryKey(key),
  })
}
