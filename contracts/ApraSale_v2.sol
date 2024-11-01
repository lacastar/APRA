// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./Ownable.sol";
import "./APRA.sol";
import "./TimeLock_v2.sol";
import "./IBEP20.sol";

/**
 * @dev Wallet contract for distributing purchased tokens.
 *
 */
contract ApraSale is Ownable {

    APRA  private _apra; // APRA contract
    TimeLock private _lock; // Vesting contract
    uint256 public _unitPrice; // price of one APRA in USD cent
    address public _fundsWallet; // wallet used to store funds
    address public _senderWallet; // wallet holding the APRAs to distribute
    mapping(address => bool) private _isAcceptedToken; // token can be used for payment (ex.: BUSD, TUSD, DAI)

    mapping (address => bool) private _isExcludedFromLock;
    mapping (address => bool) private _isAdmin;

    event Purchase(address indexed tokenAddress, address indexed recipient, uint256 amount);

    /**
    * @param apra Address of the APRA token contract
    * 
    */
    constructor(APRA apra, TimeLock lock){
        _apra = apra;
        _lock = lock;
        _fundsWallet = msg.sender;
        _senderWallet = msg.sender;
        _unitPrice = 25;
    }

    /**
     * @dev Set APRA price in USD
     * @param unitPrice price of one APRA
     */
    function setPrice(uint256 unitPrice) external onlyOwner returns (bool) {
        _unitPrice = unitPrice;
        return true;
    }

    /**
     * @dev Set funds wallet where APRA price is sent
     * @param fundsWallet wallet address 
     */
    function setFundsWallet(address fundsWallet) external onlyOwner returns (bool) {
        _fundsWallet = fundsWallet;
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

    /**
     * @dev Add token to accepted tokens
     * @param tokenAddress address of token to accept
     */
    function addAcceptedToken(address tokenAddress) external onlyOwner returns (bool) {
        require(IBEP20(tokenAddress).decimals()==18, "ApraSale: token must have 18 decimals");
        _isAcceptedToken[tokenAddress] = true;
        return true;
    }

    /**
     * @dev Remove token from accepted tokens
     * @param tokenAddress address of token to not accept anymore
     */
    function removeAcceptedToken(address tokenAddress) external onlyOwner returns (bool) {
        _isAcceptedToken[tokenAddress] = false;
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
     * @dev Distributes purchased tokens: 40% to purchaser 60% for vesting
     * @param tokenAddress Address of token to be used for payment
     * @param recipient Address where the APRA is to be sent
     */
    function purchase(address tokenAddress, address recipient) external returns (bool) {
        IBEP20 token = IBEP20(tokenAddress);
        uint256 senderBalance = token.balanceOf(msg.sender);
        uint256 amount = senderBalance * 100 / _unitPrice;
        require(amount > 0, "ApraSale: amount must be greater than 0");
        require(_isAcceptedToken[tokenAddress], "ApraSale: token not accepted");
        require(token.allowance(msg.sender, address(this)) >= senderBalance, "ApraSale: not enough allowance");
        require(_apra.allowance(_senderWallet, address(this)) >= amount, "ApraSale: not enoguh APRAs to send out");

        if(isExcludedFromLock(recipient)){
            _apra.transferFrom(_senderWallet, recipient, amount);
        }else{
            _apra.transferFrom(_senderWallet, recipient, amount * 2 / 5);
            _apra.transferFrom(_senderWallet, address(this), amount * 3 / 5);
            _apra.increaseAllowance(address(_lock), amount * 3 / 5);
            _lock.lockAmount(recipient, amount * 3 / 5);
        }
        token.transferFrom(msg.sender, _fundsWallet, senderBalance);

        emit Purchase(tokenAddress, recipient, amount);

        return true;
    }

    /**
     * @dev Distributes purchased tokens: 40% to purchaser 60% for vesting
     * @param tokenAddress Address of token to be used for payment
     * @param amount APRA amount purchased
     */
    function purchase(address tokenAddress, uint256 amount) external returns (bool) {
        require(amount > 0, "ApraSale: amount must be greater than 0");
        require(_isAcceptedToken[tokenAddress], "ApraSale: token not accepted");
        IBEP20 token = IBEP20(tokenAddress);
        uint256 price = amount*_unitPrice/100;
        require(token.allowance(msg.sender, address(this)) >= price, "ApraSale: not enough allowance");
        require(_apra.allowance(_senderWallet, address(this)) >= amount, "ApraSale: not enoguh APRAs to send out");
        
        if(isExcludedFromLock(msg.sender)){
            _apra.transferFrom(_senderWallet, msg.sender, amount);
        }else{
            _apra.transferFrom(_senderWallet, msg.sender, amount * 2 / 5);
            _apra.transferFrom(_senderWallet, address(this), amount * 3 / 5);
            _apra.increaseAllowance(address(_lock), amount * 3 / 5);
            _lock.lockAmount(msg.sender, amount * 3 / 5);
        }
        token.transferFrom(msg.sender, _fundsWallet, price);

        emit Purchase(tokenAddress, msg.sender, amount);

        return true;
    }
 

    /**
     * @dev Removes tokens from contract
     * @param tokenAddress Address of token to withdraw
     */
    function withdraw(address tokenAddress) external onlyOwner returns (bool)    {
        IBEP20 token = IBEP20(tokenAddress);
        token.transfer(owner(), token.balanceOf(address(this)));
        return true;
    }

    /**
     * @dev Exclude (`account`) from time lock.
     * Can only be called by an admin.
     */
    function excludeFromLock(address account) external onlyAdmin {
        _isExcludedFromLock[account] = true;
    }
    
    /**
     * @dev Include (`account`) in time lock.
     * Can only be called by and admin.
     */
    function includeInLock(address account) external onlyAdmin {
        _isExcludedFromLock[account] = false;
    }

    /**
     * @dev Check if (`account`) is in time lock.
     * 
     */
    function isExcludedFromLock(address account) public view returns(bool) {
        return _isExcludedFromLock[account];
    }

    /**
     * @dev Add (`account`) to admins.
     * Can only be called by the current owner.
     */
    function setAdmin(address account) external onlyOwner {
        _isAdmin[account] = true;
    }
    
    /**
     * @dev Remove (`account`) from admins.
     * Can only be called by the current owner.
     */
    function removeAdmin(address account) external onlyOwner {
        _isAdmin[account] = false;
    }

    /**
     * @dev Check if (`account`) is admin.
     * 
     */
    function isAdmin(address account) public view returns(bool) {
        return _isAdmin[account];
    }
	
	
	/**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyAdmin() {
        require(isAdmin(_msgSender()) || owner() == _msgSender(), "ApraSale_v2: caller is not admin");
        _;
    }	

}
