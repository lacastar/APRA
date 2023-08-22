// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./Ownable.sol";
import "./APRA.sol";
import "./TimeLock.sol";
import "./ApraSale_v2.sol";


/**
 * @dev Wallet contract for distributing purchased tokens.
 *
 */
contract ICOWallet is Ownable {

    APRA  private _apra; // APRA contract
    TimeLock private _lock; // Vesting contract
    ApraSale private _apraSale; // ApraSale contract
    address public _senderWallet; // wallet holding the APRAs to distribute

    /**
    * @param apra Address of the APRA token contract
    * 
    */
    constructor(APRA apra, TimeLock lock, ApraSale apraSale){
        _apra = apra;
        _lock = lock;
        _apraSale = apraSale;
        _senderWallet = msg.sender;
    }

    /**
     * @dev Distributes purchased tokens: 40% to purchaser 60% for vesting
     * @param recipient Address of purchaser
     * @param amount Amount purchased
     */
    function transfer(address recipient, uint256 amount) external onlyOwner returns (bool) {
        require(amount > 0, "ICOWallet: amount must be greater than 0");
        if(_apraSale.isExcludedFromLock(recipient)){
            _apra.transferFrom(_senderWallet, recipient, amount);
        }else{
            _apra.transferFrom(_senderWallet, recipient, amount * 2 / 5);
            _apra.transferFrom(_senderWallet, address(this), amount * 3 / 5);
            _apra.increaseAllowance(address(_lock), amount * 3 / 5);
            _lock.lockAmount(recipient, amount * 3 / 5);
        }
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

    /**
     * @dev Set sender wallet - APRA is sent from here
     * @param senderWallet wallet address 
     */
    function setSenderWallet(address senderWallet) external onlyOwner returns (bool) {
        _senderWallet = senderWallet;
        return true;
    }

}
