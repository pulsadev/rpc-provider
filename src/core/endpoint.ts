import type { RpcEndpoint, EndpointStats, RpcResponse } from '../types/index.js'

const DEFAULT_TIMEOUT = 10000
const DEFAULT_MAX_RETRIES = 2

export class Endpoint {
  readonly url: string
  readonly weight: number
  readonly maxRetries: number
  readonly timeoutMs: number

  healthy = true
  latencyMs = 0
  successCount = 0
  errorCount = 0
  lastError: string | null = null
  lastChecked = 0

  private ewmaLatency = 0
  private readonly ewmaAlpha = 0.3

  constructor(config: string | RpcEndpoint) {
    if (typeof config === 'string') {
      this.url = config
      this.weight = 1
      this.maxRetries = DEFAULT_MAX_RETRIES
      this.timeoutMs = DEFAULT_TIMEOUT
    } else {
      this.url = config.url
      this.weight = config.weight ?? 1
      this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
      this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT
    }
  }

  async call(method: string, params: unknown[], id: number): Promise<RpcResponse> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    const start = performance.now()
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal,
      })

      const json = (await response.json()) as RpcResponse
      const elapsed = performance.now() - start

      if (json.error) {
        this.recordError(json.error.message, elapsed)
      } else {
        this.recordSuccess(elapsed)
      }
      return json
    } catch (error) {
      const elapsed = performance.now() - start
      const msg = error instanceof Error ? error.message : String(error)
      this.recordError(msg, elapsed)
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.call('eth_chainId', [], 0)
      this.lastChecked = Date.now()
      this.healthy = !!response.result
      return this.healthy
    } catch {
      this.lastChecked = Date.now()
      this.healthy = false
      return false
    }
  }

  getStats(): EndpointStats {
    return {
      url: this.url,
      healthy: this.healthy,
      latencyMs: Math.round(this.ewmaLatency),
      successCount: this.successCount,
      errorCount: this.errorCount,
      lastError: this.lastError,
      lastChecked: this.lastChecked,
    }
  }

  private recordSuccess(latencyMs: number): void {
    this.successCount++
    this.healthy = true
    this.latencyMs = latencyMs
    this.ewmaLatency = this.ewmaLatency === 0
      ? latencyMs
      : this.ewmaLatency * (1 - this.ewmaAlpha) + latencyMs * this.ewmaAlpha
  }

  private recordError(message: string, _latencyMs: number): void {
    this.errorCount++
    this.lastError = message
    if (this.errorCount > 3 && this.successCount === 0) {
      this.healthy = false
    }
    if (this.errorCount / (this.successCount + this.errorCount) > 0.5 && this.errorCount > 5) {
      this.healthy = false
    }
  }
}
