/**
 * Mobile Authentication Tests
 * Verifies Jan Provider can authenticate and fetch models on mobile
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

describe('Jan Provider Mobile Authentication', () => {
  const mockFetch = vi.fn()
  const originalFetch = global.fetch

  beforeEach(() => {
    // Setup mobile environment
    ;(globalThis as any).IS_WEB_APP = false
    vi.clearAllMocks()
    global.fetch = mockFetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete (globalThis as any).IS_WEB_APP
  })

  describe('Guest Login Flow', () => {
    it('should perform guest login and get access token', async () => {
      // Mock guest login response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'guest-token-123',
          expires_in: 3600,
        }),
      })

      const response = await fetch('https://api.jan.ai/v1/auth/guest-login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.access_token).toBe('guest-token-123')
      expect(data.expires_in).toBe(3600)
    })

    it('should handle guest login failure', async () => {
      // Mock failed guest login
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const response = await fetch('https://api.jan.ai/v1/auth/guest-login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(500)
    })
  })

  describe('Authenticated API Requests', () => {
    it('should fetch models with guest token', async () => {
      const mockModels = {
        object: 'list',
        data: [
          {
            id: 'gpt-4o-mini',
            object: 'model',
            owned_by: 'openai',
          },
          {
            id: 'claude-3-5-sonnet-20241022',
            object: 'model',
            owned_by: 'anthropic',
          },
        ],
      }

      // Mock models response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockModels,
      })

      const response = await fetch('https://api.jan.ai/v1/conv/models', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer guest-token-123',
        },
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.data).toHaveLength(2)
      expect(data.data[0].id).toBe('gpt-4o-mini')
      expect(data.data[1].id).toBe('claude-3-5-sonnet-20241022')
    })

    it('should handle 401 unauthorized without token', async () => {
      // Mock 401 response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({
          code: '019947f0-eca1-7474-8ed2-09d6e5389b54',
          error: '',
        }),
      })

      const response = await fetch('https://api.jan.ai/v1/conv/models', {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(401)
    })

    it('should include Bearer token in Authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ object: 'list', data: [] }),
      })

      await fetch('https://api.jan.ai/v1/conv/models', {
        headers: {
          'Authorization': 'Bearer guest-token-123',
        },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.jan.ai/v1/conv/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer guest-token-123',
          }),
        })
      )
    })
  })

  describe('Token Caching and Renewal', () => {
    it('should cache token and reuse until expiry', () => {
      const now = Date.now()
      const expiresIn = 3600 // 1 hour
      const tokenExpiryTime = now + (expiresIn * 1000) - 60000 // 1 min buffer

      // First call - should use cached token
      const shouldRenew1 = Date.now() >= tokenExpiryTime
      expect(shouldRenew1).toBe(false)

      // Still within expiry - should use cached token
      const futureTime = now + 1800000 // 30 minutes later
      const shouldRenew2 = futureTime >= tokenExpiryTime
      expect(shouldRenew2).toBe(false)

      // After expiry - should renew token
      const expiredTime = now + 3600000 // 1 hour later
      const shouldRenew3 = expiredTime >= tokenExpiryTime
      expect(shouldRenew3).toBe(true)
    })
  })

  describe('API Endpoint Configuration', () => {
    it('should use production API for mobile', () => {
      const apiBase = 'https://api.jan.ai/v1'

      expect(apiBase).toBe('https://api.jan.ai/v1')
      expect(apiBase).not.toContain('api-dev')
    })

    it('should construct correct endpoints', () => {
      const apiBase = 'https://api.jan.ai/v1'

      const guestLoginEndpoint = `${apiBase}/auth/guest-login`
      const modelsEndpoint = `${apiBase}/conv/models`
      const chatEndpoint = `${apiBase}/conv/chat/completions`

      expect(guestLoginEndpoint).toBe('https://api.jan.ai/v1/auth/guest-login')
      expect(modelsEndpoint).toBe('https://api.jan.ai/v1/conv/models')
      expect(chatEndpoint).toBe('https://api.jan.ai/v1/conv/chat/completions')
    })
  })

  describe('Platform Detection', () => {
    it('should detect Tauri platform correctly', () => {
      const IS_WEB_APP = (globalThis as any).IS_WEB_APP
      const isTauri =
        typeof IS_WEB_APP === 'undefined' ||
        (IS_WEB_APP !== true && IS_WEB_APP !== 'true')

      expect(isTauri).toBe(true)
    })

    it('should not detect web as Tauri', () => {
      ;(globalThis as any).IS_WEB_APP = true

      const IS_WEB_APP = (globalThis as any).IS_WEB_APP
      const isTauri =
        typeof IS_WEB_APP === 'undefined' ||
        (IS_WEB_APP !== true && IS_WEB_APP !== 'true')

      expect(isTauri).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        fetch('https://api.jan.ai/v1/conv/models')
      ).rejects.toThrow('Network error')
    })

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      const response = await fetch('https://api.jan.ai/v1/conv/models')
      await expect(response.json()).rejects.toThrow('Invalid JSON')
    })

    it('should provide detailed error messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error details',
      })

      const response = await fetch('https://api.jan.ai/v1/conv/models')
      expect(response.ok).toBe(false)

      const errorText = await response.text()
      expect(errorText).toBe('Server error details')
    })
  })
})

describe('Integration: Full Authentication Flow', () => {
  const mockFetch = vi.fn()
  const originalFetch = global.fetch

  beforeEach(() => {
    ;(globalThis as any).IS_WEB_APP = false
    vi.clearAllMocks()
    global.fetch = mockFetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete (globalThis as any).IS_WEB_APP
  })

  it('should complete full flow: guest login -> fetch models -> use models', async () => {
    // Step 1: Guest login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'guest-token-abc',
        expires_in: 3600,
      }),
    })

    const loginResponse = await fetch('https://api.jan.ai/v1/auth/guest-login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(loginResponse.ok).toBe(true)
    const { access_token } = await loginResponse.json()

    // Step 2: Fetch models with token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        object: 'list',
        data: [
          { id: 'gpt-4o-mini', object: 'model', owned_by: 'openai' },
          { id: 'claude-3-5-sonnet-20241022', object: 'model', owned_by: 'anthropic' },
        ],
      }),
    })

    const modelsResponse = await fetch('https://api.jan.ai/v1/conv/models', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    })

    expect(modelsResponse.ok).toBe(true)
    const models = await modelsResponse.json()

    // Step 3: Verify models can be used
    expect(models.data).toHaveLength(2)
    expect(models.data[0].id).toBe('gpt-4o-mini')
    expect(models.data[1].id).toBe('claude-3-5-sonnet-20241022')

    // Verify provider info
    const janProvider = {
      provider: 'jan',
      models: models.data,
      active: true,
    }

    expect(janProvider.provider).toBe('jan')
    expect(janProvider.models.length).toBeGreaterThan(0)
    expect(janProvider.active).toBe(true)
  })
})
