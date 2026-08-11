export interface ChainConfig {
  chainId: number
  name: string
  rpcs: string[]
}

export const CHAINS: Record<number, ChainConfig> = {
  1: {
    chainId: 1,
    name: 'Ethereum',
    rpcs: [
      'https://ethereum-rpc.publicnode.com',
      'https://eth.meowrpc.com',
      'https://eth.drpc.org',
      'https://1rpc.io/eth',
    ],
  },
  56: {
    chainId: 56,
    name: 'BSC',
    rpcs: [
      'https://bsc-dataseed.binance.org',
      'https://bsc-rpc.publicnode.com',
      'https://bsc-mainnet.public.blastapi.io',
      'https://bsc.drpc.org',
    ],
  },
  137: {
    chainId: 137,
    name: 'Polygon',
    rpcs: [
      'https://polygon-bor-rpc.publicnode.com',
      'https://polygon-mainnet.public.blastapi.io',
      'https://polygon.drpc.org',
      'https://1rpc.io/matic',
    ],
  },
  42161: {
    chainId: 42161,
    name: 'Arbitrum',
    rpcs: [
      'https://arbitrum-one-rpc.publicnode.com',
      'https://arbitrum-one.public.blastapi.io',
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum.drpc.org',
    ],
  },
  10: {
    chainId: 10,
    name: 'Optimism',
    rpcs: [
      'https://optimism-rpc.publicnode.com',
      'https://optimism-mainnet.public.blastapi.io',
      'https://mainnet.optimism.io',
      'https://optimism.drpc.org',
    ],
  },
  8453: {
    chainId: 8453,
    name: 'Base',
    rpcs: [
      'https://base-rpc.publicnode.com',
      'https://base-mainnet.public.blastapi.io',
      'https://mainnet.base.org',
      'https://base.drpc.org',
    ],
  },
  43114: {
    chainId: 43114,
    name: 'Avalanche',
    rpcs: [
      'https://avalanche-c-chain-rpc.publicnode.com',
      'https://avalanche-mainnet.public.blastapi.io',
      'https://api.avax.network/ext/bc/C/rpc',
      'https://avalanche.drpc.org',
    ],
  },
  324: {
    chainId: 324,
    name: 'zkSync Era',
    rpcs: [
      'https://mainnet.era.zksync.io',
      'https://zksync.drpc.org',
    ],
  },
  250: {
    chainId: 250,
    name: 'Fantom',
    rpcs: [
      'https://rpcapi.fantom.network',
      'https://fantom-mainnet.public.blastapi.io',
      'https://fantom.drpc.org',
    ],
  },
  100: {
    chainId: 100,
    name: 'Gnosis',
    rpcs: [
      'https://rpc.gnosischain.com',
      'https://gnosis-rpc.publicnode.com',
      'https://gnosis-mainnet.public.blastapi.io',
    ],
  },
}

export function getChainRpcs(chainId: number): string[] {
  return CHAINS[chainId]?.rpcs ?? []
}

export function getChainName(chainId: number): string | null {
  return CHAINS[chainId]?.name ?? null
}

export function getSupportedChainIds(): number[] {
  return Object.keys(CHAINS).map(Number)
}
