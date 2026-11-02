// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PropertyToken
 * @notice ERC-20 fractional ownership token for a single registered property.
 *
 *  Story:
 *   1. Admin deploys one PropertyToken contract per property (propertyId links back
 *      to LandRegistry).
 *   2. Initial supply is minted to the deployer (property owner).
 *   3. Investors call buyTokens() paying mUSDC → receive tokens from owner's wallet.
 *   4. Property owner deposits monthly rent (mUSDC) via depositRent().
 *      Rent is distributed proportionally to all circulating token holders using
 *      the standard "reward-per-token" accumulator pattern.
 *   5. Investors call claimRent() to pull accumulated rental income.
 *
 * Experiment 3 — ERC-4626 Vault
 */
contract PropertyToken is ERC20, Ownable {

    // ── Custom errors ─────────────────────────────────────────────────────────
    error ZeroAmount();
    error ZeroTokenPrice();
    error NoRentToClaim();
    error InsufficientOwnerBalance();
    error USDCTransferFailed();

    // ── Immutables ────────────────────────────────────────────────────────────
    /// @notice LandRegistry property ID this token represents
    uint256 public immutable propertyId;

    /// @notice The mUSDC contract used for payments
    IERC20 public immutable usdc;

    // ── Mutable state ─────────────────────────────────────────────────────────
    /// @notice mUSDC price per single PropertyToken (6-decimal USDC, 18-decimal token)
    uint256 public tokenPrice;

    // Rental income distribution (staking-rewards accumulator)
    /// @dev Global accumulator scaled by 1e18 to avoid precision loss
    uint256 public rentPerTokenAccumulated;
    /// @notice Per-user checkpoint snapshot of the accumulator at last settlement
    mapping(address => uint256) public rentDebt;
    /// @notice Claimable (but not yet claimed) mUSDC per user
    mapping(address => uint256) public pendingRent;

    // ── Events ────────────────────────────────────────────────────────────────
    event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 usdcPaid);
    event RentDeposited(address indexed depositor, uint256 usdcAmount);
    event RentClaimed(address indexed user, uint256 usdcAmount);
    event TokenPriceUpdated(uint256 oldPrice, uint256 newPrice);

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param name_          ERC-20 name, e.g. "PropChain Property #1 Token"
     * @param symbol_        ERC-20 symbol, e.g. "PROP-1"
     * @param propertyId_    Corresponding LandRegistry property ID
     * @param initialSupply  Total fractional tokens minted to owner (18-decimal)
     * @param tokenPrice_    mUSDC cost per 1 full token (6-decimal precision)
     * @param usdcAddress    Deployed MockUSDC contract address
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 propertyId_,
        uint256 initialSupply,
        uint256 tokenPrice_,
        address usdcAddress
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        if (tokenPrice_ == 0) revert ZeroTokenPrice();
        propertyId   = propertyId_;
        tokenPrice   = tokenPrice_;
        usdc         = IERC20(usdcAddress);
        _mint(msg.sender, initialSupply);
    }

    // ── Investment ────────────────────────────────────────────────────────────

    /**
     * @notice Purchase fractional property tokens with mUSDC.
     * @param tokenAmount Number of tokens to buy (18-decimal, e.g. 1e18 = 1 token).
     *
     * Flow:
     *   caller.approve(PropertyToken.address, usdcCost) first
     *   then call buyTokens(tokenAmount)
     */
    function buyTokens(uint256 tokenAmount) external {
        if (tokenAmount == 0) revert ZeroAmount();

        uint256 usdcCost = (tokenAmount * tokenPrice) / 1e18;

        // Settle pending rent for buyer before balance changes
        _settleRent(msg.sender);

        // Pull payment
        bool ok = usdc.transferFrom(msg.sender, address(this), usdcCost);
        if (!ok) revert USDCTransferFailed();

        // Transfer from owner's balance (not mint)
        uint256 ownerBal = balanceOf(owner());
        if (ownerBal < tokenAmount) revert InsufficientOwnerBalance();

        // Settle owner's rent before their balance shrinks
        _settleRent(owner());
        _transfer(owner(), msg.sender, tokenAmount);

        emit TokensPurchased(msg.sender, tokenAmount, usdcCost);
    }

    // ── Rental Income ─────────────────────────────────────────────────────────

    /**
     * @notice Property owner deposits rental income for distribution.
     * @param amount mUSDC amount to distribute (6-decimal).
     *
     * Only circulating tokens (total supply minus owner's balance) are counted
     * so the owner does not earn rent from their own unsold tokens.
     *
     * Caller must approve this contract to spend `amount` of mUSDC first.
     */
    function depositRent(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        // Pull the mUSDC from depositor
        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert USDCTransferFailed();

        uint256 circulatingSupply = totalSupply() - balanceOf(owner());
        if (circulatingSupply > 0) {
            // Increment global accumulator
            rentPerTokenAccumulated += (amount * 1e18) / circulatingSupply;
        }

        emit RentDeposited(msg.sender, amount);
    }

    /**
     * @notice Claim all accumulated rental income for the caller.
     */
    function claimRent() external {
        _settleRent(msg.sender);

        uint256 claimable = pendingRent[msg.sender];
        if (claimable == 0) revert NoRentToClaim();

        pendingRent[msg.sender] = 0;

        bool ok = usdc.transfer(msg.sender, claimable);
        if (!ok) revert USDCTransferFailed();

        emit RentClaimed(msg.sender, claimable);
    }

    /**
     * @notice View pending (unclaimed) rental income for any address.
     * @return mUSDC amount claimable (6-decimal).
     */
    function pendingRentOf(address user) external view returns (uint256) {
        uint256 newlyEarned = (balanceOf(user) * (rentPerTokenAccumulated - rentDebt[user])) / 1e18;
        return pendingRent[user] + newlyEarned;
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /**
     * @notice Update the mUSDC price per token (owner only).
     */
    function setTokenPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert ZeroTokenPrice();
        emit TokenPriceUpdated(tokenPrice, newPrice);
        tokenPrice = newPrice;
    }

    /**
     * @notice Returns the mUSDC cost to purchase `tokenAmount` tokens.
     * @param tokenAmount 18-decimal token quantity.
     */
    function quoteUSDC(uint256 tokenAmount) external view returns (uint256) {
        return (tokenAmount * tokenPrice) / 1e18;
    }

    /**
     * @notice Tokens currently available for investors to buy (owner's balance).
     */
    function availableForSale() external view returns (uint256) {
        return balanceOf(owner());
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    /**
     * @dev Snapshot pending rent for `user` at the current accumulator value.
     *      Must be called before any balance change to ensure correct accounting.
     */
    function _settleRent(address user) internal {
        uint256 newlyEarned = (balanceOf(user) * (rentPerTokenAccumulated - rentDebt[user])) / 1e18;
        pendingRent[user] += newlyEarned;
        rentDebt[user]     = rentPerTokenAccumulated;
    }

    /**
     * @dev ERC-20 balance-change hook (OZ v5). Settle rent for both parties
     *      BEFORE the balance update so each side earns based on their
     *      pre-transfer holdings.
     */
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0)) _settleRent(from);
        if (to   != address(0)) _settleRent(to);
        super._update(from, to, value);
    }
}
