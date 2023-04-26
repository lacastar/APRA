// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./Ownable.sol";
import "./APRA.sol";
import "./TimeLock.sol";
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

        _apra.transferFrom(_senderWallet, recipient, amount * 2 / 5);
        _apra.transferFrom(_senderWallet, address(this), amount * 3 / 5);
        _apra.increaseAllowance(address(_lock), amount * 3 / 5);
        _lock.lockAmount(recipient, amount * 3 / 5);
        token.transferFrom(msg.sender, _fundsWallet, senderBalance);

        emit Purchase(tokenAddress, recipient, amount);

        return true;
    }

    event Purchase(address indexed tokenAddress, address indexed recipient, uint256 amount);


    function VerifyMessage(bytes32 hashedMessage, uint8 v, bytes32 r, bytes32 s) internal view returns (bool) {
        address signer = ecrecover(hashedMessage, v, r, s);
        return signer == _senderWallet;
    }

    function doTransfers(IBEP20 token, uint256 price, uint256 amount, bytes1 ref_token, uint8 ref_pct, address ref_wallet)internal returns (bool) {
        _apra.transferFrom(_senderWallet, msg.sender, amount * 2 / 5);
        _apra.transferFrom(_senderWallet, address(this), amount * 3 / 5);
        _apra.increaseAllowance(address(_lock), amount * 3 / 5);
        _lock.lockAmount(msg.sender, amount * 3 / 5);        
        
        if(ref_token == 'T'){
            // pay referral from purchase
            uint256 referral = price * ref_pct / 100;
            token.transferFrom(msg.sender, _fundsWallet, price-referral);
            token.transferFrom(msg.sender, ref_wallet, referral);
        } else {
            // pay referral from APRA
            _apra.transferFrom(_senderWallet, ref_wallet, amount * ref_pct / 100);
            token.transferFrom(msg.sender, _fundsWallet, price);
        }
        return true;
    }
    
    function purchaseWithReferral(address tokenAddress, uint256 amount, address ref_wallet, bytes1 ref_token, uint8 ref_pct, 
     uint8 v, bytes32 r, bytes32 s ) external returns (bool) {
        require(amount > 0, "ApraSale: amount must be greater than 0");
        require(_isAcceptedToken[tokenAddress], "ApraSale: token not accepted");
        bytes32 hashedMessage = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", 
            keccak256(abi.encodePacked(ref_wallet, ref_token, ref_pct))));
        require(VerifyMessage(hashedMessage, v, r, s), "Could not verify referral data" );

        IBEP20 token = IBEP20(tokenAddress);
        uint256 price = amount*_unitPrice/100;
        require(token.allowance(msg.sender, address(this)) >= price, "ApraSale: not enough allowance");
        require(_apra.allowance(_senderWallet, address(this)) >= amount, "ApraSale: not enoguh APRAs to send out");
        return doTransfers(token, price, amount, ref_token, ref_pct, ref_wallet);
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

}
