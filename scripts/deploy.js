const { ethers } = require("hardhat");
const ApraModule = require("../ignition/modules/Apra");
require('dotenv').config()

/*
// This is a script for deploying the contracts. 
async function main() {
    // This is just a convenience check
    const [owner, funds, fees] = await ethers.getSigners();
    //const tokenAddress = parseEthAddress("TOKEN_ADDRESS");
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Deploy contracts");

    const Apra = await ethers.getContractFactory("APRA");
    //const lock = await Lock.deploy(unlockTime, { value: lockedAmount });
    const apra = await Apra.deploy(funds.address, fees.address);


    //const vestingContract = await new TokenVesting__factory(deployer).deploy(
    //    tokenAddress
    //);
    console.log("Apra contract deployed: ",  apra.address);
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
*/

async function main() {
    const parameters = {
        apra: {
            fees: process.env.FEES_ADDRESS,
            funds: process.env.FUNDS_ADDRESS
        }
    }
    const { apra } = await hre.ignition.deploy(ApraModule, {
        defaultSender: process.env.DEPLOYER_ADDRESS,
        parameters},);
  
    console.log(`Apra deployed to: ${await apra.getAddress()}`);
  }
  
  main().catch(console.error);