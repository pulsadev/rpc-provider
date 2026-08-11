import { describe, it, expect } from 'vitest'
import { RpcProvider } from '../src/core/provider.js'
import { createChainProvider } from '../src/core/factory.js'

const RPC = 'https://ethereum-rpc.publicnode.com'

describe('integration: single endpoint', () => {
  it('getChainId returns 1 for Ethereum', async () => {
    const provider = new RpcProvider({ endpoints: [RPC] })
    const chainId = await provider.getChainId()
    expect(chainId).toBe(1)
    provider.destroy()
  }, 15000)

  it('getBlockNumber returns valid block', async () => {
    const provider = new RpcProvider({ endpoints: [RPC] })
    const block = await provider.getBlockNumber()
    expect(block).toBeGreaterThan(20000000n)
    provider.destroy()
  }, 15000)

  it('getBalance returns bigint', async () => {
    const provider = new RpcProvider({ endpoints: [RPC] })
    const balance = await provider.getBalance('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')
    expect(balance).toBeGreaterThanOrEqual(0n)
    provider.destroy()
  }, 15000)

  it('call works (eth_chainId via call)', async () => {
    const provider = new RpcProvider({ endpoints: [RPC] })
    const result = await provider.request('eth_chainId')
    expect(result).toBe('0x1')
    provider.destroy()
  }, 15000)
})

describe('integration: failover', () => {
  it('falls back to second endpoint when first fails', async () => {
    let fellBack = false
    const provider = new RpcProvider({
      endpoints: [
        { url: 'https://this-does-not-exist-rpc.invalid', timeoutMs: 3000, maxRetries: 0 },
        RPC,
      ],
      strategy: 'failover',
      onFallback: () => { fellBack = true },
    })

    const chainId = await provider.getChainId()
    expect(chainId).toBe(1)
    expect(fellBack).toBe(true)
    provider.destroy()
  }, 20000)
})

describe('integration: createChainProvider', () => {
  it('creates working Ethereum provider', async () => {
    const provider = createChainProvider(1)
    const chainId = await provider.getChainId()
    expect(chainId).toBe(1)
    provider.destroy()
  }, 15000)
})

describe('integration: health check', () => {
  it('checkHealth returns results for all endpoints', async () => {
    const provider = new RpcProvider({
      endpoints: [RPC, 'https://eth.drpc.org'],
    })
    const results = await provider.checkHealth()
    expect(results.length).toBe(2)
    expect(results.some(r => r.healthy)).toBe(true)
    provider.destroy()
  }, 20000)
})

describe('integration: stats tracking', () => {
  it('tracks request count', async () => {
    const provider = new RpcProvider({ endpoints: [RPC] })
    await provider.getChainId()
    await provider.getBlockNumber()
    const stats = provider.getStats()
    expect(stats.totalRequests).toBe(2)
    provider.destroy()
  }, 15000)
})
