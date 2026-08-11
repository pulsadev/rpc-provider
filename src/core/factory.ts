import type { ProviderOptions, Strategy } from '../types/index.js'
import { RpcProvider } from './provider.js'
import { getChainRpcs } from './chains.js'

export function createProvider(options: ProviderOptions): RpcProvider {
  return new RpcProvider(options)
}

export function createChainProvider(
  chainId: number,
  options?: { strategy?: Strategy; healthCheckIntervalMs?: number },
): RpcProvider {
  const rpcs = getChainRpcs(chainId)
  if (rpcs.length === 0) throw new Error(`No RPC endpoints for chain ${chainId}`)

  return new RpcProvider({
    endpoints: rpcs,
    strategy: options?.strategy ?? 'failover',
    healthCheckIntervalMs: options?.healthCheckIntervalMs,
  })
}

export function createFailoverProvider(urls: string[]): RpcProvider {
  return new RpcProvider({ endpoints: urls, strategy: 'failover' })
}

export function createLoadBalancedProvider(urls: string[]): RpcProvider {
  return new RpcProvider({ endpoints: urls, strategy: 'round-robin' })
}

export function createFastestProvider(urls: string[]): RpcProvider {
  return new RpcProvider({ endpoints: urls, strategy: 'fastest' })
}
