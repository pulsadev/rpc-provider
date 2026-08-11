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

## License

MIT © [Yuto Nakamura](https://github.com/yutonakamura-dev)
