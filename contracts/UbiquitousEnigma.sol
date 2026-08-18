// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title UbiquitousEnigma (UEG)
/// @notice ERC20 token that mints 10,000,000 tokens to a fixed address and supports enabling trading after liquidity is added.
contract UbiquitousEnigma is ERC20, Ownable {
    bool public tradingEnabled;

    constructor() ERC20("UbiquitousEnigma", "UEG") {
        uint256 initialSupply = 10_000_000 * 10 ** decimals(); // 10,000,000 tokens with 18 decimals
        // Mint entire initial supply to the provided address
        _mint(0x4E9893B14B15A2f938dbc44BB427ef6Cd858CFec, initialSupply);
        tradingEnabled = false;
    }

    /// @notice Enable trading after liquidity has been added. Only owner can call.
    function enableTrading() external onlyOwner {
        tradingEnabled = true;
    }

    /// @dev Prevent transfers while trading is disabled, except minting and owner operations.
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        super._beforeTokenTransfer(from, to, amount);
        if (!tradingEnabled) {
            // Allow minting (from == address(0)), and allow transfers involving owner
            if (from != address(0) && from != owner() && to != owner()) {
                revert("Trading is not enabled");
            }
        }
    }
}
