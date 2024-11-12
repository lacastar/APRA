const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { expandTo18Decimals, ZERO_ADDRESS } = require("./shared/utilities");

const ApraModule = require("../ignition/modules/Apra");
const TimeLockModule = require("../ignition/modules/TimeLock");

const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
const THIRTY_DAYS_IN_SECS = 30 * 24 * 60 * 60;
const VESTING_IN_SECS = 6 * THIRTY_DAYS_IN_SECS;


describe("TimeLock", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployTimeLock() {
    const [owner, funds, fees, alice, bob] = await ethers.getSigners();
    const parameters = {
      apra: {
        fees: fees.address,
        funds: funds.address
      }
    }
    const { apra } = await ignition.deploy(ApraModule,
      {
        defaultSender: owner.address,
        parameters
      }
    );
    
    const { timelock } = await ignition.deploy(TimeLockModule, {
      defaultSender: owner.address,
      parameters: { timelock: { apra: await apra.getAddress() } }
    },
    );

    await apra.excludeFromFee(timelock);
    await timelock.setAccountAsLocker(funds.address);

    return { apra, owner, funds, fees, timelock, alice, bob };
  }

  async function deployAndLockAlice1000() {
    const { apra, owner, funds, fees, timelock, alice, bob } = await deployTimeLock();

    const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
    await timelock.setIcoTimestamp(unlockTime);
    await timelock.setAccountAsLocker(funds.address);
    await apra.connect(funds).approve(timelock, expandTo18Decimals(1000));
    await timelock.connect(funds).lockAmount(alice, expandTo18Decimals(1000));

    return { apra, owner, funds, fees, timelock, alice, bob };
  }

  describe("Deployment", function () {

    it("Init", async function () {
      const { apra, owner, funds, fees, timelock } = await loadFixture(deployTimeLock);
      expect(await timelock.isIcoLocked()).to.equal(false);
      expect(await timelock.getIcoTimestamp()).to.equal(0);
      expect(await timelock.owner()).to.equal(owner);
    });

    it("Set timestamp", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      expect(await timelock.isIcoLocked()).to.equal(false);
      expect(await timelock.getIcoTimestamp()).to.equal(unlockTime);
      await timelock.setIcoTimestamp(ONE_YEAR_IN_SECS);
      expect(await timelock.getIcoTimestamp()).to.equal(ONE_YEAR_IN_SECS);
    });

    it("Lock ico timestamp", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      expect(await timelock.isIcoLocked()).to.equal(false);
      expect(await timelock.getIcoTimestamp()).to.equal(unlockTime);
      await timelock.lockIcoTimestamp();
      expect(await timelock.isIcoLocked()).to.equal(true);
      await expect(timelock.lockIcoTimestamp()).to.be.revertedWithCustomError(
        timelock,
        "ICOTimestampLocked"
      );
    });

    it("Lock ico timestamp without set time", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      expect(await timelock.isIcoLocked()).to.equal(false);
      await expect(timelock.lockIcoTimestamp()).to.be.revertedWithCustomError(
        timelock,
        "ICOTimestampNotSet"
      );
      expect(await timelock.isIcoLocked()).to.equal(false);
    });

    it("Set timestamp after locked", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      await timelock.lockIcoTimestamp();
      expect(await timelock.isIcoLocked()).to.equal(true);
      await expect(timelock.setIcoTimestamp(unlockTime)).to.be.revertedWithCustomError(
        timelock,
        "ICOTimestampLocked"
      );
    });

    it("Timelock not excluded from fee", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      await apra.connect(funds).approve(timelock, expandTo18Decimals(100));
      await apra.includeInFee(timelock);
      await expect(timelock.connect(funds).lockAmount(alice, expandTo18Decimals(100))).to.be.revertedWithCustomError(
        timelock,
        "TimeLockNotExcludedFromFee"
      );
    });
  });

  describe("Ownership", function () {
    it("Set timestamp", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await expect(timelock.connect(alice).setIcoTimestamp(unlockTime)).to.be.revertedWithCustomError(
        timelock,
        "CallerIsNotTheOwner"
      );
    });

    it("Lock timestamp", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      await expect(timelock.connect(alice).lockIcoTimestamp()).to.be.revertedWithCustomError(
        timelock,
        "CallerIsNotTheOwner"
      );
    });

    it("Set locker", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      await expect(timelock.connect(alice).setAccountAsLocker(alice)).to.be.revertedWithCustomError(
        timelock,
        "CallerIsNotTheOwner"
      );
    });

    it("Remove locker", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      await expect(timelock.connect(alice).removeAccountFromLockers(alice)).to.be.revertedWithCustomError(
        timelock,
        "CallerIsNotTheOwner"
      );
    });
    
  });

  describe("Lock amount", function () {

    it("Available - ICO not set", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      await expect(timelock.available()).to.be.revertedWithCustomError(
        timelock,
        "ICOTimestampNotSet"
      );
    });

    it("Available - ICO not set - locker", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      await expect(timelock["available(address)"](alice.address)).to.be.revertedWithCustomError(
        timelock,
        "ICOTimestampNotSet"
      );
    });

    it("Available - no amount before ICO", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      await expect(timelock.available()).to.be.revertedWithCustomError(
        timelock,
        "NoWithdrawalBeforeICO"
      );
    });

    it("Available - timestamp is in the past", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) -2;
      await timelock.setIcoTimestamp(unlockTime);
      await expect(timelock.availableAt(await time.latest()-1)).to.be.revertedWithCustomError(
        timelock,
        "TimestampIsInThePast"
      );
    });


    it("Available - no amount locked", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      await expect(timelock.availableAt(await time.latest() + ONE_YEAR_IN_SECS + 1)).to.be.revertedWithCustomError(
        timelock,
        "NoAmountLocked"
      );
    });


    it("Available - lock amount", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      await apra.connect(funds).approve(timelock, expandTo18Decimals(100));
      await expect(timelock.connect(funds).lockAmount(alice, expandTo18Decimals(100))).to.changeTokenBalances(
        apra,
        [funds, fees, timelock, alice],
        [expandTo18Decimals(-100), expandTo18Decimals(0), expandTo18Decimals(100), 0]
      );
      const result1 = await timelock["availableAt(address,uint256)"](alice, unlockTime + VESTING_IN_SECS);
      expect(result1).equal(expandTo18Decimals(100));
      const result2 = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(result2).equal(expandTo18Decimals(100));

      // We can increase the time in Hardhat Network
      await time.increaseTo(ONE_YEAR_IN_SECS + unlockTime);
      const result3 = await timelock["available(address)"](alice);
      expect(result3).equal(expandTo18Decimals(100));
      const result4 = await timelock.connect(alice)["available()"]();
      expect(result4).equal(expandTo18Decimals(100));

    });

    it("Lock - no amount", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      //await timelock.setIcoTimestamp(unlockTime);
      await apra.connect(funds).approve(timelock, expandTo18Decimals(100));
      await expect(timelock.connect(funds).lockAmount(alice, expandTo18Decimals(0))).to.be.revertedWithCustomError(
        timelock,
        "AmountMustBeGreaterThan0"
      );
    });

    it("Lock - zero address", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      await apra.connect(funds).approve(timelock, expandTo18Decimals(100));
      await expect(timelock.connect(funds).lockAmount(ZERO_ADDRESS, expandTo18Decimals(10))).to.be.revertedWithCustomError(
        timelock,
        "LockFor0Address"
      );
    });


    it("Lock - not locker", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      //await timelock.setIcoTimestamp(unlockTime);
      await apra.connect(funds).approve(timelock, expandTo18Decimals(100));
      await timelock.connect(owner).removeAccountFromLockers(funds);
      await expect(timelock.connect(funds).lockAmount(alice, expandTo18Decimals(10))).to.be.revertedWithCustomError(
        timelock,
        "SenderCantLock"
      );
    });

    it("Lock - ICO started", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      await apra.connect(funds).approve(timelock, expandTo18Decimals(100));
      await time.increaseTo(ONE_YEAR_IN_SECS + unlockTime);
      await expect(timelock.connect(funds).lockAmount(alice, expandTo18Decimals(10))).to.be.revertedWithCustomError(
        timelock,
        "ICOStarted"
      );
    });
  });

  describe("Can lock", function () {
    it("Can lock", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const canlock = await timelock.canLock(funds);
      expect(canlock) 
      const canlockAlice = await timelock.canLock(alice);
      expect(!canlockAlice) 
      await timelock.removeAccountFromLockers(funds);
      const canlockFalse = await timelock.canLock(funds);
      expect(!canlockFalse) 
      
    });
  });

  describe("Transfer lock", function () {
    it("Transfer", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      const beforeAlice = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeAlice).equal(expandTo18Decimals(1000));
      await expect(timelock.connect(bob)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS)).to.be.revertedWithCustomError(
        timelock,
        "NoAmountLocked"
      );
      await expect(timelock.connect(alice).transfer(alice)).to.be.revertedWithCustomError(
        timelock,
        "SelfTransferNotAllowed"
      ) 
      await timelock.connect(alice).transfer(bob);
      await expect(timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS)).to.be.revertedWithCustomError(
        timelock,
        "NoAmountLocked"
      );
      const afterBob = await timelock.connect(bob)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(afterBob).equal(expandTo18Decimals(1000));
    });


    it("Transfer - already withdrawn", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      const beforeAlice = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeAlice).equal(expandTo18Decimals(1000));
      await expect(timelock.connect(bob)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS)).to.be.revertedWithCustomError(
        timelock,
        "NoAmountLocked"
      );
      await timelock.lockIcoTimestamp();
      await time.increaseTo(VESTING_IN_SECS + unlockTime);
      await timelock.connect(alice).withdraw();

      await expect(timelock.connect(alice).transfer(bob)).to.be.revertedWithCustomError(
        timelock,
        "NothingToTransfer"
      );
    });

    it("Transfer to existing lock", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

      await apra.connect(funds).approve(timelock, expandTo18Decimals(1000));
      await timelock.connect(funds).lockAmount(bob, expandTo18Decimals(1000));

      const beforeAlice = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeAlice).equal(expandTo18Decimals(1000));
      const beforeBob = await timelock.connect(bob)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeBob).equal(expandTo18Decimals(1000));
      
      await timelock.connect(alice).transfer(bob);
      await expect(timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS)).to.be.revertedWithCustomError(
        timelock,
        "NoAmountLocked"
      );
      const afterBob = await timelock.connect(bob)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(afterBob).equal(expandTo18Decimals(2000));
    });


  });

  describe("Withdraw - not locked", function () {
    it("Transfer", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      const beforeAlice = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeAlice).equal(expandTo18Decimals(1000));
      
      await time.increaseTo(VESTING_IN_SECS + unlockTime);
      await expect(timelock.connect(alice).withdraw()).to.be.revertedWithCustomError(
        timelock,
        "ICOTimestampNotLocked"
      );
    });

  });

  describe("Withdraw", function () {
    it("Withdraw - not locked", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      const beforeAlice = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeAlice).equal(expandTo18Decimals(1000));
      
      await time.increaseTo(VESTING_IN_SECS + unlockTime);
      await expect(timelock.connect(alice).withdraw()).to.be.revertedWithCustomError(
        timelock,
        "ICOTimestampNotLocked"
      );
    });

    it("Withdraw", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      const beforeAlice = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeAlice).equal(expandTo18Decimals(1000));
      
      await time.increaseTo(VESTING_IN_SECS + unlockTime);
      await timelock.lockIcoTimestamp();
      await expect(timelock.connect(alice).withdraw()).to.changeTokenBalances(
        apra,
        [fees, timelock, alice],
        [expandTo18Decimals(0), expandTo18Decimals(-1000), expandTo18Decimals(1000)]
      );
    });

    it("Withdraw - nothing to withdraw", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      const beforeAlice = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeAlice).equal(expandTo18Decimals(1000));
      
      await time.increaseTo(VESTING_IN_SECS + unlockTime);
      await timelock.lockIcoTimestamp();
      await expect(timelock.connect(alice).withdraw()).to.changeTokenBalances(
        apra,
        [fees, timelock, alice],
        [expandTo18Decimals(0), expandTo18Decimals(-1000), expandTo18Decimals(1000)]
      );
      await expect(timelock.connect(alice).withdraw()).to.be.revertedWithCustomError(
        timelock,
        "NothingToWithdraw"
      );
    });

  });

    
});
