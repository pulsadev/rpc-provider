import { describe, it, expect } from 'vitest'
import { RpcProvider } from '../src/core/provider.js'
import { createChainProvider, createFailoverProvider, createFastestProvider } from '../src/core/factory.js'

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
})
