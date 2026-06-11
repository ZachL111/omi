import { ipcMain } from 'electron'
import { getValidToken, forceRefreshToken } from './auth'
import { settings } from './settings'
import { pythonBaseURL, rustBaseURL } from './env'
import type { ApiRequest, ApiResponse } from '../shared/types'

// All HTTP goes through the main process (no CORS, Node fetch), mirroring APIClient.swift:
// Bearer auth, platform header, BYOK headers, one forced refresh + retry on 401.

// Security: the renderer only ever supplies a relative path + a `base` selector.
// We always build the final URL from the trusted, settings-configured base so a
// compromised renderer can't redirect the Firebase Bearer token / BYOK keys to a
// foreign host. Absolute URLs are only honored if their origin matches one of the
// configured backends.
function allowedOrigins(): Set<string> {
  const s = settings.get()
  const origins = new Set<string>()
  for (const url of [pythonBaseURL(s.pythonApiUrl), rustBaseURL(s.rustApiUrl)]) {
    try {
      origins.add(new URL(url).origin)
    } catch {
      // ignore malformed override
    }
  }
  return origins
}

function resolveUrl(req: ApiRequest): string {
  const s = settings.get()
  const base = req.base === 'rust' ? rustBaseURL(s.rustApiUrl) : pythonBaseURL(s.pythonApiUrl)
  if (/^https?:\/\//i.test(req.url)) {
    let origin: string
    try {
      origin = new URL(req.url).origin
    } catch {
      throw new Error('apiProxy: malformed absolute URL rejected')
    }
    if (!allowedOrigins().has(origin)) {
      throw new Error(`apiProxy: refusing to send credentials to non-backend host ${origin}`)
    }
    return req.url
  }
  return base + req.url.replace(/^\//, '')
}

async function buildHeaders(req: ApiRequest, token: string | null): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': req.contentType || 'application/json',
    'X-App-Platform': 'windows',
    'X-Request-Start-Time': String(Math.floor(Date.now() / 1000))
  }
  if (token && !req.anonymous) headers['Authorization'] = `Bearer ${token}`
  const s = settings.get()
  if (s.byokOpenAI) headers['X-BYOK-OpenAI'] = s.byokOpenAI
  if (s.byokAnthropic) headers['X-BYOK-Anthropic'] = s.byokAnthropic
  if (s.byokGemini) headers['X-BYOK-Gemini'] = s.byokGemini
  if (s.byokDeepgram) headers['X-BYOK-Deepgram'] = s.byokDeepgram
  return headers
}

async function doFetch(req: ApiRequest, token: string | null): Promise<Response> {
  return fetch(resolveUrl(req), {
    method: req.method,
    headers: await buildHeaders(req, token),
    body: req.body ?? undefined
  })
}

export async function apiRequest(req: ApiRequest): Promise<ApiResponse> {
  let token = req.anonymous ? null : await getValidToken()
  let res = await doFetch(req, token)
  if (res.status === 401 && !req.anonymous) {
    token = await forceRefreshToken()
    if (token) res = await doFetch(req, token)
  }
  return { status: res.status, body: await res.text() }
}

/** Binary variant for endpoints that return audio (TTS). Returns base64 body. */
export async function apiRequestBinary(req: ApiRequest): Promise<{ status: number; base64: string; contentType: string }> {
  let token = req.anonymous ? null : await getValidToken()
  let res = await doFetch(req, token)
  if (res.status === 401 && !req.anonymous) {
    token = await forceRefreshToken()
    if (token) res = await doFetch(req, token)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  return { status: res.status, base64: buf.toString('base64'), contentType: res.headers.get('content-type') || '' }
}

export function registerApiIpc(): void {
  ipcMain.handle('api:request', async (_e, req: ApiRequest) => apiRequest(req))
  ipcMain.handle('api:request-binary', async (_e, req: ApiRequest) => apiRequestBinary(req))

  // Streaming (SSE) variant: emits api:stream:<id> events {type:'chunk'|'done'|'error'} to the caller.
  ipcMain.handle('api:stream', async (e, id: string, req: ApiRequest) => {
    const sender = e.sender
    const emit = (payload: Record<string, unknown>) => {
      if (!sender.isDestroyed()) sender.send(`api:stream:${id}`, payload)
    }
    try {
      let token = req.anonymous ? null : await getValidToken()
      let res = await doFetch(req, token)
      if (res.status === 401 && !req.anonymous) {
        token = await forceRefreshToken()
        if (token) res = await doFetch(req, token)
      }
      if (!res.ok || !res.body) {
        emit({ type: 'error', status: res.status, body: await res.text() })
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        emit({ type: 'chunk', data: decoder.decode(value, { stream: true }) })
      }
      emit({ type: 'done' })
    } catch (err) {
      emit({ type: 'error', status: 0, body: String(err) })
    }
  })
}
