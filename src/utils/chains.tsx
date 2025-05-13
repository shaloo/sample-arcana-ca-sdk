
import { mainnet, arbitrum, optimism, base, scroll, polygon, linea } from 'viem/chains';
import { Chain } from 'viem';

// Define supported chains as a readonly tuple
export const supportedChains = [
  mainnet,
  arbitrum,
  optimism,
  base,
  scroll,
  polygon,
  linea,
] as const; // 'as const' makes it a readonly tuple

// Supported chains with chain IDs
export const supportedChainsId = [
  { name: "Ethereum", chainId: 1 },
  { name: "Optimism", chainId: 10 },
  { name: "Arbitrum", chainId: 42161 },
  { name: "Avalanche", chainId: 43114 },
  { name: "Polygon", chainId: 137 },
  { name: "Scroll", chainId: 534352 },
  { name: "Linea", chainId: 59144 },
  { name: "Base", chainId: 8453 },
];
  
// Supported assets
export const supportedAssets = ["ETH", "USDC", "USDT"];
      
// Token contract addresses (mainnet; adjust for testnets if needed)
export const listTokenContracts: { [chainId: number]: { [asset: string]: string } } = {
    1: { // Ethereum
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    },
    10: { // Optimism
    USDC: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    },
    42161: { // Arbitrum
    USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    },
    43114: { // Avalanche
      USDC: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
      USDT: "0xde3a24028580884448a5397872046a019649b084",
    },
    137: { // Polygon
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    },
    534352: { // Scroll
    USDC: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4",
    USDT: "0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df",
    },
    59144: { // Linea
    USDC: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
    USDT: "0xA219439258ca9da29E9Cc4cE5596924745e12B93",
    },
    8453: { // Base
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    },
};