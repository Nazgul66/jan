/**
 * Jan Auth Client for Mobile
 * Handles authentication using guest login for mobile platforms
 */

interface AuthTokens {
  access_token: string
  expires_in: number
}

interface JanAuthService {
  getAuthHeader(): Promise<{ Authorization: string }>
  makeAuthenticatedRequest<T>(url: string, options?: RequestInit): Promise<T>
  initialize(): Promise<void>
  isAuthenticated(): boolean
}

declare global {
  interface Window {
    janAuthService?: JanAuthService
  }
}

let guestAccessToken: string | null = null
let guestTokenExpiry: number = 0

function getApiBase(): string {
  return 'https://api.jan.ai/v1'
}

/**
 * Perform guest login to obtain access token
 */
async function guestLogin(platformFetch: typeof fetch): Promise<AuthTokens> {
  const response = await platformFetch(`${getApiBase()}/auth/guest-login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Guest login failed: ${response.status}`)
  }

  return response.json() as Promise<AuthTokens>
}

/**
 * Ensure valid guest access token, refreshing if expired
 */
async function ensureGuestToken(platformFetch: typeof fetch): Promise<string> {
  if (guestAccessToken && Date.now() < guestTokenExpiry) {
    return guestAccessToken
  }

  const tokens = await guestLogin(platformFetch)
  guestAccessToken = tokens.access_token
  guestTokenExpiry = Date.now() + (tokens.expires_in * 1000) - 60000

  return guestAccessToken
}

export function getAuthService(): JanAuthService | null {
  return window.janAuthService || null
}

/**
 * Wait for auth service initialization (web platform)
 */
export async function waitForAuthService(
  maxWaitMs: number = 5000
): Promise<JanAuthService | null> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const authService = getAuthService()
    if (authService) return authService
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return null
}

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
    } catch (error) {
      console.warn('Tauri fetch unavailable, using native fetch')
      return fetch
    }
  }

  return fetch
}

/**
 * Make authenticated request to Jan API with automatic guest login
 */
export async function makeAuthenticatedRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const authService = await waitForAuthService()

  if (authService) {
    return authService.makeAuthenticatedRequest<T>(url, options)
  }

  const platformFetch = await getPlatformFetch()
  const accessToken = await ensureGuestToken(platformFetch)

  const response = await platformFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return response.json()
}

/**
 * Get authorization header with guest token
 */
export async function getAuthHeader(): Promise<{ Authorization?: string }> {
  const authService = await waitForAuthService()

  if (authService) {
    return authService.getAuthHeader()
  }

  const platformFetch = await getPlatformFetch()
  const accessToken = await ensureGuestToken(platformFetch)
  return { Authorization: `Bearer ${accessToken}` }
}
