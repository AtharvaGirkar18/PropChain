/**
 * deploy-exp3.js  —  Experiment 3: ERC-4626 Vault
 *
 * Deploys:
 *   1. MockUSDC        — testnet stablecoin (6 decimals)
 *   2. PropertyToken   — ERC-20 fractional property token for Property #1
 *   3. PropertyVault   — ERC-4626 vault with PropertyToken as underlying asset
 *
 * Usage:
 *   npx hardhat run scripts/deploy-exp3.js --network localhost   (Ganache)
 *   npx hardhat run scripts/deploy-exp3.js --network hardhat     (in-process)
 *   npx hardhat run scripts/deploy-exp3.js --network sepolia     (testnet)
 */

import hre from "hardhat";
import fs  from "fs";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network    = hre.network.name;
  const { chainId } = await hre.ethers.provider.getNetwork();

  console.log("═══════════════════════════════════════════════════");
  console.log("  DecentraEstate — Experiment 3 Deployment");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Network  : ${network} (chainId ${chainId})`);
  console.log(`  Deployer : ${deployer.address}`);
  console.log("───────────────────────────────────────────────────\n");

  // ── 1. MockUSDC ────────────────────────────────────────────────────────────
  console.log("1/3  Deploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log(`     ✓ MockUSDC  →  ${mockUSDCAddress}\n`);

  // ── 2. PropertyToken (Property #1) ────────────────────────────────────────
  // 10,000 fractional tokens at 100 mUSDC each
  // initialSupply: 10_000 tokens (18-decimal) = 10_000n * 10n**18n
  // tokenPrice:    100 mUSDC (6-decimal)      = 100n   * 10n**6n
  console.log("2/3  Deploying PropertyToken for Property #1...");
  const PropertyToken = await hre.ethers.getContractFactory("PropertyToken");
  const propertyToken = await PropertyToken.deploy(
    "PropChain Property #1 Token",   // name
    "PROP-1",                         // symbol
    1n,                               // propertyId (matches LandRegistry ID)
    10_000n * 10n ** 18n,             // initialSupply — 10,000 tokens to deployer
    100n   * 10n ** 6n,               // tokenPrice   — 100 mUSDC per token
    mockUSDCAddress                   // mUSDC contract
  );
  await propertyToken.waitForDeployment();
  const propertyTokenAddress = await propertyToken.getAddress();
  console.log(`     ✓ PropertyToken  →  ${propertyTokenAddress}\n`);

  // ── 3. PropertyVault (ERC-4626) ────────────────────────────────────────────
  console.log("3/3  Deploying PropertyVault (ERC-4626)...");
  const PropertyVault = await hre.ethers.getContractFactory("PropertyVault");
  const propertyVault = await PropertyVault.deploy(propertyTokenAddress);
  await propertyVault.waitForDeployment();
  const propertyVaultAddress = await propertyVault.getAddress();
  console.log(`     ✓ PropertyVault  →  ${propertyVaultAddress}\n`);

  // ── Post-deployment summary ────────────────────────────────────────────────
  const deployerUSDCBalance = await mockUSDC.balanceOf(deployer.address);
  const deployerTokenBalance = await propertyToken.balanceOf(deployer.address);

  console.log("───────────────────────────────────────────────────");
  console.log("  Deployer balances after deployment:");
  console.log(`    mUSDC:  ${hre.ethers.formatUnits(deployerUSDCBalance, 6)} mUSDC`);
  console.log(`    PROP-1: ${hre.ethers.formatEther(deployerTokenBalance)} PROP-1`);
  console.log("───────────────────────────────────────────────────\n");

  // ── Save addresses to JSON ─────────────────────────────────────────────────
  const output = {
    network,
    chainId: chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MockUSDC:      mockUSDCAddress,
      PropertyToken: propertyTokenAddress,
      PropertyVault: propertyVaultAddress,
    },
  };

  fs.writeFileSync("deployed-exp3.json", JSON.stringify(output, null, 2));

  console.log("✅  All Experiment 3 contracts deployed!");
  console.log("    Addresses saved to → deployed-exp3.json\n");
  console.log("═══════════════════════════════════════════════════");
  console.log("  Next steps:");
  console.log("  1. Copy ABIs from artifacts/ to client/src/abis/");
  console.log("  2. Update client/src/config/contracts.js with these addresses");
  console.log("  3. Start the frontend: cd client && npm start");
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
