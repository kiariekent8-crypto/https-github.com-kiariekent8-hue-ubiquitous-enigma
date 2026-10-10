// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUniswapV2Factory {
    address public lastPair;

    function createPair(
        address,
        address
    ) external returns (address pair) {
        pair = address(0xBEEF);
        lastPair = pair;
    }
}

contract MockUniswapV2Router {
    address private immutable _factory;
    address private constant _weth = address(0xCAFE);

    uint256 public swapCalls;
    uint256 public liquidityCalls;
    uint256 public lastSwapAmount;
    uint256 public lastLiquidityTokenAmount;
    uint256 public lastLiquidityEthAmount;

    uint256 public ethToReturn = 0.01 ether;

    bool public failSwap;
    bool public failLiquidity;
    bool public returnZeroLiquidity;
    bool public attemptReentrantTransfer;
    bool public reentrantTransferSucceeded;

    bytes public reentrantTransferReturnData;
    address public reentrantRecipient;
    uint256 public reentrantAmount;

    constructor(address factoryAddress) {
        require(factoryAddress != address(0), "Mock: zero factory");
        _factory = factoryAddress;
    }

    receive() external payable {}

    function factory() external view returns (address) {
        return _factory;
    }

    function WETH() external pure returns (address) {
        return _weth;
    }

    function setEthToReturn(uint256 amount) external {
        ethToReturn = amount;
    }

    function setFailSwap(bool enabled) external {
        failSwap = enabled;
    }

    function setFailLiquidity(bool enabled) external {
        failLiquidity = enabled;
    }

    function setReturnZeroLiquidity(bool enabled) external {
        returnZeroLiquidity = enabled;
    }

    function configureReentrantTransfer(
        bool enabled,
        address recipient,
        uint256 amount
    ) external {
        if (enabled) {
            require(recipient != address(0), "Mock: zero recipient");
        }

        attemptReentrantTransfer = enabled;
        reentrantRecipient = recipient;
        reentrantAmount = amount;
        reentrantTransferSucceeded = false;
        delete reentrantTransferReturnData;
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256,
        uint256,
        address,
        uint256
    )
        external
        payable
        returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)
    {
        require(!failLiquidity, "Mock: liquidity failed");

        require(
            IERC20(token).transferFrom(
                msg.sender,
                address(this),
                amountTokenDesired
            ),
            "Mock: token transfer failed"
        );

        liquidityCalls++;
        lastLiquidityTokenAmount = amountTokenDesired;
        lastLiquidityEthAmount = msg.value;

        liquidity = returnZeroLiquidity ? 0 : 1;
        return (amountTokenDesired, msg.value, liquidity);
    }

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256,
        address[] calldata path,
        address to,
        uint256
    ) external {
        require(!failSwap, "Mock: swap failed");
        require(path.length == 2, "Mock: invalid path");
        require(to != address(0), "Mock: zero recipient");

        require(
            IERC20(path[0]).transferFrom(
                msg.sender,
                address(this),
                amountIn
            ),
            "Mock: token transfer failed"
        );

        swapCalls++;
        lastSwapAmount = amountIn;

        if (attemptReentrantTransfer) {
            (reentrantTransferSucceeded, reentrantTransferReturnData) = path[0].call(
                abi.encodeWithSelector(
                    IERC20.transfer.selector,
                    reentrantRecipient,
                    reentrantAmount
                )
            );
        }

        require(address(this).balance >= ethToReturn, "Mock: insufficient ETH");

        (bool success, ) = payable(to).call{value: ethToReturn}("");
        require(success, "Mock: ETH transfer failed");
    }
}

contract MockFalseReturnERC20 {
    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
}
