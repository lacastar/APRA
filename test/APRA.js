const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { expandTo18Decimals, ZERO_ADDRESS } = require("./shared/utilities");

const ApraModule = require("../ignition/modules/Apra");

describe("APRA", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployApra() {
   
    const [owner, funds, fees, alice, bob, cat] = await ethers.getSigners();
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

    
    return { apra, owner, funds, fees, alice, bob };
  }

  async function alice1000NoFees() {
    const { apra, owner, funds, fees, alice, bob }  = await deployApra();
    await apra.setTakeFee(false);
    await apra.connect(funds).transfer(alice, expandTo18Decimals(1000));
    return  { apra, owner, funds, fees, alice, bob }
  }

  async function alice1000() {
    const { apra, owner, funds, fees, alice, bob }  = await deployApra();
    await apra.excludeFromFee(funds);
    await apra.connect(funds).transfer(alice, expandTo18Decimals(1000));
    return  { apra, owner, funds, fees, alice, bob }
  }

  describe("Deployment", function () {

    it("Total supply is: 1_000_000_000", async function () {
      const { apra, owner, funds, fees } = await loadFixture(deployApra);
      expect(await apra.totalSupply()).to.equal(expandTo18Decimals(1_000_000_000));
    });

    it("Funds wallet should have all the funds", async function () {
      const { apra, owner, funds, fees } = await loadFixture(deployApra);

      expect(await apra.balanceOf(funds.address)).to.equal(expandTo18Decimals(1_000_000_000));
      expect(await apra.balanceOf(fees.address)).to.equal(0);
      expect(await apra.balanceOf(owner.address)).to.equal(0);
    });

    it("Should set the right owner", async function () {
      const { apra, owner, funds, fees } = await loadFixture(deployApra);

      expect(await apra.owner()).to.equal(owner.address);
      expect(await apra.getOwner()).to.equal(owner.address);
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
  });


  describe("Transfers and allowance", function () {

    it("Transfer 100 from Alice to Bob", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);
      await apra.connect(alice).transfer(bob, expandTo18Decimals(100));
      expect(await apra.balanceOf(bob.address)).to.equal(expandTo18Decimals(100));
      expect(await apra.balanceOf(alice.address)).to.equal(expandTo18Decimals(900));
    });


    it("Insufficient amount to transfer", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);

      await expect(apra.connect(bob).transfer(alice, expandTo18Decimals(100))).to.be.revertedWithCustomError(
        apra,
        'TransferAmountExceedsBalance'
      );
    });

    it("Insufficient amount to transfer", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);

      await expect(apra.connect(alice).transfer(ZERO_ADDRESS, expandTo18Decimals(100))).to.be.revertedWithCustomError(
        apra,
        'TransferToTheZeroAddress'
      );
    });

    it("Allowance to 0x0 address", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);

      await expect(apra.connect(alice).approve(ZERO_ADDRESS, expandTo18Decimals(100))).to.be.revertedWithCustomError(
        apra,
        'ApproveToTheZeroAddress'
      );
    });


    it("Bob transfer 100 from funds to Alice ", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);
      await apra.connect(funds).approve(bob, expandTo18Decimals(100));
      expect(await apra.allowance(funds, bob)).to.equal(expandTo18Decimals(100));

      await expect(apra.connect(bob).transferFrom(funds, alice, expandTo18Decimals(100))).to.changeTokenBalances(
        apra,
        [funds, alice],
        [expandTo18Decimals(-100), expandTo18Decimals(100)]
      );
    });

    it("Try to transfer more than actual allowance", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);
      await apra.connect(funds).approve(bob, expandTo18Decimals(100));
      expect(await apra.allowance(funds, bob)).to.equal(expandTo18Decimals(100));

      await expect(apra.connect(bob).transferFrom(funds, alice, expandTo18Decimals(110))).to.be.revertedWithCustomError(
        apra,
        'TransferAmountExceedsAllowance'
      );
    });

    it("Change allowance", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);
      await apra.connect(funds).approve(bob, expandTo18Decimals(100));
      expect(await apra.allowance(funds, bob)).to.equal(expandTo18Decimals(100));
      await apra.connect(funds).approve(bob, expandTo18Decimals(1000));
      expect(await apra.allowance(funds, bob)).to.equal(expandTo18Decimals(1000));
    });

    it("Increase allowance", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);
      await apra.connect(funds).approve(bob, expandTo18Decimals(100));
      expect(await apra.allowance(funds, bob)).to.equal(expandTo18Decimals(100));
      await apra.connect(funds).increaseAllowance(bob, expandTo18Decimals(1000));
      expect(await apra.allowance(funds, bob)).to.equal(expandTo18Decimals(1100));
    });

    it("Decrease allowance", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);
      await apra.connect(funds).approve(bob, expandTo18Decimals(100));
      expect(await apra.allowance(funds, bob)).to.equal(expandTo18Decimals(100));
      await apra.connect(funds).decreaseAllowance(bob, expandTo18Decimals(50));
      expect(await apra.allowance(funds, bob)).to.equal(expandTo18Decimals(50));

      await expect(apra.connect(funds).decreaseAllowance(bob, expandTo18Decimals(100))).to.be.revertedWithCustomError(
        apra,
        'DecreasedAllowanceBelowZero'
      );
    });

  });

  describe("Burning", function () {

    it("Burn", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);
      await apra.connect(alice).burn(expandTo18Decimals(100));
      expect(await apra.balanceOf(alice.address)).to.equal(expandTo18Decimals(900));
      expect(await apra.totalSupply()).to.equal(expandTo18Decimals(999_999_900))
    });

    it("Burn from ", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);
      await apra.connect(funds).approve(bob, expandTo18Decimals(100));
      expect(await apra.allowance(funds, bob)).to.equal(expandTo18Decimals(100));

      await expect(apra.connect(bob).burnFrom(funds, expandTo18Decimals(100))).to.changeTokenBalances(
        apra,
        [funds],
        [expandTo18Decimals(-100)]
      );
      expect(await apra.totalSupply()).to.equal(expandTo18Decimals(999_999_900))
    });

    it("Burn more than balance", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);
      await expect(apra.connect(alice).burn(expandTo18Decimals(1100))).to.be.revertedWithCustomError(
        apra,
        'BurnAmountExceedsBalance'
      );
    });

    it("Burn more than allowance", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);
      await apra.connect(funds).approve(bob, expandTo18Decimals(100));
      expect(await apra.allowance(funds, bob)).to.equal(expandTo18Decimals(100));

      await expect(apra.connect(bob).burnFrom(funds, expandTo18Decimals(1000))).to.be.revertedWithCustomError(
        apra,
        'BurnAmountExceedsAllowance'
      );
    });

  });


  describe("Fees", function () {

    it("Taking fees for transfers", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000);
      expect(await apra.connect(alice).transfer(bob,expandTo18Decimals(100))).to.changeTokenBalances(
        apra,
        [alice, bob, fees],
        [expandTo18Decimals(-100), expandTo18Decimals(99), expandTo18Decimals(1)]
      );
    });

    it("Taking fees for transferFrom", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000);
      await apra.connect(funds).approve(bob, expandTo18Decimals(100));
      expect(await apra.connect(bob).transferFrom(funds, alice, expandTo18Decimals(100))).to.changeTokenBalances(
        apra,
        [funds, alice, fees],
        [expandTo18Decimals(-100), expandTo18Decimals(99), expandTo18Decimals(1)]
      );
    });

    it("Omit fees", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000);
      expect(await apra.isExcludedFromFee(bob)).to.equal(false);
      await apra.excludeFromFee(bob);
      expect(await apra.isExcludedFromFee(bob)).to.equal(true);
      expect(await apra.connect(alice).transfer(bob, expandTo18Decimals(100))).to.changeTokenBalances(
        apra,
        [alice, bob],
        [expandTo18Decimals(-100), expandTo18Decimals(100)]
      );
      
      await apra.includeInFee(bob);
      expect(await apra.isExcludedFromFee(bob)).to.equal(false);
      expect(await apra.connect(alice).transfer(bob, expandTo18Decimals(100))).to.changeTokenBalances(
        apra,
        [alice, bob, fees],
        [expandTo18Decimals(-100), expandTo18Decimals(99), expandTo18Decimals(1)]
      );

      expect(await apra.isExcludedFromFee(alice)).to.equal(false);
      await apra.excludeFromFee(alice);
      expect(await apra.isExcludedFromFee(alice)).to.equal(true);
      expect(await apra.connect(alice).transfer(bob, expandTo18Decimals(100))).to.changeTokenBalances(
        apra,
        [alice, bob, fees],
        [expandTo18Decimals(-100), expandTo18Decimals(100), 0]
      );
    });

    it("Change fee wallet", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);
      await apra.changeFeeWallet(owner);
      expect(await apra.connect(alice).transfer(bob, expandTo18Decimals(100))).to.changeTokenBalances(
        apra,
        [alice, bob, owner, fees],
        [expandTo18Decimals(-100), expandTo18Decimals(99), expandTo18Decimals(1), 0]
      );
    });
    
    it("Change fee wallet to 0x0", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);
      await expect(apra.changeFeeWallet(ZERO_ADDRESS)).to.be.revertedWithCustomError(
        apra,
        'NewFeeWallerIsTheZeroAddress'
      );
    });

    it("Change take fee to current value", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(alice1000NoFees);
      await expect(apra.setTakeFee(false)).to.be.revertedWithCustomError(
        apra,
        'TakingFeeIsAlreadySet'
      );
    });

  });

  describe("Ownership", function () {
    it("Change fee wallet", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(deployApra);
      await expect(apra.connect(bob).changeFeeWallet(funds)).to.be.revertedWithCustomError(
        apra,
        'OwnableUnauthorizedAccount'
      );
    })
    it("Set take fee", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(deployApra);
      await expect(apra.connect(bob).setTakeFee(true)).to.be.revertedWithCustomError(
        apra,
        'OwnableUnauthorizedAccount'
      );
    })
    it("Exclude from fee", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(deployApra);
      await expect(apra.connect(bob).excludeFromFee(alice)).to.be.revertedWithCustomError(
        apra,
        'OwnableUnauthorizedAccount'
      );
    })
    it("Include in fee", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(deployApra);
      await expect(apra.connect(bob).includeInFee(alice)).to.be.revertedWithCustomError(
        apra,
        'OwnableUnauthorizedAccount'
      );
    })
    it("Change owner", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(deployApra);
      await expect(apra.connect(bob).transferOwnership(funds)).to.be.revertedWithCustomError(
        apra,
        'OwnableUnauthorizedAccount'
      );
    })
    it("Renounce owner", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(deployApra);
      await expect(apra.connect(bob).renounceOwnership()).to.be.revertedWithCustomError(
        apra,
        'OwnableUnauthorizedAccount'
      );
    })
    it("Transfer Ownership", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(deployApra);
      await apra.transferOwnership(bob);
      expect(await apra.getOwner()).to.equal(owner);
      expect(await apra.pendingOwner()).to.equal(bob);

      await expect(apra.acceptOwnership()).to.be.revertedWithCustomError(
        apra,
        "OwnableUnauthorizedAccount"
      );
      await apra.connect(bob).acceptOwnership();
      expect(await apra.getOwner()).to.equal(bob);
    })
    it("Renounce Ownership", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(deployApra);
      await apra.renounceOwnership();
      expect(await apra.getOwner()).to.equal(ZERO_ADDRESS);
    })
    /*it("Transfer Ownership to 0x0", async function () {
      const { apra, owner, funds, fees, alice, bob } = await loadFixture(deployApra);
      await expect(apra.transferOwnership(ZERO_ADDRESS)).to.be.revertedWithCustomError(
        apra,
        'OwnableInvalidOwner'
      );
    })*/
    
  });
});
