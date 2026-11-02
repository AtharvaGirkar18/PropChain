# 🏠 Land Registry DApp — Blockchain-Powered Property Ecosystem

A full-stack decentralised application (DApp) on Ethereum that reimagines India's property ownership system. What started as a simple land registry has grown into a complete DeFi ecosystem around real-world assets — featuring tokenised properties, an AMM liquidity pool, a multi-pool DEX, LP staking rewards, Chainlink price feeds, an on-chain governance DAO, and a smart-contract security lab.

**Live on Sepolia Testnet · React 18 frontend · ethers.js v6**

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Solution](#-solution)
- [Tech Stack](#-tech-stack)
- [Smart Contracts](#-smart-contracts)
- [Frontend Pages](#-frontend-pages)
- [Project Structure](#-project-structure)
- [Installation & Setup](#-installation--setup)
- [Contract Addresses — Sepolia](#-contract-addresses--sepolia)
- [Usage Guide](#-usage-guide)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Resources](#-resources)

---

## ❗ Problem Statement

India's land registry system suffers from:

| Issue | Impact |
|---|---|
| 🚫 Forged property deeds | Fraudulent ownership claims |
| ⚖️ Opaque dispute resolution | Prolonged legal battles |
| 🔓 Centralised records | Vulnerable to tampering & corruption |
| 🔗 Broken chain of title | Hard to verify complete ownership history |
| 💸 Illiquid real estate | Capital locked in physical assets |

---

## ✅ Solution

A blockchain-based property ecosystem that provides:

- **Immutable Records** — every registration & transfer permanently on-chain
- **Transparent Disputes** — anyone can raise, track, and verify dispute resolution
- **Tokenised Properties** — ERC-20 property tokens unlock DeFi liquidity for real assets
- **AMM Trading & Liquidity** — permissionless constant-product pools for PROP/mUSDC and DCE/mUSDC
- **LP Staking Rewards** — earn DCE tokens by providing liquidity
- **Multi-Pool DEX Router** — optimal swap routing across pools
- **Chainlink Price Feeds** — live ETH/USD oracle + on-chain TWAP
- **Decentralised Governance** — DCE holders vote on protocol changes via DAO
- **Security Education** — built-in flash-loan vulnerability lab

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity ^0.8.0 |
| Blockchain | Ethereum (Sepolia Testnet + Ganache local) |
| Dev Frameworks | Truffle Suite, Hardhat |
| Testing | Mocha + Chai (via Truffle) |
| Frontend | React 18 |
| Web3 Library | ethers.js v6 |
| Wallet | MetaMask |
| Price Feeds | Chainlink AggregatorV3Interface |
| Token Standard | ERC-20 (MockUSDC, DCEToken, PropertyToken) |
| Deployment IDE | Remix IDE (for Sepolia) |

---

## 📜 Smart Contracts

### Exp 1 — Core Land Registry

| Contract | Purpose |
|---|---|
| `LandRegistry.sol` | Register properties, transfer ownership, manage disputes, full chain-of-title |
| `PropertyDispute.sol` | Raise & resolve disputes; auto-locks transfers on disputed properties |

**LandRegistry highlights:**
- Register property with owner address, location, area, price, document hash (IPFS CID)
- Ownership transfer blocked when a dispute is active
- Admin-controlled dispute flagging
- Complete history of all previous owners stored on-chain

**PropertyDispute highlights:**
- Anyone can raise a dispute with an on-chain reason
- Admin resolves with a permanently stored resolution note
- Syncs disputed status back to `LandRegistry`

---

### Exp 3 — Tokenised Properties & Vault

| Contract | Purpose |
|---|---|
| `MockUSDC.sol` | ERC-20 test stablecoin (mUSDC) |
| `PropertyToken.sol` | ERC-20 representing fractional property ownership (PROP) |
| `PropertyVault.sol` | Deposit PROP as collateral, borrow mUSDC against it |

---

### Exp 4 — AMM Liquidity Pool

| Contract | Purpose |
|---|---|
| `LiquidityPool.sol` | Constant-product AMM (x·y=k) for any ERC-20 pair |

**Highlights:**
- Add & remove liquidity — LP tokens issued proportionally
- Token swaps with 0.3% fee distributed to liquidity providers
- Real-time price discovery from pool reserves

---

### Exp 5 — DCE Token & Staking Rewards

| Contract | Purpose |
|---|---|
| `DCEToken.sol` | ERC-20 governance & rewards token |
| `StakingRewards.sol` | Stake LP tokens to earn DCE; rewards are pro-rata and time-weighted |

---

### Exp 6 — Multi-Pool DEX Router

| Contract | Purpose |
|---|---|
| `DEXRouter.sol` | Routes swaps through multiple AMM pools; supports direct and multi-hop paths (PROP → mUSDC → DCE) |

---

### Exp 7 — Chainlink Price Feeds & TWAP Oracle

| Contract | Purpose |
|---|---|
| `PriceFeedConsumer.sol` | Reads live ETH/USD price from Chainlink AggregatorV3 on Sepolia |
| `PoolPriceOracle.sol` | TWAP oracle built from on-chain AMM reserve snapshots |

---

### Exp 8 — On-Chain Governance DAO

| Contract | Purpose |
|---|---|
| `GovernanceDAO.sol` | DCE-weighted governance: create proposals, vote for/against, execute passed proposals |
| `PropertyTokenFactory.sol` | Factory for deploying new ERC-20 property tokens, governable via DAO |

**DAO mechanics:**
- Configurable voting period and quorum (basis-points of total DCE supply)
- Passed proposals execute arbitrary `callData` on any target contract
- `hasVoted[proposalId][voter]` prevents double-voting per address

---

### Exp 9 — Smart Contract Security Lab

| Contract | Purpose |
|---|---|
| `VulnerablePool.sol` | Intentionally exploitable pool (re-entrancy, flash-loan price manipulation) |
| `SecurePool.sol` | Hardened version: CEI pattern, re-entrancy guard, TWAP validation |
| `FlashLoanAttacker.sol` | Demonstrates the exploit live against `VulnerablePool` |
| `GasOptimizationShowcase.sol` | Side-by-side gas-inefficient vs optimised Solidity patterns |

---

## 🖥️ Frontend Pages

| Route | Page | What you can do |
|---|---|---|
| `/` | **Property Detail** | Search any property by ID; view metadata, ownership history, dispute status |
| `/marketplace` | **Marketplace** | Browse all properties, register new ones, transfer ownership |
| `/vault` | **Vault Dashboard** | Deposit PROP collateral, borrow mUSDC, repay loans |
| `/trade` | **Trade (DEX)** | Swap tokens, add/remove liquidity on AMM pools |
| `/stake` | **Stake & Earn** | Stake LP tokens, watch rewards accrue, claim DCE |
| `/oracle` | **Price Oracle** | Live Chainlink ETH/USD feed |
| `/prop-oracle` | **Prop Price Oracle** | PROP/mUSDC TWAP from on-chain pool data |
| `/governance` | **Governance & Disputes** | Create & vote on DAO proposals; manage property disputes |
| `/security` | **Security Lab** | Run flash-loan attack on VulnerablePool; test SecurePool defence |
| `/gas` | **Gas Optimizations** | Interactive gas-cost comparison of contract patterns |
| `/admin` | **Admin** | Admin-only: dispute management, minting, configuration |

---

## 📂 Project Structure

```
land_registry_dapp/
│
├── contracts/                          # All Solidity smart contracts
│   ├── LandRegistry.sol                # Exp 1
│   ├── PropertyDispute.sol             # Exp 1
│   ├── MockUSDC.sol                    # Exp 3
│   ├── PropertyToken.sol               # Exp 3
│   ├── PropertyVault.sol               # Exp 3
│   ├── LiquidityPool.sol               # Exp 4
│   ├── DCEToken.sol                    # Exp 5
│   ├── StakingRewards.sol              # Exp 5
│   ├── DEXRouter.sol                   # Exp 6
│   ├── PriceFeedConsumer.sol           # Exp 7
│   ├── PoolPriceOracle.sol             # Exp 7
│   ├── GovernanceDAO.sol               # Exp 8
│   ├── PropertyTokenFactory.sol        # Exp 8
│   ├── VulnerablePool.sol              # Exp 9
│   ├── SecurePool.sol                  # Exp 9
│   ├── FlashLoanAttacker.sol           # Exp 9
│   └── GasOptimizationShowcase.sol     # Exp 9
│
├── migrations/                         # Truffle deploy scripts
├── test/                               # Mocha/Chai test suites
├── scripts/                            # Utility scripts
│
├── client/                             # React 18 frontend
│   └── src/
│       ├── App.js                      # Router & global layout
│       ├── App.css                     # Dark-theme global styles
│       ├── abis/                       # Contract ABI JSON files
│       ├── config/
│       │   └── contracts.js            # Chain ID -> address map (all networks)
│       ├── context/
│       │   └── WalletContext.js        # ethers.js provider/signer React context
│       ├── hooks/                      # Custom React hooks
│       ├── components/                 # Reusable UI components
│       │   ├── RegisterProperty.js
│       │   ├── TransferOwnership.js
│       │   ├── PropertyDetails.js
│       │   ├── DisputePanel.js
│       │   ├── CreateProposal.js
│       │   ├── ProposalCard.js
│       │   ├── VaultPanel.js
│       │   ├── StakePanel.js
│       │   ├── RewardsClaim.js
│       │   ├── SwapPanel.js
│       │   ├── AddLiquidity.js
│       │   ├── RemoveLiquidity.js
│       │   ├── PoolStats.js
│       │   ├── MintFaucet.js
│       │   └── PriceTicker.js
│       └── pages/                      # One file per route
│           ├── Marketplace.js
│           ├── PropertyDetail.js
│           ├── VaultDashboard.js
│           ├── Trade.js
│           ├── Stake.js
│           ├── Oracle.js
│           ├── PropPriceOracle.js
│           ├── Governance.js
│           ├── SecurityLab.js
│           ├── GasOptimizations.js
│           └── Admin.js
│
├── truffle-config.js
├── hardhat.config.js
├── .env.example
└── package.json
```

---

## 🚀 Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ (LTS)
- [MetaMask](https://metamask.io/) browser extension
- [Ganache](https://trufflesuite.com/ganache/) desktop app (for local testing)
- Truffle globally: `npm install -g truffle`

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/land_registry_dapp.git
cd land_registry_dapp

# Root dependencies (Truffle, Hardhat, etc.)
npm install

# Frontend dependencies
cd client && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env — add your Infura/Alchemy project ID and deployer private key
```

### 3. Local Development (Ganache)

```bash
# Start Ganache (GUI), or CLI:
npx ganache --port 7545 --chainId 1337

# Compile & deploy
truffle compile
truffle migrate --network development

# Start the frontend
cd client && npm start
# Opens http://localhost:3000
```

**MetaMask — Ganache network settings:**

| Field | Value |
|---|---|
| Network Name | `Ganache Local` |
| RPC URL | `http://127.0.0.1:7545` |
| Chain ID | `1337` |
| Currency symbol | `ETH` |

Import a Ganache account private key into MetaMask for admin access.

### 4. Sepolia Testnet

All contracts are already deployed on Sepolia. To connect:

1. Switch MetaMask to **Sepolia**
2. Get test ETH from [sepoliafaucet.com](https://sepoliafaucet.com/)
3. `cd client && npm start` — the app auto-detects the chain

---

## 🔗 Contract Addresses — Sepolia

| Contract | Address |
|---|---|
| LandRegistry | `0xF14e89a59D995e51Ad967c2e006Af5C65D90DcC2` |
| PropertyDispute | `0x751CD78eB224810271C218793D561101aB7B6Bd7` |
| MockUSDC | `0x5282a9DBd046B4d03DBa74f58C85E12a331F3A2f` |
| PropertyToken (PROP) | `0xaF81486e637dFb386E9Fc0Fb6Dd23bb6F99BABcB` |
| PropertyVault | `0x3caAfFa8973820AEe86306AAe0857EC9dBFAC3F4` |
| LiquidityPool — PROP/mUSDC | `0x2d52835e6334E9af8DcAd56B3A8722bD46C27d8C` |
| LiquidityPool — DCE/mUSDC | `0x74aC68b09A9A35a29f3B6472BC2B5DB3ab20788e` |
| DCEToken | `0xf385FA8cFEd7b0A82B95a8E28108226359a58380` |
| StakingRewards | `0x3DaFc468671c9aD825242a46351a0A564ae5cc46` |
| DEXRouter | `0x2175b721215dcc9d91Fae30F9C9D921b8171c585` |
| PriceFeedConsumer | `0x0aA8757E71998800A95e8209eb8A9d642A7D04DC` |
| PoolPriceOracle | `0xC9596e23e74eab5C8415c0f287d035E652db714d` |
| GovernanceDAO | `0xc6983D96B8737f92fC942F230521564230c0a2EA` |
| PropertyTokenFactory | `0x7659141C20aE2477a1fE956714FFF37b85554E47` |
| VulnerablePool | `0x552ebb7B27Dd82435834D3AD22A99afa8F55169A` |
| SecurePool | `0xb7990C55998B8e9DA6a9a342568aA0D50159C025` |
| FlashLoanAttacker | `0xd3111bC4c913E5093b8EA7bB379cd5f93ff043fc` |

> Contracts deployed via Remix IDE and Truffle. Verify on [Sepolia Etherscan](https://sepolia.etherscan.io/).

---

## 💻 Usage Guide

### Register a Property
1. Go to **Marketplace** and connect MetaMask
2. Fill in location, area (sq.m), price (ETH), and an IPFS document hash
3. Confirm the MetaMask transaction — the property gets a unique on-chain ID

### Transfer Ownership
1. Find the property on **Marketplace** or **Property Detail**
2. Only the current owner can initiate a transfer
3. Enter the recipient address and confirm — blocked if a dispute is active

### Borrow Against Property (Vault)
1. Go to **Vault Dashboard**
2. Approve & deposit PROP tokens as collateral
3. Borrow mUSDC up to the collateral ratio
4. Repay the loan to retrieve your PROP

### Swap Tokens / Add Liquidity (DEX)
1. Go to **Trade**
2. Select input/output tokens — the Router auto-routes through pools
3. Switch to the **Liquidity** tab to add/remove liquidity and receive LP tokens

### Stake LP Tokens for DCE Rewards
1. Add liquidity on **Trade** to receive LP tokens
2. Go to **Stake**, deposit LP tokens
3. DCE rewards accrue every block — claim anytime

### View Price Feeds
- **Oracle** — live Chainlink ETH/USD, updated every block
- **Prop Price Oracle** — PROP/mUSDC TWAP from on-chain pool snapshots

### Governance — Create & Vote on Proposals
1. Hold DCE tokens (earn via staking or buy on DEX)
2. Go to **Governance → Community DAO**
3. Create a proposal (description, target contract, encoded calldata)
4. DCE holders vote **For** or **Against** during the voting window
5. When voting closes with quorum + majority, anyone can execute the proposal on-chain

### Disputes — Raise & Resolve
1. Go to **Governance → Property Disputes**
2. Any address can raise a dispute — property is immediately locked from transfers
3. Admin resolves with a permanent on-chain resolution note — property is unlocked

### Security Lab
1. Go to **Security Lab**
2. Read the vulnerability explanation for `VulnerablePool`
3. Click **Run Attack** — the attacker contract drains the pool via flash-loan re-entrancy
4. Run the same attack against `SecurePool` and observe it revert
5. Compare gas and code differences in **Gas Optimizations**

---

## 🧪 Testing

```bash
# Run all contract tests
truffle test

# Run a specific suite
truffle test test/LandRegistry.test.js
truffle test test/PropertyDispute.test.js
```

Coverage includes:
- Property registration, transfer, ownership history
- Dispute raising, resolution, transfer locking
- Access control (`onlyOwner`, `onlyAdmin`, `onlyPropertyOwner`)
- Input validation and revert conditions

---

## 🐛 Troubleshooting

| Error | Likely Cause | Fix |
|---|---|---|
| `MetaMask not installed` | Extension missing | Install MetaMask and refresh the page |
| `no matching fragment` | ABI out of sync with contract | Re-copy ABI from `build/contracts/` or Remix compilation output |
| `You are not the owner` | Wrong MetaMask account selected | Switch to the account that registered the property |
| `Property is disputed` | Transfer blocked by active dispute | Resolve the dispute first using an admin account |
| `nonce too high` | Stale nonce after Ganache restart | MetaMask → Settings → Advanced → **Reset Account** |
| Blank `/governance` page | DAO address not set | Add `governanceDAO` address in `client/src/config/contracts.js` |
| Pool swap reverts | Pool has no liquidity seeded | Add initial liquidity on the Trade page first |

---

## 📚 Resources

- [Solidity Docs](https://docs.soliditylang.org/)
- [ethers.js v6 Docs](https://docs.ethers.org/v6/)
- [Chainlink Price Feeds](https://docs.chain.link/data-feeds)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Truffle Suite Docs](https://trufflesuite.com/docs/)
- [Sepolia Etherscan](https://sepolia.etherscan.io/)
- [Sepolia Faucet](https://sepoliafaucet.com/)

---

## 📄 License

MIT — free to use for educational purposes.
