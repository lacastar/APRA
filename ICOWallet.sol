// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./Ownable.sol";
import "./APRA.sol";
import "./TimeLock.sol";


/**
 * @dev Wallet contract for distributing purchased tokens.
 *
 */
contract ICOWallet is Ownable {

    APRA  private _apra; // APRA contract
    TimeLock private _lock; // Vesting contract

    /**
    * @param apra Address of the APRA token contract
    * 
    */
    constructor(APRA apra, TimeLock lock){
        _apra = apra;
        _lock = lock;
    }

    /**
     * @dev Distributes purchased tokens: 40% to purchaser 60% for vesting
     * @param recipient Address of purchaser
     * @param amount Amount purchased
     */
    function transfer(address recipient, uint256 amount) external onlyOwner returns (bool) {
        require(amount > 0, "ICOWallet: amount must be greater than 0");
        _apra.transfer(recipient, amount * 2 / 5);
        _apra.increaseAllowance(address(_lock), amount * 3 / 5);
        _lock.lockAmount(recipient, amount * 3 / 5);
        return true;
    }

    /**
     * @dev Set TimeLock contract to use
     * @param timelock TimeLock contract
     */
    function setTimeLock(TimeLock timelock) external onlyOwner returns (bool) {
        _lock = timelock;
        return true;
    }

}