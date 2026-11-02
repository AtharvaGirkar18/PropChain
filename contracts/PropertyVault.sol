// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PropertyVault
 * @notice ERC-4626 tokenized yield vault for DecentraEstate.
 *
 *  Underlying asset: PropertyToken (ERC-20 fractional property share)
 *  Vault share token: deVAULT (ERC-20)
 *
 *  How it works:
 *   1. Investors approve PropertyToken and call deposit() → receive deVAULT shares.
 *   2. The admin (property owner) periodically calls notifyYield() to transfer
 *      additional PropertyTokens into the vault, increasing total assets.
 *   3. Because ERC-4626's convertToAssets() = totalAssets / totalSupply, each
 *      share becomes redeemable for MORE PropertyTokens than originally deposited.
 *   4. Investors redeem() shares → receive PropertyTokens + accrued yield.
 *
 *  ERC-4626 interface (from OpenZeppelin):
 *   deposit(assets, receiver)     → shares
 *   mint(shares, receiver)        → assets
 *   withdraw(assets, receiver, owner) → shares burned
 *   redeem(shares, receiver, owner)   → assets
 *   previewDeposit(assets)        → shares (read-only)
 *   previewRedeem(shares)         → assets (read-only)
 *   convertToShares(assets)       → shares
 *   convertToAssets(shares)       → assets
 *   totalAssets()                 → total PropertyTokens held
 *
 * Experiment 3 — ERC-4626 Vault
 */
contract PropertyVault is ERC4626, Ownable {

    // ── Custom errors ─────────────────────────────────────────────────────────
    error ZeroYield();
    error YieldTransferFailed();

    // ── State ─────────────────────────────────────────────────────────────────
    uint256 private _totalYieldNotified;
    uint256 public  deployedAt;

    // ── Events ────────────────────────────────────────────────────────────────
    event YieldNotified(address indexed from, uint256 amount, uint256 newTotalAssets);

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param asset_ Address of the PropertyToken contract (the underlying ERC-20).
     */
    constructor(address asset_)
        ERC4626(IERC20(asset_))
        ERC20("DecentraEstate Vault", "deVAULT")
        Ownable(msg.sender)
    {
        deployedAt = block.timestamp;
    }

    // ── Yield Notification ────────────────────────────────────────────────────

    /**
     * @notice Owner deposits additional PropertyTokens as yield, increasing
     *         the redeemable value of every existing vault share.
     *
     * @param amount PropertyToken amount (18-decimal) to add as yield.
     *
     * Caller must approve this vault to spend `amount` PropertyTokens first.
     */
    function notifyYield(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroYield();

        bool ok = IERC20(asset()).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert YieldTransferFailed();

        _totalYieldNotified += amount;
        emit YieldNotified(msg.sender, amount, totalAssets());
    }

    // ── View Helpers ──────────────────────────────────────────────────────────

    /**
     * @notice Total PropertyToken yield that has been notified to this vault.
     */
    function totalYieldNotified() external view returns (uint256) {
        return _totalYieldNotified;
    }

    /**
     * @notice Estimated annualised yield percentage based on yield notified
     *         relative to TVL and time elapsed since deployment.
     * @return APY as a percentage integer (e.g. 12 means 12%).
     *         Returns 0 if TVL is zero or no yield has been notified yet.
     */
    function estimatedAPY() external view returns (uint256) {
        uint256 tvl = totalAssets();
        if (tvl == 0 || _totalYieldNotified == 0) return 0;

        uint256 elapsed = block.timestamp - deployedAt;
        if (elapsed == 0) return 0;

        // Annualise: yieldNotified * secondsPerYear / elapsed
        uint256 annualYield = (_totalYieldNotified * 365 days) / elapsed;
        // APY% = annualYield * 100 / tvl
        return (annualYield * 100) / tvl;
    }

    /**
     * @notice Returns the current exchange rate: how many PropertyTokens
     *         one vault share is worth (18-decimal, scaled by 1e18).
     */
    function sharePrice() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e18; // 1:1 initial price
        return (totalAssets() * 1e18) / supply;
    }
}
