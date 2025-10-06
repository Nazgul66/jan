/**
 * Jan Provider API Client
 * Handles API requests to Jan backend for models and chat completions
 */

import { makeAuthenticatedRequest, getAuthHeader } from './auth'
import { janProviderStore } from './store'
import type {
  JanModel,
  JanModelsResponse,
  JanChatCompletionRequest,
  JanChatCompletionResponse,
  JanChatCompletionChunk,
} from './types'

/**
 * Get platform-appropriate fetch (Tauri fetch for mobile, native for web)
 */
async function getPlatformFetch(): Promise<typeof fetch> {
  const IS_WEB_APP = (globalThis as any).IS_WEB_APP
  const isTauri = typeof IS_WEB_APP === 'undefined' ||
                  (IS_WEB_APP !== true && IS_WEB_APP !== 'true')

  if (isTauri) {
    try {
      const httpPlugin = await import('@tauri-apps/plugin-http')
      return httpPlugin.fetch as typeof fetch
    } catch {
      return fetch
    }
  }

  return fetch
}

/**
 * Get Jan API base URL (production only for mobile)
 */
function getApiBase(): string {
  if (typeof (globalThis as any).JAN_API_BASE !== 'undefined') {
    return (globalThis as any).JAN_API_BASE
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.JAN_API_BASE) {
    return import.meta.env.JAN_API_BASE
  }

  return 'https://api.jan.ai/v1'
}

const TEMPORARY_CHAT_ID = 'temporary-chat'

/**
 * Get chat completion endpoint and payload configuration
 */
function getChatCompletionConfig(
  request: JanChatCompletionRequest,
  stream: boolean = false
) {
  const endpoint = `${getApiBase()}/chat/completions`

  const payload = {
    ...request,
    stream,
    conversation_id: undefined,
  }

  return { endpoint, payload, isTemporaryChat: request.conversation_id === TEMPORARY_CHAT_ID }
}

export class JanApiClient {
  private static instance: JanApiClient

  private constructor() {}

  static getInstance(): JanApiClient {
    if (!JanApiClient.instance) {
      JanApiClient.instance = new JanApiClient()
    }
    return JanApiClient.instance
  }

  async getModels(): Promise<JanModel[]> {
    try {
      janProviderStore.setLoadingModels(true)
      janProviderStore.clearError()

      const apiBase = getApiBase()
      const response = await makeAuthenticatedRequest<JanModelsResponse>(
        `${apiBase}/conv/models`
      )

      const models = response.data || []
      janProviderStore.setModels(models)

      return models
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch models'
      janProviderStore.setError(errorMessage)
      janProviderStore.setLoadingModels(false)
      throw error
    }
  }

  async createChatCompletion(
    request: JanChatCompletionRequest
  ): Promise<JanChatCompletionResponse> {
    try {
      janProviderStore.clearError()

      const { endpoint, payload } = getChatCompletionConfig(request, false)

      return await makeAuthenticatedRequest<JanChatCompletionResponse>(
        endpoint,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to create chat completion'
      janProviderStore.setError(errorMessage)
      throw error
    }
  }

  async createStreamingChatCompletion(
    request: JanChatCompletionRequest,
    onChunk: (chunk: JanChatCompletionChunk) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      janProviderStore.clearError()

      const authHeader = await getAuthHeader()
      const { endpoint, payload } = getChatCompletionConfig(request, true)

      const platformFetch = await getPlatformFetch()
      const response = await platformFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')

          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6).trim()

              if (data === '[DONE]') {
                onComplete?.()
                return
              }

              try {
                const parsedChunk: JanChatCompletionChunk = JSON.parse(data)
                onChunk(parsedChunk)
              } catch (parseError) {
                console.warn(
                  'Failed to parse SSE chunk:',
                  parseError,
                  'Data:',
                  data
                )
              }
            }
          }
        }

        onComplete?.()
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error('Unknown error occurred')
      janProviderStore.setError(err.message)
      onError?.(err)
      throw err
    }
  }

  async initialize(): Promise<void> {
    try {
      janProviderStore.setAuthenticated(true)
      await this.getModels()
      console.log('Jan API client initialized successfully')
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to initialize API client'
      janProviderStore.setError(errorMessage)
      throw error
    } finally {
      janProviderStore.setInitializing(false)
    }
  }
}

export const janApiClient = JanApiClient.getInstance()
