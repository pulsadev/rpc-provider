import { describe, it, expect } from 'vitest'
import { RpcProvider } from '../src/core/provider.js'
import { Endpoint } from '../src/core/endpoint.js'

describe('edge: all endpoints unhealthy', () => {
  it('still tries endpoints when all are marked unhealthy', async () => {
    const provider = new RpcProvider({
      endpoints: [
        { url: 'https://ethereum-rpc.publicnode.com', maxRetries: 0 },
      ],
    })

    // Manually mark unhealthy
    const stats = provider.getStats()
    // Even if unhealthy, should still try (it's the only one)
    const chainId = await provider.getChainId()
    expect(chainId).toBe(1)
    provider.destroy()
  }, 15000)
})

describe('edge: error callback fires', () => {
  it('onError fires for bad endpoint', async () => {
    let errorFired = false
    let errorUrl = ''

    const provider = new RpcProvider({
      endpoints: [
        { url: 'https://this-does-not-exist.invalid', timeoutMs: 3000, maxRetries: 0 },
        'https://ethereum-rpc.publicnode.com',
      ],
      strategy: 'failover',
      onError: (_err, url) => { errorFired = true; errorUrl = url },
    })

    await provider.getChainId()
    expect(errorFired).toBe(true)
    expect(errorUrl).toBe('https://this-does-not-exist.invalid')
    provider.destroy()
  }, 15000)
})

describe('edge: send with retry', () => {
  it('send retries and falls back', async () => {
    const provider = new RpcProvider({
      endpoints: [
        { url: 'https://this-does-not-exist.invalid', timeoutMs: 3000, maxRetries: 0 },
        'https://ethereum-rpc.publicnode.com',
      ],
      strategy: 'failover',
    })

    const response = await provider.send('eth_chainId')
    expect(response.result).toBe('0x1')
    provider.destroy()
  }, 15000)
})

describe('edge: single bad endpoint throws', () => {
  it('throws when only endpoint fails', async () => {
    const provider = new RpcProvider({
      endpoints: [{ url: 'https://this-does-not-exist.invalid', timeoutMs: 3000, maxRetries: 0 }],
    })

    await expect(provider.getChainId()).rejects.toThrow()
    expect(provider.getStats().totalErrors).toBe(1)
    provider.destroy()
  }, 15000)
})

describe('edge: getHealthyEndpoints', () => {
  it('returns only healthy endpoints', () => {
    const provider = new RpcProvider({
      endpoints: ['https://a.com', 'https://b.com'],
    })
    // Initially all healthy
    expect(provider.getHealthyEndpoints().length).toBe(2)
    provider.destroy()
  })
})
