# @pulsadev/rpc-provider

Multi-RPC provider with load balancing, failover, health checks, and latency tracking. Zero dependencies.

Never depend on a single RPC endpoint again. Automatic failover, round-robin, or fastest-first routing across multiple providers.

## Features

- **Failover** — automatic fallback when an endpoint goes down
- **Load balancing** — round-robin, fastest-first, random, or weighted strategies
- **Health checks** — periodic endpoint monitoring with auto-disable
- **Latency tracking** — EWMA-based latency measurement per endpoint
- **Stats** — request counts, error rates, and per-endpoint metrics
- **Built-in chain RPCs** — 10 chains with 3-4 free public RPCs each
- **Retry with backoff** — configurable retry per endpoint
- **Dynamic endpoints** — add/remove endpoints at runtime
- **Convenience methods** — getChainId, getBlockNumber, getBalance, call, estimateGas, sendRawTransaction
- **Callbacks** — onError and onFallback hooks
- **Zero dependencies** — ~9 KB bundled, ESM + CJS, pure TypeScript

## Install

```bash
npm install @pulsadev/rpc-provider
```

## Quick Start

### Basic failover

```typescript
import { RpcProvider } from '@pulsadev/rpc-provider'

const provider = new RpcProvider({
  endpoints: [
    'https://ethereum-rpc.publicnode.com',
    'https://eth.drpc.org',
    'https://1rpc.io/eth',
  ],
  strategy: 'failover',
})

const chainId = await provider.getChainId() // 1
const block = await provider.getBlockNumber()
```

### One-line chain provider

```typescript
import { createChainProvider } from '@pulsadev/rpc-provider'

const eth = createChainProvider(1)   // Ethereum with 4 public RPCs
const bsc = createChainProvider(56)  // BSC with 4 public RPCs
const arb = createChainProvider(42161) // Arbitrum

const block = await eth.getBlockNumber()
```

### Load balancing strategies

```typescript
import { createLoadBalancedProvider, createFastestProvider } from '@pulsadev/rpc-provider'

// Round-robin across endpoints
const balanced = createLoadBalancedProvider(['https://rpc1.com', 'https://rpc2.com'])

// Always use the fastest responding endpoint
const fastest = createFastestProvider(['https://rpc1.com', 'https://rpc2.com'])
```

### Health checks

```typescript
const provider = new RpcProvider({
  endpoints: ['https://rpc1.com', 'https://rpc2.com'],
  healthCheckIntervalMs: 30000, // check every 30s
})

// Manual health check
const results = await provider.checkHealth()
results.forEach(r => console.log(`${r.url}: ${r.healthy ? 'UP' : 'DOWN'} (${r.latencyMs}ms)`))
```

### Failover callbacks

```typescript
const provider = new RpcProvider({
  endpoints: ['https://primary.com', 'https://backup.com'],
  onError: (err, url) => console.log(`Error from ${url}: ${err.message}`),
  onFallback: (from, to) => console.log(`Switched from ${from} to ${to}`),
})
```

### Stats

```typescript
const stats = provider.getStats()
console.log(`Total requests: ${stats.totalRequests}`)
console.log(`Active: ${stats.activeEndpoint}`)
stats.endpoints.forEach(e => {
  console.log(`  ${e.url}: ${e.healthy ? 'UP' : 'DOWN'} ${e.latencyMs}ms (${e.successCount}/${e.errorCount})`)
})
```

## API

### `new RpcProvider(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoints` | `(string \| RpcEndpoint)[]` | required | RPC endpoint URLs |
| `strategy` | `'failover' \| 'round-robin' \| 'fastest' \| 'random'` | `'failover'` | Routing strategy |
| `retryDelayMs` | `number` | `500` | Delay between retries |
| `healthCheckIntervalMs` | `number` | — | Auto health check interval |
| `onError` | `(error, url) => void` | — | Error callback |
| `onFallback` | `(from, to) => void` | — | Fallback callback |

### Methods

| Method | Description |
|--------|-------------|
| `request(method, params)` | Raw JSON-RPC request |
| `send(method, params)` | Raw request returning full RpcResponse |
| `getChainId()` | Get chain ID |
| `getBlockNumber()` | Get latest block number |
| `getBalance(address)` | Get ETH balance |
| `call(to, data)` | eth_call |
| `getCode(address)` | Get contract bytecode |
| `estimateGas(tx)` | Estimate gas |
| `sendRawTransaction(signedTx)` | Send signed transaction |
| `checkHealth()` | Run health check on all endpoints |
| `getStats()` | Get provider statistics |
| `addEndpoint(url)` | Add endpoint at runtime |
| `removeEndpoint(url)` | Remove endpoint at runtime |
| `destroy()` | Stop health checks and clean up |

### Supported Chains (built-in RPCs)

Ethereum (1), BSC (56), Polygon (137), Arbitrum (42161), Optimism (10), Base (8453), Avalanche (43114), zkSync Era (324), Fantom (250), Gnosis (100)

## Real-World Examples

### Production multi-RPC setup

Configure multiple endpoints with weighted round-robin distribution and periodic health checks. Assign higher weights to premium or faster endpoints so they receive more traffic.

```typescript
import { RpcProvider } from '@pulsadev/rpc-provider'

const provider = new RpcProvider({
  endpoints: [
    { url: 'https://ethereum-rpc.publicnode.com', weight: 3, maxRetries: 2 },
    { url: 'https://eth.meowrpc.com', weight: 2, maxRetries: 2 },
    { url: 'https://eth.drpc.org', weight: 1, maxRetries: 1 },
  ],
  strategy: 'round-robin',
  healthCheckIntervalMs: 30_000, // check every 30s
  retryDelayMs: 300,
  onError: (err, url) => {
    console.error(`[rpc] ${url} error: ${err.message}`)
  },
})

// Requests are distributed proportionally: publicnode ~50%, meowrpc ~33%, drpc ~17%
const block = await provider.getBlockNumber()
console.log(`Latest block: ${block}`)

// Clean up when shutting down
process.on('SIGTERM', () => provider.destroy())
```

### Automatic failover

Set up a primary endpoint with automatic fallback. When the primary goes down, the provider seamlessly routes to the next healthy endpoint and notifies you via callbacks.

```typescript
import { RpcProvider } from '@pulsadev/rpc-provider'

const provider = new RpcProvider({
  endpoints: [
    { url: 'https://ethereum-rpc.publicnode.com', maxRetries: 3 },
    { url: 'https://eth.meowrpc.com', maxRetries: 2 },
    { url: 'https://1rpc.io/eth', maxRetries: 1 },
  ],
  strategy: 'failover',
  retryDelayMs: 500,
  healthCheckIntervalMs: 15_000,
  onFallback: (from, to) => {
    console.warn(`[rpc] Failover: ${from} -> ${to}`)
    // Alert your monitoring system
  },
  onError: (err, url) => {
    console.error(`[rpc] ${url} failed: ${err.message}`)
  },
})

// This call tries publicnode first. If it fails after 3 retries,
// it falls back to meowrpc, then 1rpc. Your code never sees the failover.
const balance = await provider.getBalance('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')
console.log(`Balance: ${balance} wei`)
```

### Monitor endpoint health

Run periodic health checks and build a dashboard of endpoint latency and error rates.

```typescript
import { RpcProvider } from '@pulsadev/rpc-provider'

const provider = new RpcProvider({
  endpoints: [
    'https://ethereum-rpc.publicnode.com',
    'https://eth.meowrpc.com',
    'https://eth.drpc.org',
    'https://1rpc.io/eth',
  ],
  strategy: 'fastest',
})

// Run a health check across all endpoints
const health = await provider.checkHealth()
for (const endpoint of health) {
  console.log(`${endpoint.url}: ${endpoint.healthy ? 'UP' : 'DOWN'} (${endpoint.latencyMs}ms)`)
}

// After some requests, inspect per-endpoint stats
const stats = provider.getStats()
console.log(`Strategy: ${stats.strategy}`)
console.log(`Total requests: ${stats.totalRequests}, errors: ${stats.totalErrors}`)
console.log(`Active endpoint: ${stats.activeEndpoint}`)

for (const ep of stats.endpoints) {
  const errorRate = ep.successCount + ep.errorCount > 0
    ? ((ep.errorCount / (ep.successCount + ep.errorCount)) * 100).toFixed(1)
    : '0.0'
  console.log(
    `  ${ep.url} | ${ep.healthy ? 'healthy' : 'unhealthy'} | ` +
    `latency: ${ep.latencyMs}ms | errors: ${errorRate}% | ` +
    `last error: ${ep.lastError ?? 'none'}`
  )
}
```

### Use with other @pulsadev packages

The provider's `request()` method returns raw JSON-RPC results, making it easy to combine with other `@pulsadev` packages. Use the provider as your RPC layer while other packages handle specific concerns.

```typescript
import { RpcProvider, createChainProvider } from '@pulsadev/rpc-provider'

// Create a resilient provider for Ethereum
const provider = createChainProvider(1, {
  strategy: 'fastest',
  healthCheckIntervalMs: 30_000,
})

// Use the provider for raw JSON-RPC calls that other packages need
const gasPrice = await provider.request('eth_gasPrice')
console.log(`Gas price: ${BigInt(gasPrice as string)} wei`)

// Combine with @pulsadev/multicall — pass the same RPC URLs
// Both packages share the same reliable endpoint pool
import { Multicall } from '@pulsadev/multicall'

const multicall = new Multicall({
  rpcUrl: 'https://ethereum-rpc.publicnode.com',
  chainId: 1,
})

// Use rpc-provider for single calls, multicall for batched reads
const block = await provider.getBlockNumber()
const results = await multicall.call([
  { target: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', callData: '0x18160ddd' }, // USDC totalSupply
  { target: '0xdAC17F958D2ee523a2206206994597C13D831ec7', callData: '0x18160ddd' }, // USDT totalSupply
])

// Use rpc-provider for gas estimation alongside @pulsadev/gas-oracle
import { GasOracle } from '@pulsadev/gas-oracle'

const oracle = new GasOracle({
  rpcUrl: 'https://ethereum-rpc.publicnode.com',
  chainId: 1,
})

const fees = await oracle.getGasFees()
const estimate = await provider.estimateGas({
  from: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  data: '0x70a08231000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045',
})
console.log(`Estimated gas: ${estimate}, suggested fee: ${fees.medium.maxFeePerGas} wei`)
```

## License

MIT © [Yuto Nakamura](https://github.com/yutonakamura-dev)
