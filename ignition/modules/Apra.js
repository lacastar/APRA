const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("apra", (m) => {
  const funds = m.getParameter("funds", m.getAccount(1).address);
  const fees = m.getParameter("fees", m.getAccount(2).address);
  const apra = m.contract("APRA", [funds, fees]);

  return { apra };
});