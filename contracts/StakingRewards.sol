// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Minimal interface for DCEToken — only the mint function is needed here.
interface IDCEToken {
    function mint(address to, uint256 amount) external;
}

/**
 * @title StakingRewards
 * @notice Yield-farming contract for DecentraEstate.
 *
 *  Users stake LP tokens (from LiquidityPool) and earn DCE tokens
 *  continuously at a fixed `rewardRate` (DCE per second per full token staked,
 *  scaled by 1e18 for precision).
 *
 *  Reward Accounting (Synthetix-style):
 *  ─────────────────────────────────────
 *  • rewardPerTokenStored  — cumulative DCE earned per 1 staked LP token
 *  • userRewardPerTokenPaid[user] — snapshot at last user interaction
 *  • rewards[user]         — pending claimable DCE
 *
 *  Lifecycle:
 *  1. Deploy DCEToken → deploy StakingRewards(lpToken, dceToken, rewardRate)
 *  2. Call dceToken.setMinter(stakingRewardsAddress) so this contract can mint.
 *  3. Users call stake(amount) — LP tokens transferred here.
 *  4. Users call claimRewards() — DCE minted to their address.
 *  5. Users call unstake(amount) — LP tokens returned.
 *  6. Owner can call setRewardRate(newRate) to adjust emissions.
 */
contract StakingRewards is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ── Tokens ────────────────────────────────────────────────────────────────
    IERC20     public immutable lpToken;   // Token staked (LP token from AMM pool)
    IDCEToken  public immutable dceToken;  // Reward token minted to stakers (DCEToken)

    // ── Reward state ──────────────────────────────────────────────────────────
    /// @notice DCE tokens emitted per second per 1e18 staked LP (18-decimal precision)
    uint256 public rewardRate;

    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    // ── Stake state ───────────────────────────────────────────────────────────
    uint256 public totalStaked;
    mapping(address => uint256) public stakedBalance;

    // ── Events ────────────────────────────────────────────────────────────────
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);

    // ── Errors ────────────────────────────────────────────────────────────────
    error ZeroAmount();
    error InsufficientStake();
    error ZeroAddress();

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param _lpToken    Address of the LP token to stake (LiquidityPool ERC-20)
     * @param _dceToken   Address of DCEToken (this contract must be its minter)
     * @param _rewardRate DCE per second per 1e18 staked LP tokens
     *                    Example: 1e15 = 0.001 DCE / second per full LP token ≈ 86.4 DCE/day
     */
    constructor(
        address _lpToken,
        address _dceToken,
        uint256 _rewardRate
    ) Ownable(msg.sender) {
        // NOTE: after deploying, call DCEToken.setMinter(address(this)) so this
        // contract is authorised to mint DCE rewards.
        if (_lpToken  == address(0)) revert ZeroAddress();
        if (_dceToken == address(0)) revert ZeroAddress();
        lpToken    = IERC20(_lpToken);
        dceToken   = IDCEToken(_dceToken);
        rewardRate = _rewardRate;
        lastUpdateTime = block.timestamp;
    }

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime       = block.timestamp;
        if (account != address(0)) {
            rewards[account]             = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    // ── View functions ────────────────────────────────────────────────────────

    /**
     * @notice Current cumulative DCE earned per 1e18 staked LP tokens.
     */
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        return rewardPerTokenStored
            + ((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / totalStaked;
    }

    /**
     * @notice Pending (claimable) DCE reward for a given user.
     */
    function earned(address account) public view returns (uint256) {
        return (
            (stakedBalance[account] * (rewardPerToken() - userRewardPerTokenPaid[account]))
            / 1e18
        ) + rewards[account];
    }

    // ── User actions ──────────────────────────────────────────────────────────

    /**
     * @notice Stake LP tokens. Caller must approve this contract first.
     * @param amount Amount of LP tokens to stake (18 decimals)
     */
    function stake(uint256 amount)
        external
        nonReentrant
        updateReward(msg.sender)
    {
        if (amount == 0) revert ZeroAmount();
        stakedBalance[msg.sender] += amount;
        totalStaked += amount;
        lpToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Unstake LP tokens. Pending rewards are preserved (not auto-claimed).
     * @param amount Amount of LP tokens to unstake
     */
    function unstake(uint256 amount)
        external
        nonReentrant
        updateReward(msg.sender)
    {
        if (amount == 0) revert ZeroAmount();
        if (stakedBalance[msg.sender] < amount) revert InsufficientStake();
        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;
        lpToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Claim all pending DCE rewards. Mints DCE directly to the caller.
     */
    function claimRewards()
        external
        nonReentrant
        updateReward(msg.sender)
    {
        uint256 reward = rewards[msg.sender];
        if (reward == 0) revert ZeroAmount();
        rewards[msg.sender] = 0;
        dceToken.mint(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    /**
     * @notice Unstake all LP tokens AND claim all pending rewards in one transaction.
     */
    function exit() external nonReentrant updateReward(msg.sender) {
        uint256 staked = stakedBalance[msg.sender];
        uint256 reward = rewards[msg.sender];

        if (staked > 0) {
            stakedBalance[msg.sender] = 0;
            totalStaked -= staked;
            lpToken.safeTransfer(msg.sender, staked);
            emit Unstaked(msg.sender, staked);
        }

        if (reward > 0) {
            rewards[msg.sender] = 0;
            dceToken.mint(msg.sender, reward);
            emit RewardClaimed(msg.sender, reward);
        }
    }

    // ── Owner actions ─────────────────────────────────────────────────────────

    /**
     * @notice Update the DCE emission rate.
     * @param newRate New DCE per second per 1e18 staked LP tokens
     */
    function setRewardRate(uint256 newRate)
        external
        onlyOwner
        updateReward(address(0))
    {
        emit RewardRateUpdated(rewardRate, newRate);
        rewardRate = newRate;
    }
}
