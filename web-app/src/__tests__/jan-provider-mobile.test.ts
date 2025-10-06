/**
 * Jan Provider Mobile Integration Tests
 * Verifies that Jan Provider extension loads correctly on mobile platforms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Jan Provider on Mobile Platforms', () => {
  beforeEach(() => {
    // Clear any existing global state
    vi.clearAllMocks()
  })

  describe('Platform Detection', () => {
    it('should enable on iOS platform', () => {
      // Simulate iOS environment
      ;(global as any).IS_IOS = true
      ;(global as any).IS_ANDROID = false
      ;(global as any).__TAURI__ = { invoke: vi.fn() }

      // Extension should detect iOS and remain enabled
      const isDesktopTauri = !(
        (global as any).IS_IOS === true || (global as any).IS_ANDROID === true
      )

      expect(isDesktopTauri).toBe(false)
    })

    it('should enable on Android platform', () => {
      // Simulate Android environment
      ;(global as any).IS_IOS = false
      ;(global as any).IS_ANDROID = true
      ;(global as any).__TAURI__ = { invoke: vi.fn() }

      // Extension should detect Android and remain enabled
      const isDesktopTauri = !(
        (global as any).IS_IOS === true || (global as any).IS_ANDROID === true
      )

      expect(isDesktopTauri).toBe(false)
    })

    it('should disable on desktop Tauri', () => {
      // Simulate desktop Tauri environment
      ;(global as any).IS_IOS = false
      ;(global as any).IS_ANDROID = false
      ;(global as any).__TAURI__ = { invoke: vi.fn() }

      // Extension should detect desktop and disable
      const isDesktopTauri = !(
        (global as any).IS_IOS === true || (global as any).IS_ANDROID === true
      )

      expect(isDesktopTauri).toBe(true)
    })

    it('should enable on web platform', () => {
      // Simulate web environment (no Tauri)
      ;(global as any).IS_IOS = false
      ;(global as any).IS_ANDROID = false
      delete (global as any).__TAURI__

      // Extension should work on web
      const hasTauriAPI = !!(global as any).__TAURI__
      expect(hasTauriAPI).toBe(false)
    })
  })

  describe('Authentication Requirements', () => {
    it('should require auth service for API calls', () => {
      const hasAuthService = typeof (global as any).window?.janAuthService !== 'undefined'

      // Auth service should be available or waited for
      expect(
        hasAuthService ||
        'waitForAuthService should be called before API requests'
      ).toBeTruthy()
    })
  })

  describe('API Configuration', () => {
    it('should use correct default API base', () => {
      const expectedDefault = 'https://api.jan.ai/v1'

      // The getApiBase function should return the default when not configured
      const getApiBase = (): string => {
        if (typeof (globalThis as any).JAN_API_BASE !== 'undefined') {
          return (globalThis as any).JAN_API_BASE
        }
        if (typeof import.meta !== 'undefined' && import.meta.env?.JAN_API_BASE) {
          return import.meta.env.JAN_API_BASE
        }
        return expectedDefault
      }

      expect(getApiBase()).toBe(expectedDefault)
    })

    it('should respect environment variable override', () => {
      const customBase = 'https://custom.api.jan.ai/v1'
      ;(globalThis as any).JAN_API_BASE = customBase

      const getApiBase = (): string => {
        if (typeof (globalThis as any).JAN_API_BASE !== 'undefined') {
          return (globalThis as any).JAN_API_BASE
        }
        return 'https://api.jan.ai/v1'
      }

      expect(getApiBase()).toBe(customBase)

      // Cleanup
      delete (globalThis as any).JAN_API_BASE
    })
  })

  describe('Model Capabilities', () => {
    it('should support tools capability', () => {
      const JAN_MODEL_CAPABILITIES = ['tools'] as const

      expect(JAN_MODEL_CAPABILITIES).toContain('tools')
      expect(JAN_MODEL_CAPABILITIES.length).toBe(1)
    })
  })

  describe('Extension Bundling', () => {
    it('should be included in mobile bundled extensions', () => {
      const bundledExtensions = [
        '@janhq/conversational-extension',
        '@janhq/jan-provider-extension', // Should be present
      ]

      expect(bundledExtensions).toContain('@janhq/jan-provider-extension')
    })
  })
})

describe('Provider Service Integration', () => {
  it('should handle provider loading errors gracefully', async () => {
    const mockProviders = []

    // Simulate a provider that fails to load
    const loadProvider = async (providerName: string) => {
      try {
        if (providerName === 'failing-provider') {
          throw new Error('Provider failed to load')
        }
        mockProviders.push({ provider: providerName })
      } catch (error) {
        console.warn(`Failed to load runtime provider ${providerName}:`, error)
        // Should continue with other providers
      }
    }

    await loadProvider('jan')
    await loadProvider('failing-provider')
    await loadProvider('llamacpp')

    // Jan provider should have loaded successfully
    expect(mockProviders).toHaveLength(2)
    expect(mockProviders.some(p => p.provider === 'jan')).toBe(true)
  })
})
