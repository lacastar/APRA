// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./BEP20.sol";

contract APRA is BEP20("Apraemio", "APRA", 1, address(0x0)){

  /**
  * @param wallet Address of the wallet, where tokens will be transferred to
  */
  constructor(address wallet) {
    _mint(wallet, uint256(1000000000) * 1 ether);
  }
}