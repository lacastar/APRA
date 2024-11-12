// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./BEP20.sol";

contract APRA is BEP20{

  /**
  * @param wallet Address of the wallet, where tokens will be transferred to
  */
  constructor(address wallet, address feeWallet) BEP20(feeWallet){
    if(wallet == address(0)){
            revert MintToTheZeroAddress();
    }
    _mint(wallet, uint256(1_000_000_000) * 1 ether);
  }
}