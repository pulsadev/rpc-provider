import { describe, it, expect, afterEach, vi } from 'vitest'
import { Endpoint } from '../src/core/endpoint.js'

describe('Endpoint', () => {
  it('creates from string URL', () => {
    const ep = new Endpoint('https://eth.llamarpc.com')
    expect(ep.url).toBe('https://eth.llamarpc.com')
    expect(ep.weight).toBe(1)
    expect(ep.healthy).toBe(true)
  })

  it('creates from config object', () => {
    const ep = new Endpoint({ url: 'https://eth.llamarpc.com', weight: 5, timeoutMs: 5000 })
    expect(ep.url).toBe('https://eth.llamarpc.com')
    expect(ep.weight).toBe(5)
    expect(ep.timeoutMs).toBe(5000)
  })

  it('initial stats are clean', () => {
    const ep = new Endpoint('https://example.com')
    const stats = ep.getStats()
    expect(stats.healthy).toBe(true)
    expect(stats.successCount).toBe(0)
    expect(stats.errorCount).toBe(0)
    expect(stats.lastError).toBeNull()
  })
})

describe('Endpoint health tracking', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalFetch })

  it('marks unhealthy after repeated errors (>50% error rate with >5 errors)', async () => {
    let callCount = 0

    globalThis.fetch = vi.fn(async () => {
      callCount++
      throw new Error('network error')
    }) as typeof fetch

    const ep = new Endpoint({ url: 'https://failing.test', maxRetries: 0, timeoutMs: 5000 })

    // Make 6+ calls that all fail — error rate >50% with >5 errors => unhealthy
    for (let i = 0; i < 7; i++) {
      try {
        await ep.call('eth_chainId', [], i)
      } catch {
        // expected
      }
    }

    expect(ep.healthy).toBe(false)
    expect(ep.errorCount).toBe(7)
    expect(ep.getStats().lastError).toBe('network error')
  })

  it('stays healthy when error rate is below threshold', async () => {
    let callCount = 0

    globalThis.fetch = vi.fn(async () => {
      callCount++
      // First 8 calls succeed, then 2 fail — error rate 2/10 = 20% < 50%
      if (callCount <= 8) {
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x1' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      throw new Error('intermittent')
    }) as typeof fetch

    const ep = new Endpoint({ url: 'https://mostly-ok.test', maxRetries: 0, timeoutMs: 5000 })

    for (let i = 0; i < 10; i++) {
      try {
        await ep.call('eth_chainId', [], i)
      } catch {
        // expected for last 2
      }
    }

    // 8 successes, 2 errors → 20% error rate, not > 50%, stays healthy
    expect(ep.healthy).toBe(true)
    expect(ep.successCount).toBe(8)
    expect(ep.errorCount).toBe(2)
  })
})

describe('Endpoint timeout', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalFetch })

  it('aborts request when timeout is exceeded', async () => {
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      // Simulate a slow response that respects abort signal
      return new Promise<Response>((_resolve, reject) => {
        const timer = setTimeout(() => {
          _resolve(new Response(
            JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x1' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ))
        }, 5000) // much longer than timeout

        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    }) as typeof fetch

    const ep = new Endpoint({ url: 'https://slow.test', maxRetries: 0, timeoutMs: 100 })

    await expect(ep.call('eth_chainId', [], 1)).rejects.toThrow()
    expect(ep.errorCount).toBe(1)
    expect(ep.healthy).toBe(true) // only 1 error, not enough to be unhealthy
  })
})
