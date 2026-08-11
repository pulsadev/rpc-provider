# Changelog

## [0.1.0] - 2026-08-12

### Added

- Multi-endpoint RPC provider with automatic failover
- Load balancing strategies: failover, round-robin, fastest-first, random
- Periodic health checks with auto-disable of unhealthy endpoints
- EWMA-based latency tracking per endpoint
- Per-endpoint retry with configurable backoff
- Request/error stats tracking
- Dynamic endpoint add/remove
- Convenience methods: getChainId, getBlockNumber, getBalance, call, getCode, estimateGas, sendRawTransaction
- Built-in public RPC registry for 10 chains (3-4 RPCs each)
- Factory functions: createChainProvider, createFailoverProvider, createLoadBalancedProvider, createFastestProvider
- onError and onFallback callbacks
- ESM + CJS dual format with full TypeScript declarations
- 33 tests passing (unit + Ethereum mainnet integration + failover verification)
- Zero runtime dependencies (~9 KB bundled)
