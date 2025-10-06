/**
 * Jan Provider Types
 */

export interface JanModel {
  id: string
  object: string
  owned_by: string
}

export interface JanModelsResponse {
  object: string
  data: JanModel[]
}

export interface JanChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  reasoning?: string
  reasoning_content?: string
  tool_calls?: any[]
}

export interface JanChatCompletionRequest {
  model: string
  messages: JanChatMessage[]
  conversation_id?: string
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  stream?: boolean
  stop?: string | string[]
  tools?: any[]
  tool_choice?: any
}

export interface JanChatCompletionChoice {
  index: number
  message: JanChatMessage
  finish_reason: string | null
}

export interface JanChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: JanChatCompletionChoice[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface JanChatCompletionChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
      reasoning?: string
      reasoning_content?: string
      tool_calls?: any[]
    }
    finish_reason: string | null
  }>
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public details?: string
  ) {
    super(`API Error ${status}: ${statusText}${details ? ` - ${details}` : ''}`)
    this.name = 'ApiError'
  }

  isStatus(code: number): boolean {
    return this.status === code
  }
}
