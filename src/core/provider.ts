import type { ProviderOptions, Strategy, RpcResponse, ProviderStats, Hex } from '../types/index.js'
import { Endpoint } from './endpoint.js'

const DEFAULT_RETRY_DELAY = 500

export class RpcProvider {
  private endpoints: Endpoint[]
  private strategy: Strategy
  private retryDelayMs: number
  private currentIndex = 0
  private requestId = 1
  private totalRequests = 0
  private totalErrors = 0
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null
  private onError?: (error: Error, url: string) => void
  private onFallback?: (from: string, to: string) => void

  constructor(options: ProviderOptions) {
    if (!options.endpoints.length) throw new Error('At least one endpoint required')

    this.endpoints = options.endpoints.map(e => new Endpoint(e))
    this.strategy = options.strategy ?? 'failover'
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY
    this.onError = options.onError
    this.onFallback = options.onFallback

    if (options.healthCheckIntervalMs && options.healthCheckIntervalMs > 0) {
      this.startHealthCheck(options.healthCheckIntervalMs)
    }
  }

  async request(method: string, params: unknown[] = []): Promise<unknown> {
    this.totalRequests++
    const id = this.requestId++

    const orderedEndpoints = this.getEndpointOrder()
    const healthy = orderedEndpoints.filter(e => e.healthy)
    const tryOrder = healthy.length > 0 ? healthy : orderedEndpoints
    let lastError: Error | null = null

    for (const endpoint of tryOrder) {
      for (let attempt = 0; attempt <= endpoint.maxRetries; attempt++) {
        try {
          const response = await endpoint.call(method, params, id)

          if (response.error) {
            throw new Error(`RPC error ${response.error.code}: ${response.error.message}`)
          }

          return response.result
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          this.onError?.(lastError, endpoint.url)

          if (attempt < endpoint.maxRetries) {
            await this.delay(this.retryDelayMs * (attempt + 1))
          }
        }
      }

      const nextIdx = tryOrder.indexOf(endpoint) + 1
      if (nextIdx < tryOrder.length) {
        this.onFallback?.(endpoint.url, tryOrder[nextIdx]!.url)
      }
    }

    this.totalErrors++
    throw lastError ?? new Error('All endpoints failed')
  }

  async send(method: string, params: unknown[] = []): Promise<RpcResponse> {
    this.totalRequests++
    const id = this.requestId++

    const orderedEndpoints = this.getEndpointOrder()
    const healthy = orderedEndpoints.filter(e => e.healthy)
    const tryOrder = healthy.length > 0 ? healthy : orderedEndpoints
    let lastError: Error | null = null

    for (const endpoint of tryOrder) {
      for (let attempt = 0; attempt <= endpoint.maxRetries; attempt++) {
        try {
          return await endpoint.call(method, params, id)
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          this.onError?.(lastError, endpoint.url)

          if (attempt < endpoint.maxRetries) {
            await this.delay(this.retryDelayMs * (attempt + 1))
          }
        }
      }
    }

    this.totalErrors++
    throw lastError ?? new Error('All endpoints failed')
  }

  async getChainId(): Promise<number> {
    const result = await this.request('eth_chainId')
    if (!result) throw new Error('eth_chainId returned empty result')
    return Number(BigInt(result as string))
  }

  async getBlockNumber(): Promise<bigint> {
    const result = await this.request('eth_blockNumber')
    if (!result) throw new Error('eth_blockNumber returned empty result')
    return BigInt(result as string)
  }

  async getBalance(address: string): Promise<bigint> {
    const result = await this.request('eth_getBalance', [address, 'latest'])
    if (!result) throw new Error('eth_getBalance returned empty result')
    return BigInt(result as string)
  }

  async call(to: string, data: string): Promise<Hex> {
    const result = await this.request('eth_call', [{ to, data }, 'latest'])
    return (result as Hex) ?? '0x'
  }

  async getCode(address: string): Promise<Hex> {
    const result = await this.request('eth_getCode', [address, 'latest'])
    return (result as Hex) ?? '0x'
  }

  async estimateGas(tx: Record<string, string>): Promise<bigint> {
    const result = await this.request('eth_estimateGas', [tx])
    if (!result) throw new Error('eth_estimateGas returned empty result')
    return BigInt(result as string)
  }

  async sendRawTransaction(signedTx: string): Promise<string> {
    const result = await this.request('eth_sendRawTransaction', [signedTx])
    return result as string
  }

  async checkHealth(): Promise<EndpointHealthResult[]> {
    const results = await Promise.all(
      this.endpoints.map(async e => ({
        url: e.url,
        healthy: await e.healthCheck(),
        latencyMs: e.latencyMs,
      }))
    )
    return results
  }

  getStats(): ProviderStats {
    const activeIdx = this.strategy === 'round-robin'
      ? this.currentIndex % this.endpoints.length
      : 0
    return {
      endpoints: this.endpoints.map(e => e.getStats()),
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      activeEndpoint: this.endpoints[activeIdx]?.url ?? '',
      strategy: this.strategy,
    }
  }

  getHealthyEndpoints(): Endpoint[] {
    return this.endpoints.filter(e => e.healthy)
  }

  getEndpointCount(): number {
    return this.endpoints.length
  }

  addEndpoint(url: string): void {
    this.endpoints.push(new Endpoint(url))
  }

  removeEndpoint(url: string): void {
    this.endpoints = this.endpoints.filter(e => e.url !== url)
  }

  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }

  private getEndpointOrder(): Endpoint[] {
    switch (this.strategy) {
      case 'failover':
        return [...this.endpoints]

      case 'round-robin': {
        const hasWeights = this.endpoints.some(e => e.weight > 1)
        if (hasWeights) {
          const weighted: Endpoint[] = []
          for (const ep of this.endpoints) {
            for (let w = 0; w < ep.weight; w++) weighted.push(ep)
          }
          const idx = this.currentIndex % weighted.length
          this.currentIndex++
          const primary = weighted[idx]!
          const rest = this.endpoints.filter(e => e !== primary)
          return [primary, ...rest]
        }
        const ordered = []
        for (let i = 0; i < this.endpoints.length; i++) {
          ordered.push(this.endpoints[(this.currentIndex + i) % this.endpoints.length]!)
        }
        this.currentIndex = (this.currentIndex + 1) % this.endpoints.length
        return ordered
      }

      case 'fastest':
        return [...this.endpoints].sort((a, b) => {
          if (!a.healthy && b.healthy) return 1
          if (a.healthy && !b.healthy) return -1
          return (a.getStats().latencyMs || Infinity) - (b.getStats().latencyMs || Infinity)
        })

      case 'random': {
        const shuffled = [...this.endpoints]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
        }
        return shuffled
      }

      default:
        return [...this.endpoints]
    }
  }

  private startHealthCheck(intervalMs: number): void {
    this.healthCheckTimer = setInterval(() => {
      this.checkHealth().catch(() => {})
    }, intervalMs)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

interface EndpointHealthResult {
  url: string
  healthy: boolean
  latencyMs: number
}
