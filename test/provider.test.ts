import { describe, it, expect, afterEach, vi } from 'vitest'
import { RpcProvider } from '../src/core/provider.js'
import {
  createProvider,
  createChainProvider,
  createFailoverProvider,
  createLoadBalancedProvider,
  createFastestProvider,
} from '../src/core/factory.js'

describe('RpcProvider', () => {
  it('creates with single endpoint', () => {
    const provider = new RpcProvider({ endpoints: ['https://ethereum-rpc.publicnode.com'] })
    expect(provider.getEndpointCount()).toBe(1)
    provider.destroy()
  })

  it('creates with multiple endpoints', () => {
    const provider = new RpcProvider({
      endpoints: ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'],
    })
    expect(provider.getEndpointCount()).toBe(2)
    provider.destroy()
  })

  it('throws on empty endpoints', () => {
    expect(() => new RpcProvider({ endpoints: [] })).toThrow('At least one endpoint')
  })

  it('getStats returns valid shape', () => {
    const provider = new RpcProvider({ endpoints: ['https://ethereum-rpc.publicnode.com'] })
    const stats = provider.getStats()
    expect(stats.strategy).toBe('failover')
    expect(stats.endpoints.length).toBe(1)
    expect(stats.totalRequests).toBe(0)
    provider.destroy()
  })

  it('addEndpoint increases count', () => {
    const provider = new RpcProvider({ endpoints: ['https://ethereum-rpc.publicnode.com'] })
    provider.addEndpoint('https://eth.drpc.org')
    expect(provider.getEndpointCount()).toBe(2)
    provider.destroy()
  })

  it('removeEndpoint decreases count', () => {
    const provider = new RpcProvider({
      endpoints: ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'],
    })
    provider.removeEndpoint('https://eth.drpc.org')
    expect(provider.getEndpointCount()).toBe(1)
    provider.destroy()
  })
})

describe('factory functions', () => {
  it('createChainProvider for Ethereum', () => {
    const provider = createChainProvider(1)
    expect(provider.getEndpointCount()).toBeGreaterThanOrEqual(3)
    provider.destroy()
  })

  it('createChainProvider throws for unknown chain', () => {
    expect(() => createChainProvider(999999)).toThrow('No RPC endpoints')
  })

  it('createFailoverProvider', () => {
    const provider = createFailoverProvider(['https://a.com', 'https://b.com'])
    expect(provider.getStats().strategy).toBe('failover')
    provider.destroy()
  })

  it('createFastestProvider', () => {
    const provider = createFastestProvider(['https://a.com', 'https://b.com'])
    expect(provider.getStats().strategy).toBe('fastest')
    provider.destroy()
  })

  it('createLoadBalancedProvider creates provider with round-robin', () => {
    const provider = createLoadBalancedProvider(['https://a.com', 'https://b.com'])
    expect(provider.getStats().strategy).toBe('round-robin')
    expect(provider.getEndpointCount()).toBe(2)
    provider.destroy()
  })

  it('createProvider with custom options works', () => {
    const provider = createProvider({
      endpoints: [
        { url: 'https://a.com', weight: 3, maxRetries: 5 },
        { url: 'https://b.com', weight: 1 },
      ],
      strategy: 'random',
      retryDelayMs: 100,
    })
    expect(provider.getStats().strategy).toBe('random')
    expect(provider.getEndpointCount()).toBe(2)
    provider.destroy()
  })
})

// --- Mock-based strategy tests ---

function mockJsonRpc(result: unknown) {
  return { jsonrpc: '2.0', id: 1, result }
}

describe('strategy: round-robin', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalFetch })

  it('rotates endpoints across requests', async () => {
    const calledUrls: string[] = []

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      calledUrls.push(url)
      return new Response(JSON.stringify(mockJsonRpc('0x1')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    const provider = new RpcProvider({
      endpoints: ['https://rpc-a.test', 'https://rpc-b.test'],
      strategy: 'round-robin',
    })

    await provider.request('eth_chainId')
    await provider.request('eth_chainId')
    await provider.request('eth_chainId')
    await provider.request('eth_chainId')

    // Round-robin should alternate between the two URLs
    expect(calledUrls[0]).toBe('https://rpc-a.test')
    expect(calledUrls[1]).toBe('https://rpc-b.test')
    expect(calledUrls[2]).toBe('https://rpc-a.test')
    expect(calledUrls[3]).toBe('https://rpc-b.test')
    provider.destroy()
  })
})

describe('strategy: random', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalFetch })

  it('selects endpoints (does not always pick first)', async () => {
    const calledUrls: string[] = []

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      calledUrls.push(url)
      return new Response(JSON.stringify(mockJsonRpc('0x1')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    const provider = new RpcProvider({
      endpoints: ['https://rpc-a.test', 'https://rpc-b.test', 'https://rpc-c.test'],
      strategy: 'random',
    })

    // Make many requests — with random strategy, not all should hit the same URL
    for (let i = 0; i < 20; i++) {
      await provider.request('eth_chainId')
    }

    const unique = new Set(calledUrls)
    // Random should hit at least 2 of the 3 endpoints over 20 calls
    expect(unique.size).toBeGreaterThanOrEqual(2)
    provider.destroy()
  })
})

describe('strategy: fastest', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalFetch })

  it('prefers lower-latency endpoint', async () => {
    const calledUrls: string[] = []

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      calledUrls.push(url)

      // Simulate slow endpoint, fast endpoint
      if (url === 'https://slow.test') {
        await new Promise(r => setTimeout(r, 80))
      } else {
        await new Promise(r => setTimeout(r, 1))
      }

      return new Response(JSON.stringify(mockJsonRpc('0x1')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    // Warm up each endpoint individually so both have latency recorded
    const warmSlow = new RpcProvider({ endpoints: ['https://slow.test'], strategy: 'failover' })
    const warmFast = new RpcProvider({ endpoints: ['https://fast.test'], strategy: 'failover' })
    await warmSlow.request('eth_chainId')
    await warmFast.request('eth_chainId')
    warmSlow.destroy()
    warmFast.destroy()

    // Now create the fastest provider — both endpoints have latency stats
    // But RpcProvider creates new Endpoint instances, so we use a different approach:
    // Just make calls with both endpoints in the provider to populate latency
    const provider = new RpcProvider({
      endpoints: ['https://slow.test', 'https://fast.test'],
      strategy: 'failover', // use failover first to warm up
    })

    // Warm up: failover hits slow.test first (succeeds), so only slow gets latency
    // We need both to have latency. Use checkHealth which calls both.
    // Actually, let's just call both individually. Switch to a different approach:
    // Create provider, do health check to populate both latencies, then test.

    // Health check calls eth_chainId on every endpoint
    await provider.checkHealth()

    // Now both endpoints have latency data. Recreate with fastest strategy.
    provider.destroy()

    calledUrls.length = 0
    const fastProvider = new RpcProvider({
      endpoints: ['https://slow.test', 'https://fast.test'],
      strategy: 'fastest',
    })

    // Warm up by calling checkHealth which populates latency on all endpoints
    await fastProvider.checkHealth()
    calledUrls.length = 0

    // Now make requests — fastest should prefer fast.test
    for (let i = 0; i < 5; i++) {
      await fastProvider.request('eth_chainId')
    }

    // All calls should go to fast.test (lower latency)
    const fastCalls = calledUrls.filter(u => u === 'https://fast.test').length
    expect(fastCalls).toBeGreaterThanOrEqual(3)
    fastProvider.destroy()
  })
})

describe('provider methods with mock fetch', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalFetch })

  it('getCode returns hex bytecode', async () => {
    const bytecode = '0x6080604052348015600f57600080fd5b50'

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(mockJsonRpc(bytecode)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    const provider = new RpcProvider({ endpoints: ['https://mock.test'] })
    const result = await provider.getCode('0x1234567890abcdef1234567890abcdef12345678')
    expect(result).toBe(bytecode)
    provider.destroy()
  })

  it('estimateGas returns bigint', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(mockJsonRpc('0x5208')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    const provider = new RpcProvider({ endpoints: ['https://mock.test'] })
    const gas = await provider.estimateGas({ to: '0xabc', value: '0x0' })
    expect(gas).toBe(21000n)
    provider.destroy()
  })

  it('sendRawTransaction returns tx hash', async () => {
    const txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(mockJsonRpc(txHash)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    const provider = new RpcProvider({ endpoints: ['https://mock.test'] })
    const result = await provider.sendRawTransaction('0xf86c...')
    expect(result).toBe(txHash)
    provider.destroy()
  })

  it('onFallback callback fires with correct from/to URLs', async () => {
    let fallbackFrom = ''
    let fallbackTo = ''

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === 'https://bad.test') {
        throw new Error('connection refused')
      }
      return new Response(JSON.stringify(mockJsonRpc('0x1')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    const provider = new RpcProvider({
      endpoints: [
        { url: 'https://bad.test', maxRetries: 0 },
        { url: 'https://good.test', maxRetries: 0 },
      ],
      strategy: 'failover',
      onFallback: (from, to) => {
        fallbackFrom = from
        fallbackTo = to
      },
    })

    await provider.request('eth_chainId')
    expect(fallbackFrom).toBe('https://bad.test')
    expect(fallbackTo).toBe('https://good.test')
    provider.destroy()
  })
})
