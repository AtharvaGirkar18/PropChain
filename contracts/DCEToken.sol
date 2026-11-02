// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DCEToken
 * @notice Governance and reward token for the DecentraEstate platform.
 *         Minted exclusively by the StakingRewards contract (the "minter")
 *         as yield farming rewards.
 *
 * Symbol : DCE
 * Decimals: 18 (ERC-20 default)
 *
 * Only the designated minter address (StakingRewards) can call mint().
 * The owner can update the minter once (e.g. to upgrade the staking contract).
 */
contract DCEToken is ERC20, Ownable {

    address public minter;

    event MinterUpdated(address indexed oldMinter, address indexed newMinter);

    error OnlyMinter();
    error ZeroAddress();

    constructor() ERC20("DecentraEstate Token", "DCE") Ownable(msg.sender) {}

    // ── Minter management ────────────────────────────────────────────────────

    /**
     * @notice Sets the address that is allowed to mint DCE tokens.
     *         Call this after deploying StakingRewards, passing its address.
     */
    function setMinter(address _minter) external onlyOwner {
        if (_minter == address(0)) revert ZeroAddress();
        emit MinterUpdated(minter, _minter);
        minter = _minter;
    }

    /**
     * @notice Mint DCE tokens. Only callable by the minter (StakingRewards).
     */
    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert OnlyMinter();
        _mint(to, amount);
    }
}
