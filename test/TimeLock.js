const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { expandTo18Decimals } = require("./shared/utilities");

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

    return { apra, owner, funds, fees, timelock, alice, bob };
  }

  async function deployAndLockAlice1000() {
    const { apra, owner, funds, fees, timelock, alice, bob } = await deployTimeLock();

    const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
    await timelock.setIcoTimestamp(unlockTime);
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
      await expect(timelock.lockIcoTimestamp()).to.be.revertedWith(
        "TimeLock: ICO timestamp already locked"
      )
    });

    it("Lock ico timestamp without set time", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      expect(await timelock.isIcoLocked()).to.equal(false);
      await expect(timelock.lockIcoTimestamp()).to.be.revertedWith(
        "TimeLock: ICO timestamp not set"
      );
      expect(await timelock.isIcoLocked()).to.equal(false);
    });

    it("Set timestamp after locked", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      await timelock.lockIcoTimestamp();
      expect(await timelock.isIcoLocked()).to.equal(true);
      await expect(timelock.setIcoTimestamp(unlockTime)).to.be.revertedWith(
        "TimeLock: ICO timestamp locked"
      )
    });

  });

  describe("Ownership", function () {
    it("Set timestamp", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await expect(timelock.connect(alice).setIcoTimestamp(unlockTime)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    });

    it("Lock timestamp", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      await expect(timelock.connect(alice).lockIcoTimestamp()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    });

  });

  describe("Lock amount", function () {

    it("Available - ICO not set", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      await expect(timelock.available()).to.be.revertedWith(
        "TimeLock: ICO timestamp not set"
      );
    });

    it("Available - ICO not set - locker", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      await expect(timelock["available(address)"](alice.address)).to.be.revertedWith(
        "TimeLock: ICO timestamp not set"
      );
    });

    it("Available - no amount before ICO", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      await expect(timelock.available()).to.be.revertedWith(
        "TimeLock: no withdrawal before ICO"
      );
    });

    it("Available - timestamp is in the past", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) -2;
      await timelock.setIcoTimestamp(unlockTime);
      await expect(timelock.availableAt(await time.latest()-1)).to.be.revertedWith(
        "TimeLock: timestamp is in the past"
      );
    });


    it("Available - no amount locked", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      await timelock.setIcoTimestamp(unlockTime);
      await expect(timelock.availableAt(await time.latest() + ONE_YEAR_IN_SECS + 1)).to.be.revertedWith(
        "TimeLock: no amount locked"
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
      expect(result1[0]).equal(expandTo18Decimals(100));
      const result2 = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(result2[0]).equal(expandTo18Decimals(100));

      // We can increase the time in Hardhat Network
      await time.increaseTo(ONE_YEAR_IN_SECS + unlockTime);
      const result3 = await timelock["available(address)"](alice);
      expect(result3[0]).equal(expandTo18Decimals(100));
      const result4 = await timelock.connect(alice)["available()"]();
      expect(result4[0]).equal(expandTo18Decimals(100));

    });

    it("Lock - no amount", async function () {
      const { apra, owner, funds, fees, timelock, alice } = await loadFixture(deployTimeLock);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      //await timelock.setIcoTimestamp(unlockTime);
      await apra.connect(funds).approve(timelock, expandTo18Decimals(100));
      await expect(timelock.connect(funds).lockAmount(alice, expandTo18Decimals(0))).to.be.revertedWith(
        "TimeLock: amount must be greater than 0"
      )
    });
  });

  describe("Transfer lock", function () {
    it("Transfer", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      const beforeAlice = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeAlice[0]).equal(expandTo18Decimals(1000));
      await expect(timelock.connect(bob)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS)).to.be.revertedWith(
        'TimeLock: no amount locked'
      );
      await timelock.connect(alice).transfer(bob);
      await expect(timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS)).to.be.revertedWith(
        'TimeLock: no amount locked'
      );
      const afterBob = await timelock.connect(bob)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(afterBob[0]).equal(expandTo18Decimals(1000));
    });


    it("Transfer - already withdrawn", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      const beforeAlice = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeAlice[0]).equal(expandTo18Decimals(1000));
      await expect(timelock.connect(bob)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS)).to.be.revertedWith(
        'TimeLock: no amount locked'
      );
      await timelock.lockIcoTimestamp();
      await time.increaseTo(VESTING_IN_SECS + unlockTime);
      await timelock.connect(alice).withdraw();

      await expect(timelock.connect(alice).transfer(bob)).to.be.revertedWith(
        "TimeLock: nothing to transfer"
      );
    });

    it("Transfer to existing lock", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

      await apra.connect(funds).approve(timelock, expandTo18Decimals(1000));
      await timelock.connect(funds).lockAmount(bob, expandTo18Decimals(1000));

      const beforeAlice = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeAlice[0]).equal(expandTo18Decimals(1000));
      const beforeBob = await timelock.connect(bob)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeBob[0]).equal(expandTo18Decimals(1000));
      
      await timelock.connect(alice).transfer(bob);
      await expect(timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS)).to.be.revertedWith(
        'TimeLock: no amount locked'
      );
      const afterBob = await timelock.connect(bob)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(afterBob[0]).equal(expandTo18Decimals(2000));
    });


  });

  describe("Withdraw - not locked", function () {
    it("Transfer", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      const beforeAlice = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeAlice[0]).equal(expandTo18Decimals(1000));
      
      await time.increaseTo(VESTING_IN_SECS + unlockTime);
      await expect(timelock.connect(alice).withdraw()).to.be.revertedWith(
        "TimeLock: ICO timestamp not locked"
      );
    });

  });

  describe("Withdraw", function () {
    it("Withdraw - not locked", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      const beforeAlice = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeAlice[0]).equal(expandTo18Decimals(1000));
      
      await time.increaseTo(VESTING_IN_SECS + unlockTime);
      await expect(timelock.connect(alice).withdraw()).to.be.revertedWith(
        "TimeLock: ICO timestamp not locked"
      );
    });

    it("Withdraw", async function () {
      const { apra, owner, funds, fees, timelock, alice, bob } = await loadFixture(deployAndLockAlice1000);
      const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
      const beforeAlice = await timelock.connect(alice)["availableAt(uint256)"](unlockTime + VESTING_IN_SECS);
      expect(beforeAlice[0]).equal(expandTo18Decimals(1000));
      
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
      expect(beforeAlice[0]).equal(expandTo18Decimals(1000));
      
      await time.increaseTo(VESTING_IN_SECS + unlockTime);
      await timelock.lockIcoTimestamp();
      await expect(timelock.connect(alice).withdraw()).to.changeTokenBalances(
        apra,
        [fees, timelock, alice],
        [expandTo18Decimals(0), expandTo18Decimals(-1000), expandTo18Decimals(1000)]
      );
      await expect(timelock.connect(alice).withdraw()).to.be.revertedWith(
        "TimeLock: nothing to withdraw"
      );
    });

  });

    
});
