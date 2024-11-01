//const {  ethers, network } = require("hardhat");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function expandTo18Decimals(n) {
    return BigInt(n)*(BigInt(10)**BigInt(18));
}

async function mineBlock(
    provider,
    timestamp
) {
    await provider.send("evm_setNextBlockTimestamp", [timestamp]);
}

module.exports = {
    ZERO_ADDRESS,
    expandTo18Decimals,
    mineBlock
};