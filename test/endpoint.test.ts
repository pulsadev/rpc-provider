import { describe, it, expect } from 'vitest'
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
