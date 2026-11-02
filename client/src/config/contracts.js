/**
 * contracts.js
 * Maps each chainId to the deployed contract addresses.
 * Update the addresses for each network after deployment.
 *
 * Exp 1 : LandRegistry, PropertyDispute
 * Exp 3 : MockUSDC, PropertyToken, PropertyVault
 * Exp 4 : LiquidityPool
 * Exp 5 : DCEToken, StakingRewards
 * Exp 6 : DEXRouter                    ← NEW
 * Exp 7 : PriceFeedConsumer             ← Chainlink ETH/USD
 */

const CONTRACTS_BY_CHAIN = {
  // ── Hardhat local (chainId 31337) ─────────────────────────────────────────
  31337: {
    name: "Hardhat Local",
    // Exp 1
    landRegistry: "0x0000000000000000000000000000000000000000",
    propertyDispute: "0x0000000000000000000000000000000000000000",
    // Exp 3
    mockUSDC: "0x0000000000000000000000000000000000000000",
    propertyToken: "0x0000000000000000000000000000000000000000",
    propertyVault: "0x0000000000000000000000000000000000000000",
    // Exp 4
    liquidityPool: "0x0000000000000000000000000000000000000000",
    // Exp 5
    dceToken: "0x0000000000000000000000000000000000000000",
    stakingRewards: "0x0000000000000000000000000000000000000000",
    // Exp 6
    dexRouter: "0x0000000000000000000000000000000000000000",
    // Exp 7 — set after deploying PriceFeedConsumer in Remix
    priceFeedConsumer: "0x0000000000000000000000000000000000000000",
    poolPriceOracle: "0x0000000000000000000000000000000000000000",
    governanceDAO: "0x0000000000000000000000000000000000000000",
    propertyTokenFactory: "0x0000000000000000000000000000000000000000",
    propertyTokens: {},
    vulnerablePool: "0x0000000000000000000000000000000000000000",
    securePool: "0x0000000000000000000000000000000000000000",
    flashLoanAttacker: "0x0000000000000000000000000000000000000000",
  },

  // ── Ganache local (chainId 1337) ──────────────────────────────────────────
  1337: {
    name: "Ganache Local",
    // Exp 1
    landRegistry: "0x1a34839636dF0434CEeD7205982c7BC5BF669613",
    propertyDispute: "0xEc0221773836852DBe1E75B2E276483f802ab50A",
    // Exp 3 — deployed on Sepolia
    mockUSDC: "0x0000000000000000000000000000000000000000",
    propertyToken: "0x0000000000000000000000000000000000000000",
    propertyVault: "0x0000000000000000000000000000000000000000",
    // Exp 4
    liquidityPool: "0x0000000000000000000000000000000000000000",
    // Exp 5
    dceToken: "0x0000000000000000000000000000000000000000",
    stakingRewards: "0x0000000000000000000000000000000000000000",
    // Exp 6
    dexRouter: "0x0000000000000000000000000000000000000000",
    // Exp 7 — set after deploying PriceFeedConsumer in Remix
    priceFeedConsumer: "0x0000000000000000000000000000000000000000",
    poolPriceOracle: "0x0000000000000000000000000000000000000000",
    governanceDAO: "0x0000000000000000000000000000000000000000",
    propertyTokenFactory: "0x0000000000000000000000000000000000000000",
    propertyTokens: {},
    vulnerablePool: "0x0000000000000000000000000000000000000000",
    securePool: "0x0000000000000000000000000000000000000000",
    flashLoanAttacker: "0x0000000000000000000000000000000000000000",
  },

  // ── Ganache legacy (chainId 5777) ─────────────────────────────────────────
  5777: {
    name: "Ganache Legacy",
    // Exp 1
    landRegistry: "0x1a34839636dF0434CEeD7205982c7BC5BF669613",
    propertyDispute: "0xEc0221773836852DBe1E75B2E276483f802ab50A",
    // Exp 3
    mockUSDC: "0x0000000000000000000000000000000000000000",
    propertyToken: "0x0000000000000000000000000000000000000000",
    propertyVault: "0x0000000000000000000000000000000000000000",
    // Exp 4
    liquidityPool: "0x0000000000000000000000000000000000000000",
    // Exp 5
    dceToken: "0x0000000000000000000000000000000000000000",
    stakingRewards: "0x0000000000000000000000000000000000000000",
    // Exp 6
    dexRouter: "0x0000000000000000000000000000000000000000",
    // Exp 7 — set after deploying PriceFeedConsumer in Remix
    priceFeedConsumer: "0x0000000000000000000000000000000000000000",
    poolPriceOracle: "0x0000000000000000000000000000000000000000",
    governanceDAO: "0x0000000000000000000000000000000000000000",
    propertyTokenFactory: "0x0000000000000000000000000000000000000000",
    propertyTokens: {},
    vulnerablePool: "0x0000000000000000000000000000000000000000",
    securePool: "0x0000000000000000000000000000000000000000",
    flashLoanAttacker: "0x0000000000000000000000000000000000000000",
  },

  // ── Polygon Amoy testnet (chainId 80002) ──────────────────────────────────
  80002: {
    name: "Polygon Amoy",
    // Exp 1
    landRegistry: "0x0000000000000000000000000000000000000000",
    propertyDispute: "0x0000000000000000000000000000000000000000",
    // Exp 3
    mockUSDC: "0x0000000000000000000000000000000000000000",
    propertyToken: "0x0000000000000000000000000000000000000000",
    propertyVault: "0x0000000000000000000000000000000000000000",
    // Exp 4
    liquidityPool: "0x0000000000000000000000000000000000000000",
    // Exp 5
    dceToken: "0x0000000000000000000000000000000000000000",
    stakingRewards: "0x0000000000000000000000000000000000000000",
    // Exp 6
    dexRouter: "0x0000000000000000000000000000000000000000",
    // Exp 7 — set after deploying PriceFeedConsumer in Remix
    priceFeedConsumer: "0x0000000000000000000000000000000000000000",
    poolPriceOracle: "0x0000000000000000000000000000000000000000",
    governanceDAO: "0x0000000000000000000000000000000000000000",
    propertyTokenFactory: "0x0000000000000000000000000000000000000000",
    propertyTokens: {},
    vulnerablePool: "0x0000000000000000000000000000000000000000",
    securePool: "0x0000000000000000000000000000000000000000",
    flashLoanAttacker: "0x0000000000000000000000000000000000000000",
  },

  // ── Sepolia testnet (chainId 11155111) ────────────────────────────────────
  11155111: {
    name: "Sepolia Testnet",
    // Exp 1
    landRegistry: "0xF14e89a59D995e51Ad967c2e006Af5C65D90DcC2",
    //propertyDispute: "0x4a2f108705a6a9674d2C53Bac2Cb88aceab15A18",
    propertyDispute: "0x751CD78eB224810271C218793D561101aB7B6Bd7",
    // Exp 3
    mockUSDC: "0x5282a9DBd046B4d03DBa74f58C85E12a331F3A2f",
    propertyToken: "0xaF81486e637dFb386E9Fc0Fb6Dd23bb6F99BABcB",
    propertyVault: "0x3caAfFa8973820AEe86306AAe0857EC9dBFAC3F4",
    // Exp 4
    liquidityPool: "0x2d52835e6334E9af8DcAd56B3A8722bD46C27d8C",
    liquidityPoolDCE: "0x74aC68b09A9A35a29f3B6472BC2B5DB3ab20788e", // fill after deploying DCE/mUSDC pool
    // Exp 5 — Staking & Rewards
    dceToken: "0xf385FA8cFEd7b0A82B95a8E28108226359a58380",
    stakingRewards: "0x3DaFc468671c9aD825242a46351a0A564ae5cc46",
    // Exp 6 — DEX Router (redeploy with both pools, then update address)
    dexRouter: "0x2175b721215dcc9d91Fae30F9C9D921b8171c585",
    // Exp 7 — Chainlink ETH/USD consumer deployed from Remix
    priceFeedConsumer: "0x0aA8757E71998800A95e8209eb8A9d642A7D04DC",
    // PROP/mUSDC pool reference TWAP oracle — set after Remix deployment
    poolPriceOracle: "0xC9596e23e74eab5C8415c0f287d035E652db714d",
    governanceDAO: "0xc6983D96B8737f92fC942F230521564230c0a2EA",
    propertyTokenFactory: "0x7659141C20aE2477a1fE956714FFF37b85554E47",
    propertyTokens: { 1: "0xaF81486e637dFb386E9Fc0Fb6Dd23bb6F99BABcB" },
    // Exp 9 — configure after deploying the security lab contracts in Remix
    vulnerablePool: "0x552ebb7B27Dd82435834D3AD22A99afa8F55169A",
    securePool: "0xb7990C55998B8e9DA6a9a342568aA0D50159C025",
    flashLoanAttacker: "0xd3111bC4c913E5093b8EA7bB379cd5f93ff043fc",
  },
};

/** Returns the full contract address map for a given chainId, or null. */
export function getContractsForChain(chainId) {
  if (!chainId) return null;
  const parsedId =
    typeof chainId === "string" && chainId.startsWith("0x")
      ? parseInt(chainId, 16)
      : Number(chainId);
  return CONTRACTS_BY_CHAIN[parsedId] || null;
}

/**
 * Returns true only if address is a valid non-zero 42-char hex string.
 * Use this to guard contract calls when an address hasn't been configured yet.
 */
export function hasValidAddress(address) {
  return (
    typeof address === "string" &&
    address.length === 42 &&
    address !== "0x0000000000000000000000000000000000000000"
  );
}

export default CONTRACTS_BY_CHAIN;
