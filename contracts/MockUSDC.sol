// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Testnet stablecoin that mimics USDC (6 decimals).
 *         Used as the investment currency across DecentraEstate.
 *
 * Experiment 3 — ERC-4626 Vault
 */
contract MockUSDC is ERC20 {

    uint8 private constant _DECIMALS = 6;

    /// @dev Amount dispensed per faucet call: 10,000 mUSDC
    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** 6;

    event Faucet(address indexed to, uint256 amount);

    constructor() ERC20("Mock USD Coin", "mUSDC") {
        // Mint 10,000,000 mUSDC to deployer for ecosystem seeding
        _mint(msg.sender, 10_000_000 * 10 ** _DECIMALS);
    }

    /// @notice Returns 6 (matches real USDC precision)
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /**
     * @notice Public faucet — anyone can call to receive 10,000 mUSDC.
     *         One call per transaction; no per-wallet rate-limit for simplicity.
     */
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
        emit Faucet(msg.sender, FAUCET_AMOUNT);
    }

    /**
     * @notice Unrestricted mint for deploy scripts and test setup.
     *         In a production context this would be access-controlled.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
