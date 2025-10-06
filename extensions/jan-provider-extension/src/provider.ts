/**
 * Jan Provider Extension
 * Provides remote model inference through Jan API
 * Available on web and mobile platforms (disabled on desktop Tauri)
 */

import {
  AIEngine,
  modelInfo,
  SessionInfo,
  UnloadResult,
  chatCompletionRequest,
  chatCompletion,
  chatCompletionChunk,
  ImportOptions,
} from '@janhq/core'
import { janApiClient } from './api'
import { janProviderStore } from './store'
import type { JanChatMessage } from './types'

// Jan models support tools via MCP
const JAN_MODEL_CAPABILITIES = ['tools'] as const

export default class JanProviderExtension extends AIEngine {
  readonly provider = 'jan'
  private activeSessions: Map<string, SessionInfo> = new Map()
  private isDesktopTauri: boolean = false

  override async onLoad() {
    // Detect if we're running on desktop Tauri (not mobile)
    this.isDesktopTauri = this.detectDesktopTauri()

    // On desktop Tauri, do not load this extension
    if (this.isDesktopTauri) {
      console.log(
        'Jan Provider Extension: Disabled on desktop Tauri (use llamacpp instead)'
      )
      return
    }

    console.log('Loading Jan Provider Extension...')

    try {
      // Check and clear invalid Jan models (capabilities mismatch)
      this.validateJanModelsLocalStorage()

      // Don't initialize here - wait until auth service is ready
      // Models will be fetched lazily when list() is called
      console.log('Jan Provider Extension loaded successfully (models will be fetched on demand)')
    } catch (error) {
      console.error('Failed to load Jan Provider Extension:', error)
      throw error
    }

    super.onLoad()
  }

  /**
   * Detect if we're on desktop Tauri (not mobile)
   * Mobile platforms (iOS/Android) will have IS_IOS or IS_ANDROID set
   * Web platform will have IS_WEB_APP set to true
   * Desktop Tauri will have neither (or IS_WEB_APP = false)
   */
  private detectDesktopTauri(): boolean {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return false
    }

    // Check for mobile-specific flags
    const IS_IOS = (window as any).IS_IOS
    const IS_ANDROID = (window as any).IS_ANDROID
    const IS_WEB_APP = (window as any).IS_WEB_APP

    // If we're on mobile, not desktop
    if (IS_IOS === true || IS_ANDROID === true) {
      return false
    }

    // If we're on web app, not desktop
    if (IS_WEB_APP === true || IS_WEB_APP === 'true') {
      return false
    }

    // Check if Tauri API is available
    const hasTauriAPI = !!(window as any).__TAURI__

    // If Tauri API is available and we're not on mobile or web, we're on desktop Tauri
    return hasTauriAPI
  }

  // Verify Jan models capabilities in localStorage
  private validateJanModelsLocalStorage() {
    try {
      console.log('Validating Jan models in localStorage...')
      const storageKey = 'model-provider'
      const data = localStorage.getItem(storageKey)
      if (!data) return

      const parsed = JSON.parse(data)
      if (!parsed?.state?.providers) return

      let hasInvalidModel = false

      for (const provider of parsed.state.providers) {
        if (provider.provider === 'jan' && provider.models) {
          for (const model of provider.models) {
            console.log(`Checking Jan model: ${model.id}`, model.capabilities)
            if (
              JSON.stringify(model.capabilities) !==
              JSON.stringify(JAN_MODEL_CAPABILITIES)
            ) {
              hasInvalidModel = true
              console.log(
                `Found invalid Jan model: ${model.id}, clearing localStorage`
              )
              break
            }
          }
        }
        if (hasInvalidModel) break
      }

      if (hasInvalidModel) {
        localStorage.removeItem(storageKey)
        const afterRemoval = localStorage.getItem(storageKey)
        if (afterRemoval) {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              state: { providers: [] },
              version: parsed.version || 3,
            })
          )
        }
        console.log(
          'Cleared model-provider from localStorage due to invalid Jan capabilities'
        )
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to check Jan models:', error)
    }
  }

  override async onUnload() {
    console.log('Unloading Jan Provider Extension...')

    for (const sessionId of this.activeSessions.keys()) {
      await this.unload(sessionId)
    }

    janProviderStore.reset()
    console.log('Jan Provider Extension unloaded')
  }

  async get(modelId: string): Promise<modelInfo | undefined> {
    if (this.isDesktopTauri) return undefined

    return janApiClient
      .getModels()
      .then((list) => list.find((e) => e.id === modelId))
      .then((model) =>
        model
          ? {
              id: model.id,
              name: model.id,
              quant_type: undefined,
              providerId: this.provider,
              port: 443,
              sizeBytes: 0,
              tags: [],
              path: undefined,
              owned_by: model.owned_by,
              object: model.object,
              capabilities: [...JAN_MODEL_CAPABILITIES],
            }
          : undefined
      )
  }

  async list(): Promise<modelInfo[]> {
    if (this.isDesktopTauri) return []

    try {
      const janModels = await janApiClient.getModels()

      return janModels.map((model) => ({
        id: model.id,
        name: model.id,
        quant_type: undefined,
        providerId: this.provider,
        port: 443,
        sizeBytes: 0,
        tags: [],
        path: undefined,
        owned_by: model.owned_by,
        object: model.object,
        capabilities: [...JAN_MODEL_CAPABILITIES],
      }))
    } catch (error) {
      console.error('Failed to list Jan models:', error)
      throw error
    }
  }

  async load(modelId: string, _settings?: any): Promise<SessionInfo> {
    try {
      const sessionId = `jan-${modelId}-${Date.now()}`

      const sessionInfo: SessionInfo = {
        pid: Date.now(),
        port: 443,
        model_id: modelId,
        model_path: `remote:${modelId}`,
        api_key: '',
      }

      this.activeSessions.set(sessionId, sessionInfo)

      console.log(
        `Jan model session created: ${sessionId} for model ${modelId}`
      )
      return sessionInfo
    } catch (error) {
      console.error(`Failed to load Jan model ${modelId}:`, error)
      throw error
    }
  }

  async unload(sessionId: string): Promise<UnloadResult> {
    try {
      const session = this.activeSessions.get(sessionId)

      if (!session) {
        return {
          success: false,
          error: `Session ${sessionId} not found`,
        }
      }

      this.activeSessions.delete(sessionId)
      console.log(`Jan model session unloaded: ${sessionId}`)

      return { success: true }
    } catch (error) {
      console.error(`Failed to unload Jan session ${sessionId}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async chat(
    opts: chatCompletionRequest,
    abortController?: AbortController
  ): Promise<chatCompletion | AsyncIterable<chatCompletionChunk>> {
    try {
      if (abortController?.signal?.aborted) {
        throw new Error('Request was aborted')
      }

      const modelId = opts.model
      if (!modelId) {
        throw new Error('Model ID is required')
      }

      const janMessages: JanChatMessage[] = opts.messages.map((msg) => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content:
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content),
      }))

      const janRequest = {
        model: modelId,
        messages: janMessages,
        conversation_id: opts.thread_id,
        temperature: opts.temperature ?? undefined,
        max_tokens: opts.n_predict ?? undefined,
        top_p: opts.top_p ?? undefined,
        frequency_penalty: opts.frequency_penalty ?? undefined,
        presence_penalty: opts.presence_penalty ?? undefined,
        stream: opts.stream ?? false,
        stop: opts.stop ?? undefined,
        tools: opts.tools ?? undefined,
        tool_choice: opts.tool_choice ?? undefined,
      }

      if (opts.stream) {
        return this.createStreamingGenerator(janRequest, abortController)
      } else {
        const response = await janApiClient.createChatCompletion(janRequest)

        if (abortController?.signal?.aborted) {
          throw new Error('Request was aborted')
        }

        return {
          id: response.id,
          object: 'chat.completion' as const,
          created: response.created,
          model: response.model,
          choices: response.choices.map((choice) => ({
            index: choice.index,
            message: {
              role: choice.message.role,
              content: choice.message.content,
              reasoning: choice.message.reasoning,
              reasoning_content: choice.message.reasoning_content,
              tool_calls: choice.message.tool_calls,
            },
            finish_reason: (choice.finish_reason || 'stop') as
              | 'stop'
              | 'length'
              | 'tool_calls'
              | 'content_filter'
              | 'function_call',
          })),
          usage: response.usage,
        }
      }
    } catch (error) {
      console.error('Jan chat completion failed:', error)
      throw error
    }
  }

  private async *createStreamingGenerator(
    janRequest: any,
    abortController?: AbortController
  ) {
    let resolve: () => void
    let reject: (error: Error) => void
    const chunks: any[] = []
    let isComplete = false
    let error: Error | null = null

    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })

    const abortListener = () => {
      error = new Error('Request was aborted')
      reject(error)
    }

    if (abortController?.signal) {
      if (abortController.signal.aborted) {
        throw new Error('Request was aborted')
      }
      abortController.signal.addEventListener('abort', abortListener)
    }

    try {
      janApiClient.createStreamingChatCompletion(
        janRequest,
        (chunk) => {
          if (abortController?.signal?.aborted) {
            return
          }
          const streamChunk = {
            id: chunk.id,
            object: chunk.object,
            created: chunk.created,
            model: chunk.model,
            choices: chunk.choices.map((choice) => ({
              index: choice.index,
              delta: {
                role: choice.delta.role,
                content: choice.delta.content,
                reasoning: choice.delta.reasoning,
                reasoning_content: choice.delta.reasoning_content,
                tool_calls: choice.delta.tool_calls,
              },
              finish_reason: choice.finish_reason,
            })),
          }
          chunks.push(streamChunk)
        },
        () => {
          isComplete = true
          resolve()
        },
        (err) => {
          error = err
          reject(err)
        }
      )

      let yieldedIndex = 0
      while (!isComplete && !error) {
        if (abortController?.signal?.aborted) {
          throw new Error('Request was aborted')
        }

        while (yieldedIndex < chunks.length) {
          yield chunks[yieldedIndex]
          yieldedIndex++
        }

        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      while (yieldedIndex < chunks.length) {
        yield chunks[yieldedIndex]
        yieldedIndex++
      }

      if (error) {
        throw error
      }

      await promise
    } finally {
      if (abortController?.signal) {
        abortController.signal.removeEventListener('abort', abortListener)
      }
    }
  }

  async delete(modelId: string): Promise<void> {
    throw new Error(
      `Delete operation not supported for remote Jan API model: ${modelId}`
    )
  }

  async update(modelId: string, _model: Partial<modelInfo>): Promise<void> {
    throw new Error(
      `Update operation not supported for remote Jan API model: ${modelId}`
    )
  }

  async import(modelId: string, _opts: ImportOptions): Promise<void> {
    throw new Error(
      `Import operation not supported for remote Jan API model: ${modelId}`
    )
  }

  async abortImport(modelId: string): Promise<void> {
    throw new Error(
      `Abort import operation not supported for remote Jan API model: ${modelId}`
    )
  }

  async getLoadedModels(): Promise<string[]> {
    return Array.from(this.activeSessions.values()).map(
      (session) => session.model_id
    )
  }

  async isToolSupported(modelId: string): Promise<boolean> {
    console.log(`Checking tool support for Jan model ${modelId}: supported`)
    return true
  }
}
