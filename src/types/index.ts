export type Hex = `0x${string}`

export type Strategy = 'failover' | 'round-robin' | 'fastest' | 'random'

export interface RpcEndpoint {
  url: string
  weight?: number
  maxRetries?: number
  timeoutMs?: number
}

export interface ProviderOptions {
  endpoints: (string | RpcEndpoint)[]
  strategy?: Strategy
  maxRetries?: number
  retryDelayMs?: number
  timeoutMs?: number
  healthCheckIntervalMs?: number
  onError?: (error: Error, url: string) => void
  onFallback?: (from: string, to: string) => void
}

export interface RpcRequest {
  method: string
  params: unknown[]
  id?: number
}

export interface RpcResponse {
  jsonrpc: string
  id: number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export interface EndpointStats {
  url: string
  healthy: boolean
  latencyMs: number
  successCount: number
  errorCount: number
  lastError: string | null
  lastChecked: number
}

export interface ProviderStats {
  endpoints: EndpointStats[]
  totalRequests: number
  totalErrors: number
  activeEndpoint: string
  strategy: Strategy
}
