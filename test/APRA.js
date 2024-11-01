const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { expandTo18Decimals } = require("./shared/utilities");

const ApraModule = require("../ignition/modules/Apra");

describe("APRA", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployApra() {
    /*
    //const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    //const ONE_GWEI = 1_000_000_000;

    //const lockedAmount = ONE_GWEI;
    //const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

    // Contracts are deployed using the first signer/account by default
    const [owner, funds, fees] = await ethers.getSigners();

    const Apra = await ethers.getContractFactory("APRA");
    //const lock = await Lock.deploy(unlockTime, { value: lockedAmount });
    const apra = await Apra.deploy(funds.address, fees.address);

    */
    const [owner, funds, fees] = await ethers.getSigners();
    const parameters = {
      apra: {
          fees: fees.address,
          funds: funds.address
      }
   }
    const {apra} = await ignition.deploy(ApraModule,
      {
        defaultSender: owner.address,
        parameters
      }
    );

    console.log("apra deployed: " + apra.address)

    return { apra, owner, funds, fees };
  }

  describe("Deployment", function () {

    it("Total supply is: 1_000_000_000", async function () {
      const { apra, owner, funds, fees } = await loadFixture(deployApra);
      expect(await apra.totalSupply()).to.equal(expandTo18Decimals(1_000_000_000));
    });

    it("Funds wallet should have all the funds", async function () {
      const { apra, owner, funds, fees } = await loadFixture(deployApra);

      //expect(await lock.unlockTime()).to.equal(unlockTime);
      expect(await apra.balanceOf(funds.address)).to.equal(expandTo18Decimals(1_000_000_000));
    });

    it("Should set the right owner", async function () {
      const { apra, owner, funds, fees } = await loadFixture(deployApra);

      expect(await apra.owner()).to.equal(owner.address);
    });

    it("Should set the right symbol", async function () {
      const { apra, owner, funds, fees } = await loadFixture(deployApra);

      expect(await apra.symbol()).to.equal("APRA");
    });

    it("Should set the right name", async function () {
      const { apra, owner, funds, fees } = await loadFixture(deployApra);

      expect(await apra.name()).to.equal("Apraemio");
    });

    it("Token fee should be 1 (%)", async function () {
      const { apra, owner, funds, fees } = await loadFixture(deployApra);

      expect(await apra.tokenFee()).to.equal(1);
    });

    it("Should have 18 decimals", async function () {
      const { apra, owner, funds, fees } = await loadFixture(deployApra);

      expect(await apra.decimals()).to.equal(18);
    });

    
/*
    it("Should receive and store the funds to lock", async function () {
      const { lock, lockedAmount } = await loadFixture(
        deployOneYearLockFixture
      );

      expect(await ethers.provider.getBalance(lock.target)).to.equal(
        lockedAmount
      );
    });

    it("Should fail if the unlockTime is not in the future", async function () {
      // We don't use the fixture here because we want a different deployment
      const latestTime = await time.latest();
      const Lock = await ethers.getContractFactory("Lock");
      await expect(Lock.deploy(latestTime, { value: 1 })).to.be.revertedWith(
        "Unlock time should be in the future"
      );
    });
    */
  });

  /*
  describe("Withdrawals", function () {
    describe("Validations", function () {
      it("Should revert with the right error if called too soon", async function () {
        const { lock } = await loadFixture(deployOneYearLockFixture);

        await expect(lock.withdraw()).to.be.revertedWith(
          "You can't withdraw yet"
        );
      });

      it("Should revert with the right error if called from another account", async function () {
        const { lock, unlockTime, otherAccount } = await loadFixture(
          deployOneYearLockFixture
        );

        // We can increase the time in Hardhat Network
        await time.increaseTo(unlockTime);

        // We use lock.connect() to send a transaction from another account
        await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
          "You aren't the owner"
        );
      });

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
        const { lock, unlockTime } = await loadFixture(
          deployOneYearLockFixture
        );

        // Transactions are sent using the first signer by default
        await time.increaseTo(unlockTime);

        await expect(lock.withdraw()).not.to.be.reverted;
      });
    });

    describe("Events", function () {
      it("Should emit an event on withdrawals", async function () {
        const { lock, unlockTime, lockedAmount } = await loadFixture(
          deployOneYearLockFixture
        );

        await time.increaseTo(unlockTime);

        await expect(lock.withdraw())
          .to.emit(lock, "Withdrawal")
          .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
      });
    });

    describe("Transfers", function () {
      it("Should transfer the funds to the owner", async function () {
        const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
          deployOneYearLockFixture
        );

        await time.increaseTo(unlockTime);

        await expect(lock.withdraw()).to.changeEtherBalances(
          [owner, lock],
          [lockedAmount, -lockedAmount]
        );
      });
    });
  });*/
});
