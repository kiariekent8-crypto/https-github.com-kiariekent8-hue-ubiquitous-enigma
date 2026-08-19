// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IUniswapV2Factory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
}
interface IUniswapV2Router02 {
    function factory() external view returns (address);
    function WETH() external view returns (address);
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline
    ) external;
}

contract UbiquitousEnigma is ERC20, Ownable {
    IUniswapV2Router02 public uniswapV2Router;
    address public uniswapV2Pair;

    bool private inSwapAndLiquify;
    bool public swapAndLiquifyEnabled = true;
    bool public tradingEnabled = false;

    uint256 public liquidityFee = 3; // percent
    uint256 public minTokensBeforeSwap = 5_000 * 10 ** 18; // default threshold

    mapping(address => bool) private _isExcludedFromFee;

    event SwapAndLiquify(uint256 tokensSwapped, uint256 ethReceived, uint256 tokensIntoLiquidity);
    event TradingEnabled();
    event ExcludeFromFee(address account, bool excluded);
    event SetLiquidityFee(uint256 fee);
    event SetMinTokensBeforeSwap(uint256 minTokens);
    event SetSwapAndLiquifyEnabled(bool enabled);
    event RescueETH(address to, uint256 amount);
    event RescueERC20(address token, address to, uint256 amount);

    modifier lockTheSwap {
        inSwapAndLiquify = true;
        _;
        inSwapAndLiquify = false;
    }

    constructor(address initialReceiver, address routerAddress) ERC20("UbiquitousEnigma", "UEG") {
        require(initialReceiver != address(0), "initialReceiver 0");
        require(routerAddress != address(0), "router 0");

        uint256 initialSupply = 10_000_000 * 10 ** decimals();
        _mint(initialReceiver, initialSupply);

        uniswapV2Router = IUniswapV2Router02(routerAddress);
        uniswapV2Pair = IUniswapV2Factory(uniswapV2Router.factory()).createPair(address(this), uniswapV2Router.WETH());

        // Exclude owner and contract from fee
        _isExcludedFromFee[owner()] = true;
        _isExcludedFromFee[address(this)] = true;
    }

    // -- Owner controls --

    function enableTrading() external onlyOwner {
        tradingEnabled = true;
        emit TradingEnabled();
    }

    function setLiquidityFee(uint256 feePercent) external onlyOwner {
        require(feePercent <= 10, "fee too high");
        liquidityFee = feePercent;
        emit SetLiquidityFee(feePercent);
    }

    function setMinTokensBeforeSwap(uint256 minTokens) external onlyOwner {
        minTokensBeforeSwap = minTokens;
        emit SetMinTokensBeforeSwap(minTokens);
    }

    function setSwapAndLiquifyEnabled(bool _enabled) external onlyOwner {
        swapAndLiquifyEnabled = _enabled;
        emit SetSwapAndLiquifyEnabled(_enabled);
    }

    function excludeFromFee(address account, bool excluded) external onlyOwner {
        _isExcludedFromFee[account] = excluded;
        emit ExcludeFromFee(account, excluded);
    }

    function rescueETH(address to) external onlyOwner {
        uint256 balance = address(this).balance;
        payable(to).transfer(balance);
        emit RescueETH(to, balance);
    }

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).transfer(to, amount);
        emit RescueERC20(token, to, amount);
    }

    receive() external payable {}

    // -- Transfer override with fee & auto-liquidity --

    function _transfer(address from, address to, uint256 amount) internal override {
        require(from != address(0) && to != address(0), "zero addr");
        if (!tradingEnabled) {
            // Allow minting and owner transfers before trading enabled
            if (from != owner() && to != owner() && from != address(0)) {
                revert("Trading is not enabled");
            }
        }

        uint256 contractTokenBalance = balanceOf(address(this));

        // If threshold reached and it's not already swapping, and this is not a buy (from pair),
        // perform swapAndLiquify to add liquidity.
        if (
            contractTokenBalance >= minTokensBeforeSwap &&
            contractTokenBalance > 0 &&
            !inSwapAndLiquify &&
            from != uniswapV2Pair &&
            swapAndLiquifyEnabled
        ) {
            // use exactly contractTokenBalance (or a configurable cap)
            swapAndLiquify(contractTokenBalance);
        }

        bool takeFee = !_isExcludedFromFee[from] && !_isExcludedFromFee[to] && liquidityFee > 0;

        if (takeFee) {
            uint256 feeAmount = (amount * liquidityFee) / 100;
            super._transfer(from, address(this), feeAmount); // collect fee in contract
            amount = amount - feeAmount;
        }

        super._transfer(from, to, amount);
    }

    function swapAndLiquify(uint256 contractTokenBalance) private lockTheSwap {
        // split the contractTokenBalance into halves
        uint256 half = contractTokenBalance / 2;
        uint256 otherHalf = contractTokenBalance - half;

        uint256 initialBalance = address(this).balance;

        // swap half for ETH
        swapTokensForEth(half);

        uint256 newBalance = address(this).balance - initialBalance;

        // add liquidity to Uniswap
        if (newBalance > 0 && otherHalf > 0) {
            addLiquidity(otherHalf, newBalance);
            emit SwapAndLiquify(half, newBalance, otherHalf);
        }
    }

    function swapTokensForEth(uint256 tokenAmount) private {
        // generate the uniswap pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapV2Router.WETH();

        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // make the swap
        uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0, // accept any amount of ETH
            path,
            address(this),
            block.timestamp
        );
    }

    function addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        _approve(address(this), address(uniswapV2Router), tokenAmount);
        uniswapV2Router.addLiquidityETH{value: ethAmount}(
            address(this),
            tokenAmount,
            0,
            0,
            owner(),
            block.timestamp
        );
    }
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}
