// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./APRA.sol";
import "./Ownable.sol";

/**
 * @dev Token vesting contract.
 *
 * APRA tokens can be locked for purchasing addresses. The workflow is the following:
 * 1) It is expected that 40% of the pruchased tokens are transferred to the buyer. (out of scope)
 * 2) The sender owns the tokens it wants to lock for the buyer.
 * 3) The sender grants enough allowance for this contract to transfer to itself the required amount of tokens.
 * 4) This contract increases the total amount of locked tokens for this account.
 * 5) The tokens are transferred from the sender to this account
 *
 * Every address can be queried for the actual or a given time for amount of tokens that can be currently withdrawn.
 * The formula for the withdrawal is 10% each months (every 30 days)
 */
contract TimeLock is Ownable {

    APRA  private _apra; // APRA contract
    uint256 private _icoTimestamp; // date and time of ICO in seconds after UNIX epoch
    bool private _icoLocked; // ICO date and time is locked - no further modification is possible
    
    // structure to hold vesting and withdrawn token amount for an address
    struct Locker {
        uint256 fullAmount;
        uint256 withdrawn;
    }

    // mapping address to vested and withdrawn amount of tokens
    mapping(address => Locker) private _lockers; 

    /**
    * @param apra Address of APRA token contract
    */
    constructor(APRA apra){
        _apra = apra;
    }

    event IcoTimestampSet(uint256 icoTimestamp);
    event IcoTimestampLocked(uint256 when, uint256 icoTimestamp);
    event TokensLocked(address indexed locker, uint256 amount);
    event TokensWithdrawn(address indexed locker, uint256 indexed timestamp, uint256 amount);

    /**
    * @dev Sets the ICO timestamp to the given time
    * @param icoTimestamp ICO timestamp (in seconds after UNIX epoch)
    */
    function setIcoTimestamp(uint256 icoTimestamp) external onlyOwner {
        require(!_icoLocked, "TimeLock: ICO timestamp locked");
        _icoTimestamp = icoTimestamp;

        emit IcoTimestampSet(icoTimestamp);
    }

    /**
    * @dev Locks the ICO timestamp to the already set value, no further modification is possible
    */
    function lockIcoTimestamp() external onlyOwner {
        require(!_icoLocked, "TimeLock: ICO timestamp already locked");
        require(_icoTimestamp > 0, "TimeLock: ICO timestamp not set");
        _icoLocked = true;

        emit IcoTimestampLocked(block.timestamp, _icoTimestamp);
    }

    /**
    * @dev Calculates the token amount that can be withdrawn now by the sender
    */
    function available() public view returns (uint256, Locker memory) {
        return availableAt(msg.sender, block.timestamp);
    }

    /**
    * @dev Calculates the token amount that can be withdrawn now for the given address
    * @param locker Calculation is done for this address
    */
    function available(address locker) external view returns (uint256, Locker memory) {
        return availableAt(locker, block.timestamp);
    }

    /**
    * @dev Calculates the token amount that can be withdrawn at the specified time by the caller
    * @param timestamp The timestamp (in seconds from UNIX epoch) used for the calculation
    */
    function availableAt(uint256 timestamp) external view returns (uint256, Locker memory) {
        return availableAt(msg.sender, timestamp);
    }

    /**
    * @dev Calculates the token amount that can be withdrawn by the given address at the specified time
    * @param locker Withdrawing address
    * @param timestamp Timestamp (in seconds after UNIC epoch) of withdrawal
    */
    function availableAt(address locker, uint256 timestamp) public view returns (uint256, Locker memory) {
        require(_icoTimestamp > 0, "TimeLock: ICO timestamp not set");
        require(timestamp > _icoTimestamp, "TimeLock: no withdrawal before ICO");
        require(timestamp >= block.timestamp, "TimeLock: timestamp is in the past");
        Locker memory lock = _lockers[locker];
        require(lock.fullAmount >0, "TimeLock: no amount locked");
        unchecked {
            // only future dates are allowed
            uint256 months = (timestamp - _icoTimestamp) / 30 days;
            if(months > 6) months = 6;
            // withdrawn amount can not exceed scheduled sum for present and future dates
            return ( lock.fullAmount * months / 6 - lock.withdrawn, lock);
        }
    }

    /**
    * @dev Lock tokens for the specified address - this contract must have the required amount of allowance 
    * given by the sending account for the given token
    * @param locker Tokens are locked for this address
    * @param amount How many tokens to lock
    */
    function lockAmount(address locker, uint256 amount) external{
        require(amount > 0, "TimeLock: amount must be greater than 0");
        unchecked{
            // amount can not be greater than APRA supply
            _lockers[locker].fullAmount += amount;
        }
        _apra.transferFrom(msg.sender, address(this), amount);

        emit TokensLocked(locker, amount);
    }

    /**
    * @dev Withdraw available tokens
    */
    function withdraw() external{
        require(_icoLocked, "TimeLock: ICO timestamp not locked");
        (uint256 sum, ) = available();
        require(sum > 0, "TimeLock: nothing to withdraw");
        unchecked{
            // amount can not be greater than APRA supply
            _lockers[msg.sender].withdrawn += sum;
        }
        _apra.transfer(msg.sender, sum);

        emit TokensWithdrawn(msg.sender, block.timestamp, sum);
    }

}