import { describe, it, expect } from 'vitest'
import { CHAINS, getChainRpcs, getChainName, getSupportedChainIds } from '../src/core/chains.js'

describe('chains', () => {
  it('has Ethereum', () => {
    expect(CHAINS[1]).toBeDefined()
    expect(CHAINS[1]!.name).toBe('Ethereum')
    expect(CHAINS[1]!.rpcs.length).toBeGreaterThanOrEqual(3)
  })

  it('has BSC', () => {
    expect(CHAINS[56]).toBeDefined()
    expect(CHAINS[56]!.name).toBe('BSC')
  })

  it('has Polygon', () => {
    expect(CHAINS[137]).toBeDefined()
  })

  it('has Arbitrum', () => {
    expect(CHAINS[42161]).toBeDefined()
  })

  it('has Optimism', () => {
    expect(CHAINS[10]).toBeDefined()
  })

  it('has Base', () => {
    expect(CHAINS[8453]).toBeDefined()
  })

  it('has Avalanche', () => {
    expect(CHAINS[43114]).toBeDefined()
  })

  it('has at least 10 chains', () => {
    expect(getSupportedChainIds().length).toBeGreaterThanOrEqual(10)
  })
})

describe('getChainRpcs', () => {
  it('returns RPCs for known chain', () => {
    const rpcs = getChainRpcs(1)
    expect(rpcs.length).toBeGreaterThanOrEqual(3)
    expect(rpcs[0]!.startsWith('https://')).toBe(true)
  })

  it('returns empty for unknown chain', () => {
    expect(getChainRpcs(999999)).toEqual([])
  })
})

describe('getChainName', () => {
  it('returns name for known chain', () => {
    expect(getChainName(1)).toBe('Ethereum')
    expect(getChainName(56)).toBe('BSC')
  })

  it('returns null for unknown chain', () => {
    expect(getChainName(999999)).toBeNull()
  })
})
