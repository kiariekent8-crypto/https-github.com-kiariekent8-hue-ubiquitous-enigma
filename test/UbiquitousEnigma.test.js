const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

describe("UbiquitousEnigma", function () {
  let token;
  let owner;
  let alice;
  let bob;

  const units = (value) => ethers.utils.parseEther(value);

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory(
      "MockUniswapV2Factory"
    );
    const factory = await Factory.deploy();
    await factory.deployed();

    const Router = await ethers.getContractFactory(
      "MockUniswapV2Router"
    );
    const router = await Router.deploy(factory.address);
    await router.deployed();

    const Token = await ethers.getContractFactory("UbiquitousEnigma");
    token = await Token.deploy(owner.address, router.address);
    await token.deployed();
  });

  it("mints the initial supply to the receiver", async function () {
    assert.equal(
      (await token.balanceOf(owner.address)).toString(),
      units("10000000").toString()
    );
    assert.equal(await token.owner(), owner.address);
    assert.equal(await token.symbol(), "UEG");
  });

  it("blocks ordinary transfers before trading is enabled", async function () {
    await token.transfer(alice.address, units("1000"));

    await assert.rejects(
      token.connect(alice).transfer(bob.address, units("100"))
    );
  });

  it("collects the 3% fee after trading is enabled", async function () {
    await token.transfer(alice.address, units("1000"));
    await token.enableTrading();

    await token.connect(alice).transfer(bob.address, units("100"));

    assert.equal(
      (await token.balanceOf(bob.address)).toString(),
      units("97").toString()
    );
    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("3").toString()
    );
  });

  it("restricts trading controls to the owner", async function () {
    await assert.rejects(token.connect(alice).enableTrading());
  });

  it("rejects liquidity fees above 10%", async function () {
    await assert.rejects(token.setLiquidityFee(11));
  });

  it("allows the owner to set a valid liquidity fee", async function () {
    await token.setLiquidityFee(5);
    assert.equal((await token.liquidityFee()).toString(), "5");
  });

  it("allows the owner to disable fees", async function () {
    await token.setLiquidityFee(0);
    await token.transfer(alice.address, units("100"));
    await token.enableTrading();

    await token.connect(alice).transfer(bob.address, units("10"));

    assert.equal(
      (await token.balanceOf(bob.address)).toString(),
      units("10").toString()
    );
  });

  it("does not charge fees to an excluded account", async function () {
    await token.transfer(alice.address, units("100"));
    await token.enableTrading();
    await token.excludeFromFee(alice.address, true);

    await token.connect(alice).transfer(bob.address, units("10"));

    assert.equal(
      (await token.balanceOf(bob.address)).toString(),
      units("10").toString()
    );
  });

  it("allows the owner to change the swap threshold", async function () {
    await token.setMinTokensBeforeSwap(units("100"));
    assert.equal(
      (await token.minTokensBeforeSwap()).toString(),
      units("100").toString()
    );
  });

  it("allows the owner to toggle automatic liquidity", async function () {
    await token.setSwapAndLiquifyEnabled(false);
    assert.equal(await token.swapAndLiquifyEnabled(), false);

    await token.setSwapAndLiquifyEnabled(true);
    assert.equal(await token.swapAndLiquifyEnabled(), true);
  });

  it("rejects non-owner administrative changes", async function () {
    await assert.rejects(
      token.connect(alice).setLiquidityFee(1)
    );
    await assert.rejects(
      token.connect(alice).setMinTokensBeforeSwap(1)
    );
    await assert.rejects(
      token.connect(alice).setSwapAndLiquifyEnabled(false)
    );
    await assert.rejects(
      token.connect(alice).excludeFromFee(bob.address, true)
    );
  });

  it("allows the owner to rescue ETH sent to the contract", async function () {
    const amount = units("1");

    await owner.sendTransaction({
      to: token.address,
      value: amount,
    });

    const before = await ethers.provider.getBalance(bob.address);
    await token.rescueETH(bob.address);
    const after = await ethers.provider.getBalance(bob.address);

    assert.equal(after.sub(before).toString(), amount.toString());
    assert.equal(
      (await ethers.provider.getBalance(token.address)).toString(),
      "0"
    );
  });

  it("rejects rescuing ETH to the zero address", async function () {
    await assert.rejects(
      token.rescueETH(ethers.constants.AddressZero),
      /zero address/
    );
  });

  it("reverts when rescuing an ERC-20 that returns false", async function () {
    const FalseReturnToken = await ethers.getContractFactory(
      "MockFalseReturnERC20"
    );
    const falseReturnToken = await FalseReturnToken.deploy();
    await falseReturnToken.deployed();

    await assert.rejects(
      token.rescueERC20(
        falseReturnToken.address,
        bob.address,
        units("1")
      )
    );
  });


  it("triggers a mock swap and liquidity operation at the threshold", async function () {
    const router = await ethers.getContractAt(
      "MockUniswapV2Router",
      await token.uniswapV2Router()
    );

    // The mock router needs ETH to simulate swap proceeds.
    await owner.sendTransaction({
      to: router.address,
      value: units("1"),
    });

    // The owner is fee-exempt, so Alice receives the full amount.
    await token.transfer(alice.address, units("1000000"));
    await token.enableTrading();

    // Collect 6,000 tokens in fees (3% of 200,000).
    await token.connect(alice).transfer(bob.address, units("200000"));

    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("6000").toString()
    );

    // This next transfer should trigger the swap before its own fee.
    await token.connect(alice).transfer(bob.address, units("1"));

    assert.equal((await router.swapCalls()).toString(), "1");
    assert.equal((await router.liquidityCalls()).toString(), "1");

    assert.equal(
      (await router.lastSwapAmount()).toString(),
      units("3000").toString()
    );

    assert.equal(
      (await router.lastLiquidityTokenAmount()).toString(),
      units("3000").toString()
    );

    assert.equal(
      (await router.lastLiquidityEthAmount()).toString(),
      units("0.01").toString()
    );
  });

  it("blocks a malicious router's nested token transfer during the swap", async function () {
    const router = await ethers.getContractAt(
      "MockUniswapV2Router",
      await token.uniswapV2Router()
    );

    await owner.sendTransaction({
      to: router.address,
      value: units("1"),
    });
    await token.transfer(alice.address, units("1000000"));
    await token.enableTrading();
    await token.connect(alice).transfer(bob.address, units("200000"));

    await router.configureReentrantTransfer(true, bob.address, 1);

    await token.connect(alice).transfer(bob.address, units("1"));

    assert.equal(await router.attemptReentrantTransfer(), true);
    assert.equal(await router.reentrantTransferSucceeded(), false);
    const revertReason = ethers.utils.defaultAbiCoder.decode(
      ["string"],
      `0x${(await router.reentrantTransferReturnData()).slice(10)}`
    )[0];
    assert.equal(revertReason, "Transfer during swap");
    assert.equal((await router.swapCalls()).toString(), "1");
    assert.equal((await router.liquidityCalls()).toString(), "1");
  });

  it("reverts when the router reports zero liquidity minted", async function () {
    const router = await ethers.getContractAt(
      "MockUniswapV2Router",
      await token.uniswapV2Router()
    );

    await owner.sendTransaction({
      to: router.address,
      value: units("1"),
    });
    await token.transfer(alice.address, units("1000000"));
    await token.enableTrading();
    await token.connect(alice).transfer(bob.address, units("200000"));

    await router.setReturnZeroLiquidity(true);

    await assert.rejects(
      token.connect(alice).transfer(bob.address, units("1")),
      /Liquidity not added/
    );

    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("6000").toString()
    );
    assert.equal((await router.swapCalls()).toString(), "0");
    assert.equal((await router.liquidityCalls()).toString(), "0");
  });


  it("swap fails and preserves accumulated tokens", async function () {
    const router = await ethers.getContractAt(
      "MockUniswapV2Router",
      await token.uniswapV2Router()
    );

    await owner.sendTransaction({
      to: router.address,
      value: units("1"),
    });

    await token.transfer(alice.address, units("1000000"));
    await token.enableTrading();

    // Accumulate 6,000 fee tokens.
    await token.connect(alice).transfer(bob.address, units("200000"));

    await router.setFailSwap(true);

    // The triggering transfer must revert atomically.
    await assert.rejects(
      token.connect(alice).transfer(bob.address, units("1"))
    );

    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("6000").toString()
    );
    assert.equal((await router.swapCalls()).toString(), "0");
    assert.equal((await router.liquidityCalls()).toString(), "0");
    assert.equal(
      (await ethers.provider.getBalance(token.address)).toString(),
      "0"
    );

    // Recover and retry.
    await router.setFailSwap(false);
    await token.connect(alice).transfer(bob.address, units("1"));

    assert.equal((await router.swapCalls()).toString(), "1");
    assert.equal((await router.liquidityCalls()).toString(), "1");
  });

  it("liquidity failure rolls back the entire swap", async function () {
    const router = await ethers.getContractAt(
      "MockUniswapV2Router",
      await token.uniswapV2Router()
    );

    await owner.sendTransaction({
      to: router.address,
      value: units("1"),
    });

    await token.transfer(alice.address, units("1000000"));
    await token.enableTrading();

    // Accumulate 6,000 fee tokens.
    await token.connect(alice).transfer(bob.address, units("200000"));

    await router.setFailLiquidity(true);

    // The swap happens first, but the later liquidity failure must
    // revert the whole transaction, including the earlier swap.
    await assert.rejects(
      token.connect(alice).transfer(bob.address, units("1"))
    );

    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("6000").toString()
    );
    assert.equal((await router.swapCalls()).toString(), "0");
    assert.equal((await router.liquidityCalls()).toString(), "0");
    assert.equal(
      (await ethers.provider.getBalance(token.address)).toString(),
      "0"
    );

    // Recover and retry.
    await router.setFailLiquidity(false);
    await token.connect(alice).transfer(bob.address, units("1"));

    assert.equal((await router.swapCalls()).toString(), "1");
    assert.equal((await router.liquidityCalls()).toString(), "1");
  });

  it("reverts safely when the router has insufficient ETH", async function () {
    const router = await ethers.getContractAt(
      "MockUniswapV2Router",
      await token.uniswapV2Router()
    );

    // Leave the router unfunded: it cannot return the required 0.01 ETH.
    await token.transfer(alice.address, units("1000000"));
    await token.enableTrading();

    // Accumulate 6,000 fee tokens.
    await token.connect(alice).transfer(bob.address, units("200000"));

    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("6000").toString()
    );

    // The swap should revert because the router has insufficient ETH.
    await assert.rejects(
      token.connect(alice).transfer(bob.address, units("1"))
    );

    // Verify the failed transaction was rolled back.
    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("6000").toString()
    );
    assert.equal((await router.swapCalls()).toString(), "0");
    assert.equal((await router.liquidityCalls()).toString(), "0");
    assert.equal(
      (await ethers.provider.getBalance(token.address)).toString(),
      "0"
    );

    // Fund the router and retry the triggering transfer.
    await owner.sendTransaction({
      to: router.address,
      value: units("1"),
    });

    await token.connect(alice).transfer(bob.address, units("1"));

    assert.equal((await router.swapCalls()).toString(), "1");
    assert.equal((await router.liquidityCalls()).toString(), "1");
  });

  it("handles a swap that returns zero ETH", async function () {
    const router = await ethers.getContractAt(
      "MockUniswapV2Router",
      await token.uniswapV2Router()
    );

    await token.transfer(alice.address, units("1000000"));
    await token.enableTrading();

    // Accumulate 6,000 fee tokens.
    await token.connect(alice).transfer(bob.address, units("200000"));

    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("6000").toString()
    );

    // Make the mock swap return zero ETH.
    await router.setEthToReturn(0);

    const tx = await token.connect(alice).transfer(bob.address, units("1"));
    const receipt = await tx.wait();

    // The swap succeeds, but liquidity addition is skipped.
    assert.equal((await router.swapCalls()).toString(), "1");
    assert.equal((await router.liquidityCalls()).toString(), "0");
    assert.equal(
      (await router.lastSwapAmount()).toString(),
      units("3000").toString()
    );

    // The swapped half goes to the router; the other half remains.
    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("3000.03").toString()
    );

    assert.equal(
      (await ethers.provider.getBalance(token.address)).toString(),
      "0"
    );

    // No SwapAndLiquify event should be emitted for zero ETH output.
    const swapEvents = receipt.logs
      .map((log) => {
        try {
          return token.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter((event) => event && event.name === "SwapAndLiquify");

    assert.equal(swapEvents.length, 0);
  });


  it("performs repeated automatic swaps after the threshold is reached again", async function () {
    const router = await ethers.getContractAt(
      "MockUniswapV2Router",
      await token.uniswapV2Router()
    );

    await token.transfer(alice.address, units("1000000"));
    await token.enableTrading();
    await router.setEthToReturn(0);

    // Accumulate 6,000 fee tokens.
    await token.connect(alice).transfer(bob.address, units("200000"));

    // First swap: 6,000 / 2 = 3,000 tokens.
    await token.connect(alice).transfer(bob.address, units("1"));

    assert.equal((await router.swapCalls()).toString(), "1");
    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("3000.03").toString()
    );

    // Add another 3,000 fee tokens. The threshold is crossed,
    // but this transfer checks the balance before collecting its fee.
    await token.connect(alice).transfer(bob.address, units("100000"));

    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("6000.03").toString()
    );
    assert.equal((await router.swapCalls()).toString(), "1");

    // The next transfer triggers the second swap.
    await token.connect(alice).transfer(bob.address, units("1"));

    assert.equal((await router.swapCalls()).toString(), "2");
    assert.equal(
      (await router.lastSwapAmount()).toString(),
      units("3000.015").toString()
    );
    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("3000.045").toString()
    );
  });

  it("accounts for fee-on-transfer tokens during swap and liquidity addition", async function () {
    const router = await ethers.getContractAt(
      "MockUniswapV2Router",
      await token.uniswapV2Router()
    );

    // Fund the mock router so the swap can return ETH.
    await owner.sendTransaction({
      to: router.address,
      value: ethers.utils.parseEther("1"),
    });

    await token.transfer(alice.address, units("1000000"));
    await token.enableTrading();

    // Collect 6,000 tokens in fees.
    await token.connect(alice).transfer(bob.address, units("200000"));

    // Trigger the swap and liquidity addition.
    await token.connect(alice).transfer(bob.address, units("1"));

    // Half is swapped and half is added to liquidity.
    assert.equal(
      (await router.lastSwapAmount()).toString(),
      units("3000").toString()
    );
    assert.equal((await router.swapCalls()).toString(), "1");
    assert.equal((await router.liquidityCalls()).toString(), "1");

    // The router receives 3,000 swapped tokens plus 3,000
    // liquidity tokens. Neither transfer incurs another fee.
    assert.equal(
      (await token.balanceOf(router.address)).toString(),
      units("6000").toString()
    );

    // The triggering transfer collects its own 0.03-token fee.
    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("0.03").toString()
    );

    // The ETH received from the swap is forwarded to liquidity.
    assert.equal(
      (await ethers.provider.getBalance(token.address)).toString(),
      "0"
    );
  });

  it("triggers a swap only on a transfer after the balance reaches the threshold", async function () {
    const router = await ethers.getContractAt(
      "MockUniswapV2Router",
      await token.uniswapV2Router()
    );

    await token.setMinTokensBeforeSwap(units("100"));
    await router.setEthToReturn(0);

    await token.transfer(alice.address, units("1000000"));
    await token.enableTrading();

    // Accumulate 60 + 30 + 12 = 102 fee tokens.
    await token.connect(alice).transfer(bob.address, units("2000"));
    await token.connect(alice).transfer(bob.address, units("1000"));
    await token.connect(alice).transfer(bob.address, units("400"));

    // The balance crossed 100 during the last transfer,
    // but the swap check happened before its fee was collected.
    assert.equal((await router.swapCalls()).toString(), "0");
    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("102").toString()
    );

    // This next eligible transfer triggers the swap.
    await token.connect(alice).transfer(bob.address, units("1"));

    assert.equal((await router.swapCalls()).toString(), "1");
    assert.equal(
      (await router.lastSwapAmount()).toString(),
      units("51").toString()
    );
    assert.equal(
      (await token.balanceOf(token.address)).toString(),
      units("51.03").toString()
    );
  });


});
