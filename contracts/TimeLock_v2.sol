// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./APRA.sol";
import "./Ownable2Step.sol";

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
contract TimeLock is Ownable2Step {

    APRA  private _apra; // APRA contract
    uint256 private _icoTimestamp; // date and time of ICO in seconds after UNIX epoch
    bool private _icoLocked; // ICO date and time is locked - no further modification is possible
    
    // structure to hold vesting and withdrawn token amount for an address
    struct Locker {
        uint256 fullAmount;
        uint256 withdrawn;
    }

    // mapping address to vested and withdrawn amount of tokens
    mapping(address => Locker) public _lockers; 

    // mapping of addresses that can lock funds
    mapping (address => bool) private _canLock;

    /**
    * @param apra Address of APRA token contract
    */
    constructor(APRA apra) Ownable(_msgSender()){
        _apra = apra;
    }

    event IcoTimestampSet(uint256 icoTimestamp);
    event IcoTimestampLocked(uint256 when, uint256 icoTimestamp);
    event TokensLocked(address indexed locker, uint256 amount);
    event TokensWithdrawn(address indexed locker, uint256 indexed timestamp, uint256 amount);
    event TokensTransferred(address indexed from, address indexed to, uint256 amount);

    error ICOTimestampLocked();
    /**
    * @dev Sets the ICO timestamp to the given time
    * @param icoTimestamp ICO timestamp (in seconds after UNIX epoch)
    */
    function setIcoTimestamp(uint256 icoTimestamp) external onlyOwner {
        if(_icoLocked){
            revert ICOTimestampLocked();
        }
        _icoTimestamp = icoTimestamp;

        emit IcoTimestampSet(icoTimestamp);
    }

    error ICOTimestampNotSet();
    /**
    * @dev Locks the ICO timestamp to the already set value, no further modification is possible
    */
    function lockIcoTimestamp() external onlyOwner {
        if(_icoLocked){
            revert ICOTimestampLocked();
        }
        if(_icoTimestamp == 0){
            revert ICOTimestampNotSet();
        }
        _icoLocked = true;

        emit IcoTimestampLocked(block.timestamp, _icoTimestamp);
    }

    /**
    * @dev Calculates the token amount that can be withdrawn now by the sender
    */
    function available() public view returns (uint256) {
        return availableAt(msg.sender, block.timestamp);
    }

    /**
    * @dev Calculates the token amount that can be withdrawn now for the given address
    * @param locker Calculation is done for this address
    */
    function available(address locker) public view returns (uint256) {
        return availableAt(locker, block.timestamp);
    }

    /**
    * @dev Calculates the token amount that can be withdrawn at the specified time by the caller
    * @param timestamp The timestamp (in seconds from UNIX epoch) used for the calculation
    */
    function availableAt(uint256 timestamp) external view returns (uint256) {
        return availableAt(msg.sender, timestamp);
    }

    error NoWithdrawalBeforeICO();
    error TimestampIsInThePast();
    error NoAmountLocked();
    
    /**
    * @dev Calculates the token amount that can be withdrawn by the given address at the specified time
    * @param locker Withdrawing address
    * @param timestamp Timestamp (in seconds after UNIC epoch) of withdrawal
    */
    function availableAt(address locker, uint256 timestamp) public view returns (uint256) {
        if(_icoTimestamp == 0){
            revert ICOTimestampNotSet();
        }
        if(timestamp <= _icoTimestamp){
            revert NoWithdrawalBeforeICO();
        }
        if(timestamp < block.timestamp){
            revert TimestampIsInThePast();
        }
        Locker memory lock = _lockers[locker];
        if(lock.fullAmount ==0){
            revert NoAmountLocked();
        }
        
        unchecked {
            // only future dates are allowed
            uint256 months = (timestamp - _icoTimestamp) / 30 days;
            if(months > 6) months = 6;
            // withdrawn amount can not exceed scheduled sum for present and future dates
            return ( lock.fullAmount * months / 6 - lock.withdrawn);
        }
    }

    error AmountMustBeGreaterThan0();
    error SenderCantLock();
    error ICOStarted();
    error LockFor0Address();
    error TimeLockNotExcludedFromFee();
    /**
    * @dev Lock tokens for the specified address - this contract must have the required amount of allowance 
    * given by the sending account for the given token
    * @param locker Tokens are locked for this address
    * @param amount How many tokens to lock
    */
    function lockAmount(address locker, uint256 amount) external {
        if(amount==0){
            revert AmountMustBeGreaterThan0();
        }
        if(!_canLock[msg.sender]){
            revert SenderCantLock();
        }
        if(_icoTimestamp > 0 && block.timestamp >= _icoTimestamp){
            revert ICOStarted();
        }
        if(locker==address(0)){
            revert LockFor0Address();
        }


        uint256 balanceBefore = _apra.balanceOf(address(this));
        _apra.transferFrom(msg.sender, address(this), amount);

        // amount can not be greater than APRA supply and can not underflow
        unchecked{
            uint256 amountReceived = _apra.balanceOf(address(this)) - balanceBefore;
            if(amountReceived != amount) revert TimeLockNotExcludedFromFee();
            _lockers[locker].fullAmount += amount;

        }
        emit TokensLocked(locker, amount);
        
    }

    error ICOTimestampNotLocked();
    error NothingToWithdraw();

    /**
    * @dev Withdraw available tokens
    */
    function withdraw() external {
        if(!_icoLocked){
            revert ICOTimestampNotLocked();
        }
        uint256 sum = available();
        if(sum == 0){
            revert NothingToWithdraw();
        }
        // amount can not be greater than APRA supply
        unchecked{
            _lockers[msg.sender].withdrawn += sum;
        }
        _apra.transfer(msg.sender, sum);

        emit TokensWithdrawn(msg.sender, block.timestamp, sum);
    }

    error NothingToTransfer();
    error SelfTransferNotAllowed();
    /**
    * @dev Transfer lock
    */
    function transfer(address recipient) external {
        Locker memory lock = _lockers[msg.sender];
        if(lock.fullAmount <= lock.withdrawn){
            revert NothingToTransfer();
        }

        if(msg.sender == recipient) {
            revert SelfTransferNotAllowed();
        }

        // amount can not be greater than APRA supply
        unchecked{
            _lockers[recipient].fullAmount += lock.fullAmount;
            _lockers[recipient].withdrawn += lock.withdrawn;
            _lockers[msg.sender].fullAmount = 0;
            _lockers[msg.sender].withdrawn = 0;

            emit TokensTransferred(msg.sender, recipient, lock.fullAmount - lock.withdrawn);
        }
    }


    /**
    * @dev Returns ICO timestamp
    */
    function getIcoTimestamp() external view returns (uint256) {
        return _icoTimestamp;
    }

    /**
    * @dev Returns if the ICO timestamp is locked
    */
    function isIcoLocked() external view returns (bool) {
        return _icoLocked;
    }

    /**
     * @dev Set (`account`) to be able to lock funds .
     * Can only be called by the current owner.
     */
    function setAccountAsLocker(address account) external onlyOwner {
        _canLock[account] = true;
    }
    
    /**
     * @dev Remove (`account`) from lockers.
     * Can only be called by the current owner.
     */
    function removeAccountFromLockers(address account) external onlyOwner {
        _canLock[account] = false;
    }

    /**
     * @dev Check if (`account`) can lock funds.
     */
    function canLock(address account) external view returns(bool) {
        return _canLock[account];
    }
}
