const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
// const { ethers } = require("hardhat");

module.exports = buildModule("apra", (m) => {
  const funds = m.getParameter("funds", m.getAccount(1).address);
  const fees = m.getParameter("fees", m.getAccount(2).address);
  const apra = m.contract("APRA", [funds, fees]);

  //m.call(apollo, "launch", []);

  return { apra };
});