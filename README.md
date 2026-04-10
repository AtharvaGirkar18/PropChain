# 🏠 Land Registry DApp - Blockchain-Based Property Ownership System

A decentralized application (DApp) for managing property ownership and resolving disputes using Ethereum smart contracts. This project demonstrates a solution to India's broken land registry system by leveraging blockchain technology.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Deployment](#deployment)
- [Usage Guide](#usage-guide)
- [Lab Milestones](#lab-milestones)

## 📖 Project Overview

This is a college lab project for **Lab 7 & Lab 8**, implementing a blockchain-based National Property Register using Solidity smart contracts, Truffle framework, and React frontend.

### Problem Statement

India's land registry system suffers from:

- 🚫 **Fake Documents**: Forged property deeds and titles are common
- ⚖️ **Disputes**: Unclear ownership leading to legal battles
- 🔓 **No Transparency**: Centralized records are vulnerable to tampering
- 🔗 **Broken Chain of Title**: Hard to verify complete ownership history

### Solution

A blockchain-based property register that provides:

- ✅ **Immutable Records**: All transactions recorded permanently on blockchain
- 🔍 **Transparent**: Complete ownership history visible to all stakeholders
- ⏰ **Timestamped**: Every action recorded with exact timestamp
- 🛡️ **Tamper-Proof**: Cryptographic security prevents fraud
- 📜 **Document Hash**: IPFS integration for document verification

## 🛠️ Tech Stack

| Component        | Technology                  |
| ---------------- | --------------------------- |
| Smart Contracts  | Solidity ^0.8.0             |
| Blockchain       | Ethereum                    |
| Local Network    | Ganache                     |
| Framework        | Truffle Suite               |
| Testing          | Truffle Test (Mocha + Chai) |
| Frontend         | React 18                    |
| Web3 Integration | Web3.js v4                  |
| Wallet           | MetaMask                    |
| Storage          | IPFS (for documents)        |

## ✨ Features

### Contract 1: LandRegistry.sol

Register and manage property ownership:

- 📝 **Register Property**: Record new property with details
  - Owner address, location, area, price, document hash
  - Automatic timestamp and unique ID

- 🔄 **Transfer Ownership**: Transfer property to new owner
  - Requires current owner signature (onlyPropertyOwner)
  - Cannot transfer if disputed (propertyNotDisputed)
  - Maintains full ownership history

- 📋 **View Details**: Retrieve property information
  - All metadata: location, area, price, documents
  - Owner and dispute status
  - Registration timestamp

- ⚠️ **Manage Disputes**: Mark and resolve disputes
  - Admin-only dispute marking
  - Prevent transfers of disputed properties
  - Track dispute status

- 🔗 **Ownership History**: Complete chain of title
  - All previous owners recorded
  - Full transaction history

### Contract 2: PropertyDispute.sol

Manage property disputes transparently:

- 🚩 **Raise Dispute**: Anyone can raise a dispute with reason
  - Reason documented on-chain
  - Automatically marks property as disputed
  - Prevents future transfers

- ✅ **Resolve Dispute**: Admin can resolve with resolution details
  - Only admin/government can resolve
  - Resolution documented permanently
  - Clears property disputed status

- 📍 **View Disputes**: Check all disputes for a property
  - Active and resolved disputes
  - Original reason and resolution
  - Status of each dispute

### Frontend: React DApp

User-friendly interface with four tabs:

1. **📝 Register Property** - Register new properties
2. **🔄 Transfer Ownership** - Transfer between accounts
3. **📋 Property Details** - View and verify properties
4. **⚠️ Disputes** - Manage property disputes

## 📂 Project Structure

```
land-registry-dapp/
├── contracts/
│   ├── LandRegistry.sol          # Main property registry contract
│   └── PropertyDispute.sol       # Dispute management contract
│
├── migrations/
│   ├── 1_initial_migration.js    # Truffle migrations setup
│   └── 2_deploy_contracts.js     # Deploy both contracts
│
├── test/
│   ├── LandRegistry.test.js      # Tests for LandRegistry
│   └── PropertyDispute.test.js   # Tests for PropertyDispute
│
├── client/                        # React Frontend
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js               # Main React component
│   │   ├── App.css              # Styling
│   │   ├── index.js
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── RegisterProperty.js
│   │   │   ├── TransferOwnership.js
│   │   │   ├── PropertyDetails.js
│   │   │   └── DisputePanel.js
│   │   ├── utils/
│   │   │   └── web3.js          # Web3 utilities & helpers
│   │   └── contracts/           # Contract ABIs (generated after compile)
│   └── package.json
│
├── truffle-config.js             # Truffle configuration
├── package.json                  # Project dependencies
└── README.md                      # This file
```

## 🚀 Installation & Setup

### Phase 1: Initial Setup (Day 1)

#### 1. Install Required Tools

```bash
# Install Node.js (if not already installed)
# Download from https://nodejs.org/ (LTS version recommended)

# Install Truffle globally
npm install -g truffle

# Install Ganache Desktop
# Download from https://trufflesuite.com/ganache/
```

#### 2. Project Setup

```bash
# Navigate to project directory
cd land-registry-dapp

# Install dependencies
npm install

# Initialize Truffle project (if not already done)
# truffle init
```

#### 3. Start Local Blockchain

```bash
# Open Ganache Desktop App
# Click "Quickstart Ethereum" to start local blockchain
# Note: RPC Server should be: http://127.0.0.1:7545
# Save one of the private keys for later use
```

### Phase 2: Smart Contracts (Day 1-2)

#### 1. Compile Contracts

```bash
# In terminal, navigate to project root
npm run compile

# Or use Truffle directly
truffle compile
```

Expected output:

```
Compiling your contracts...
✓ Compiled Successfully
  - Contracts compiled successfully
  - Artifact saved to src/contracts/
```

#### 2. Deploy Contracts

```bash
npm run migrate

# Or manually:
truffle migrate --network development

# Reset deployment (if needed):
npm run migrate:reset
```

Expected output:

```
Deploying Contracts
   Replacing 'Migrations'
   Replacing 'LandRegistry'
   Replacing 'PropertyDispute'
   Saving artifacts...
```

**⚠️ IMPORTANT**: Note the deployed contract addresses! You'll need these for the React frontend.

#### 3. Test Contracts (Optional)

```bash
npm test

# Or:
truffle test
```

### Phase 3: MetaMask Setup

#### 1. Install MetaMask

- Download MetaMask extension for Chrome/Firefox
- Install and create account

#### 2. Connect to Ganache

1. Open MetaMask
2. Click Network dropdown → "Add network manually"
3. Configure:
   - Network name: `Ganache`
   - RPC URL: `http://127.0.0.1:7545`
   - Chain ID: `1337` (or `5777`)
   - Currency: `ETH`
4. Click "Save"

#### 3. Import Test Account

1. In Ganache, copy the private key of first account
2. In MetaMask: Click "Account" → "Import Account"
3. Paste the private key
4. This account will be the Admin/Owner

### Phase 4: React Frontend (Day 2-3)

#### 1. Setup React App

```bash
cd client

# Install dependencies
npm install
```

#### 2. Update Contract Addresses

1. Open `client/src/App.js`
2. Find these lines (around line 30):
   ```javascript
   const LAND_REGISTRY_ADDRESS = ""; // Update after migration
   const PROPERTY_DISPUTE_ADDRESS = ""; // Update after migration
   ```
3. Replace with addresses from migration output

#### 3. Copy Contract ABIs

After compilation, copy contract ABIs:

1. From: `build/contracts/`
2. Copy: `LandRegistry.json` and `PropertyDispute.json`
3. To: `client/src/contracts/`

#### 4. Start React Development Server

```bash
npm start

# App will open at http://localhost:3000
```

## 📝 Development Workflow

### Day 1: Smart Contracts

1. ✅ Write `LandRegistry.sol` (already provided)
2. ✅ Write `PropertyDispute.sol` (already provided)
3. ✅ Initialize migrations
4. ✅ Test locally with `truffle console`
5. ✅ Test with automated tests

### Day 2: Testing & Refinement

1. ✅ Run test suite: `npm test`
2. ✅ Debug any issues
3. ✅ Verify all functions work
4. ✅ Test ownership transfer logic
5. ✅ Test dispute management

### Day 3: Frontend Development

1. ✅ Create React components
2. ✅ Connect MetaMask wallet
3. ✅ Implement contract interaction
4. ✅ Test each feature
5. ✅ Style and polish UI

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Test Cases Included

**LandRegistry.test.js:**

- ✅ Property registration
- ✅ Ownership transfer
- ✅ Property details retrieval
- ✅ Dispute marking and resolution
- ✅ Ownership history tracking
- ✅ Input validation
- ✅ Access control (onlyPropertyOwner, onlyAdmin)

**PropertyDispute.test.js:**

- ✅ Dispute raising
- ✅ Dispute resolution
- ✅ Admin-only functions
- ✅ Property dispute status updates

### Manual Testing in Truffle Console

```bash
truffle console --network development

# In console:
> let lr = await LandRegistry.deployed()
> let tx = await lr.registerProperty("123 Main St", 5000, web3.utils.toWei("10", "ether"), "QmHash123", {from: accounts[0]})
> let property = await lr.getPropertyDetails(1)
> property
```

## 📤 Deployment

### Lab 7: Local Ganache (Current)

- ✅ Deploy to `localhost:7545`
- ✅ Test with MetaMask connected to Ganache
- ✅ Demonstrate all features locally

### Lab 8: Sepolia Testnet (Next Phase)

1. Get test ETH from faucet
2. Configure deployment in `truffle-config.js`
3. Deploy via Remix IDE or Truffle
4. Verify on Etherscan Sepolia

## 💻 Usage Guide

### 1. Register a Property

1. Connect MetaMask wallet
2. Go to "📝 Register Property" tab
3. Fill in:
   - Location (e.g., "123 Main Street, New Delhi")
   - Area (e.g., 5000 sq.m)
   - Price (in Wei: 1 ETH = 10^18 Wei)
   - Document Hash (IPFS hash of property documents)
4. Click "Register Property"
5. Confirm transaction in MetaMask
6. Property registered! Note the Property ID

### 2. Transfer Ownership

1. Go to "🔄 Transfer Ownership" tab
2. Enter Property ID and click "Fetch Details"
3. Verify you are the current owner
4. Enter new owner's Ethereum address
5. Click "Transfer Ownership"
6. Confirm transaction
7. Ownership transferred! Only the new owner can now transfer

### 3. View Property Details

1. Go to "📋 Property Details" tab
2. Enter Property ID
3. Click "Search"
4. View:
   - All property information
   - Current owner
   - Dispute status (✅ Clean or ⚠️ Disputed)
   - Complete ownership history
   - Document verification link (IPFS)

### 4. Manage Disputes

#### Raise a Dispute (Anyone)

1. Go to "⚠️ Disputes" tab → "🚩 Raise Dispute"
2. Enter Property ID
3. Explain the dispute reason
4. Click "Raise Dispute"
5. Property automatically marked as disputed
6. No more transfers allowed until resolved

#### Resolve a Dispute (Admin Only)

1. Go to "⚠️ Disputes" tab → "✅ Resolve Dispute"
2. Enter Dispute ID
3. Describe resolution
4. Click "Resolve Dispute"
5. Property cleared and can be transferred again

#### View All Disputes

1. Go to "⚠️ Disputes" tab → "📍 View Disputes"
2. Enter Property ID
3. See all disputes (active and resolved)

## 📊 Lab Milestones

### Lab 7: DApp Development

- ✅ **Milestone 1**: Smart Contracts
  - Write `LandRegistry.sol` (register, transfer, manage disputes)
  - Write `PropertyDispute.sol` (raise, resolve disputes)
  - Test with Ganache locally

- ✅ **Milestone 2**: Backend Testing
  - Unit tests for all functions
  - Integration tests for contract interaction
  - Error handling and validation

- ✅ **Milestone 3**: Frontend
  - React UI with 4 tabs
  - MetaMask wallet connection
  - Contract interaction via Web3.js
  - Property management interface

### Lab 8: Testnet Deployment

- Deploy to Sepolia testnet
- Get test ETH from faucet
- Verify contracts on Etherscan
- Demonstrate live transactions
- Show transaction history

## 🔑 Important Notes

### Addresses & Keys

- **Admin Account**: First Ganache account (has special permissions)
- **Test Accounts**: Use any other Ganache accounts
- **Private Keys**: Never share! Only import from Ganache locally

### Gas & Transactions

- Ganache gives unlimited test ETH (free gas)
- Sepolia testnet requires faucet ETH
- Gas fees increase with contract complexity

### Known Limitations

1. ABIs must be manually updated after recompilation
2. Admin hardcoded to deployer account
3. No role-based access control (RBAC) for multiple admins
4. IPFS integration for documents (external)

## 🐛 Troubleshooting

### MetaMask Won't Connect

```
Error: "MetaMask not installed"
Solution: Install MetaMask extension and refresh page
```

### Contract Address Not Found

```
Error: "Contract not found at address"
Solution: Update addresses in App.js after fresh migration
         Run: truffle migrate --network development --reset
```

### Transaction Fails

```
Error: "You are not the owner of this property"
Solution: Use the account that registered the property
         Check account in MetaMask wallet
```

### IPFS Link Not Working

```
Error: "Document not accessible"
Solution: Upload real documents to IPFS first (use pinata.cloud)
         Use actual IPFS hash in registration
```

## 📚 Learning Resources

- [Solidity Docs](https://docs.soliditylang.org/)
- [Truffle Suite](https://trufflesuite.com/)
- [Web3.js Docs](https://web3js.org/)
- [MetaMask Guide](https://metamask.io/)
- [Ethereum Development](https://ethereum.org/developers)

## 👨‍💻 Project by

**Your Name**  
College Lab Project - Lab 7 & Lab 8  
Date: 2024

## 📄 License

MIT License - Feel free to use for educational purposes

---

**Happy DApp Building! 🚀**

For questions or issues, refer to the troubleshooting section or consult the official documentation of each tool.
