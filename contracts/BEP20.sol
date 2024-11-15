// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./IBEP20.sol";
import "./Ownable2Step.sol";

/**
 * @dev Implementation of the {IBEP20} interface.
 *
 * This implementation is agnostic to the way tokens are created. This means
 * that a supply mechanism has to be added in a derived contract using {_mint}.
 * For a generic mechanism see {BEP20PresetMinterPauser}.
 *
 * TIP: For a detailed writeup see our guide
 * https://forum.zeppelin.solutions/t/how-to-implement-erc20-supply-mechanisms/226[How
 * to implement supply mechanisms].
 *
 * We have followed general OpenZeppelin guidelines: functions revert instead
 * of returning `false` on failure. This behavior is nonetheless conventional
 * and does not conflict with the expectations of BEP20 applications.
 *
 * Additionally, an {Approval} event is emitted on calls to {transferFrom}.
 * This allows applications to reconstruct the allowance for all accounts just
 * by listening to said events. Other implementations of the EIP may not emit
 * these events, as it isn't required by the specification.
 *
 * Finally, the non-standard {decreaseAllowance} and {increaseAllowance}
 * functions have been added to mitigate the well-known issues around setting
 * allowances. See {IBEP20-approve}.
 */
contract BEP20 is IBEP20, Ownable2Step {
    mapping(address => uint256) private _balances;

    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private constant NAME = "Apraemio";
    string private constant SYMBOL = "APRA";
    uint8 private constant DECIMALS = 18;
    uint8 private constant TOKENFEE = 1;
    address private _feeWallet;
    bool private _takeFee;
    mapping (address => bool) private _isExcludedFromFee;

    error FeeWalletIsZeroAddress();

    /**
     * @dev Sets the values for {name}, {symbol} and {tokenFee}, {} initializes {decimals} with
     * a default value of 18, {takeFee} to true and sets the {feeWallet}.
     *
     * To select a different value for {decimals}, use {_setupDecimals}.
     * 
     * {name}, {symbol}, {tokenFee} and {decimals} are immutable: they can only be set once during
     * construction.
     */
    constructor (address feeWallet_) Ownable(_msgSender()){
        if(feeWallet_ == address(0)) {
            revert FeeWalletIsZeroAddress();
        }
        _takeFee = true;
        _feeWallet = feeWallet_;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() external override view returns (string memory) {
        return NAME;
    }

    function getOwner() external override view returns (address) {
        return owner();
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() external override view returns (string memory) {
        return SYMBOL;
    }

    function tokenFee() external view returns (uint8) {
        return TOKENFEE;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the value {BEP20} uses, unless {_setupDecimals} is
     * called.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IBEP20-balanceOf} and {IBEP20-transfer}.
     */
    function decimals() external override view returns (uint8) {
        return DECIMALS;
    }

    /**
     * @dev See {IBEP20-totalSupply}.
     */
    function totalSupply() external override view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IBEP20-balanceOf}.
     */
    function balanceOf(address account) external override view returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev See {IBEP20-transfer}.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    /**
     * @dev See {IBEP20-allowance}.
     */
    function allowance(address owner_, address spender) external virtual view override returns (uint256) {
        return _allowances[owner_][spender];
    }

    /**
     * @dev See {IBEP20-approve}.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount) external virtual override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    error TransferAmountExceedsAllowance();

    /**
     * @dev See {IBEP20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {BEP20}.
     *
     * Requirements:
     *
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     * - the caller must have allowance for ``sender``'s tokens of at least
     * `amount`.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        address senderTemp = _msgSender();
        uint256 currentAllowanceTemp = _allowances[sender][senderTemp ];
        if(currentAllowanceTemp < amount) {
            revert TransferAmountExceedsAllowance();
        }
        unchecked {
            _approve(sender, senderTemp,currentAllowanceTemp - amount);
        }
        return true;
    }

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IBEP20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue) external virtual returns (bool) {
        address senderTemp = _msgSender();
        _approve(senderTemp, spender, _allowances[senderTemp][spender] + addedValue);
        return true;
    }

    error DecreasedAllowanceBelowZero();

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IBEP20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) external virtual returns (bool) {
        address senderTemp = _msgSender();
        uint256 currentAllowanceTemp =  _allowances[senderTemp][spender];
        if(currentAllowanceTemp < subtractedValue) {
            revert DecreasedAllowanceBelowZero();
        }
        unchecked {
            _approve(senderTemp, spender, currentAllowanceTemp - subtractedValue);
        }
        return true;
    }

    error TransferFromTheZeroAddress();
    error TransferToTheZeroAddress();
    error TransferAmountExceedsBalance();
    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(address sender, address recipient, uint256 amount) internal virtual {
        if(sender == address(0)){
            revert TransferFromTheZeroAddress();
        }
        if(recipient == address(0)){
            revert TransferToTheZeroAddress();
        }
        if(_balances[sender] < amount){
            revert TransferAmountExceedsBalance();
        }

        _beforeTokenTransfer(sender, recipient, amount);

        bool takeFee = _takeFee && sender != owner() && sender != _feeWallet && recipient != owner() 
        && recipient != _feeWallet && !_isExcludedFromFee[sender] && !_isExcludedFromFee[recipient];

        uint256 fee;

        unchecked {
            fee = takeFee ? amount * TOKENFEE / 100 : 0;
            _balances[sender] -= amount;
            // Overflow not possible: the sum of all balances is capped by totalSupply, and the sum is preserved by
            // decrementing then incrementing.
            _balances[recipient] += (amount - fee);
            _balances[_feeWallet] += _balances[_feeWallet];
        }
        emit Transfer(sender, recipient, amount);
        if(takeFee) emit Transfer(sender, _feeWallet, fee);
    }

    error MintToTheZeroAddress();
    error PossibleFeeCalculationOverflow();
    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal virtual {
        if(account == address(0)){
            revert MintToTheZeroAddress();
        }
        
        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += amount;
        unchecked {
            if(TOKENFEE>0 ) {
                if(_totalSupply*TOKENFEE < _totalSupply){
                    revert PossibleFeeCalculationOverflow();
                }
            }
        }
        _balances[account] += amount;

        emit Transfer(address(0), account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burn(uint256 amount) external virtual {
        _burn(_msgSender(), amount);
    }

    error BurnAmountExceedsAllowance();
    /**
     * @dev Destroys `amount` tokens from `account`, deducting from the caller's
     * allowance.
     *
     * See {ERC20-_burn} and {ERC20-allowance}.
     *
     * Requirements:
     *
     * - the caller must have allowance for ``accounts``'s tokens of at least
     * `amount`.
     */
    function burnFrom(address account, uint256 amount) external virtual {
        address senderTemp = _msgSender();
        uint256 currentAllowanceTemp =  _allowances[account][senderTemp ];
        if(currentAllowanceTemp < amount){
           revert BurnAmountExceedsAllowance();
        }
        unchecked{
            _approve(account, senderTemp, currentAllowanceTemp - amount);
        }
        _burn(account, amount);
    }

    error BurnFromTheZeroAddress();
    error BurnAmountExceedsBalance();
    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 amount) internal virtual {
        if(account == address(0)){
            revert BurnFromTheZeroAddress();
        }
        _beforeTokenTransfer(account, address(0), amount);

        uint256 accountBalance = _balances[account];
        if(accountBalance < amount){
            revert BurnAmountExceedsBalance();
        }
        unchecked {
            _balances[account] = accountBalance - amount;
            // Overflow not possible: amount <= accountBalance <= totalSupply.
            _totalSupply -= amount;
        }

        emit Transfer(account, address(0), amount);
    }

    error ApproveFromTheZeroAddress();
    error ApproveToTheZeroAddress();
    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(address owner_, address spender, uint256 amount) internal virtual {
        if(owner_ == address(0)){
            revert ApproveFromTheZeroAddress();
        }
        if(spender == address(0)){
            revert ApproveToTheZeroAddress();
        }
        _allowances[owner_][spender] = amount;
        emit Approval(owner_, spender, amount);
    }

    /**
     * @dev Hook that is called before any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * will be to transferred to `to`.
     * - when `from` is zero, `amount` tokens will be minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual {}

    error NewFeeWallerIsTheZeroAddress();
    /**
     * @dev Change the fee wallet to a new account (`newFeeWallet`).
     * Can only be called by the current owner.
     */
    function changeFeeWallet(address newFeeWallet) external virtual onlyOwner {
        if(newFeeWallet == address(0)){
            revert NewFeeWallerIsTheZeroAddress();
        }
        address oldFeeWallet = _feeWallet;
        _feeWallet = newFeeWallet;
        emit FeeWalletChanged(oldFeeWallet, newFeeWallet);
    }

    event FeeWalletChanged(address indexed oldFeeWallet, address indexed newFeeWallet);

    error TakingFeeIsAlreadySet();
    /**
     * @dev Enable or disable fee taking for transactions according to (`takeFee`).
     * Can only be called by the current owner.
     */
    function setTakeFee(bool takeFee) external virtual onlyOwner {
        if(takeFee == _takeFee){
            revert TakingFeeIsAlreadySet();
        }
        _takeFee = takeFee;
        emit FeeTakingEnabled(takeFee, owner());
    }
    event FeeTakingEnabled(bool indexed takeFee, address indexed owner);

    /**
     * @dev Exclude (`account`) from fee payment.
     * Can only be called by the current owner.
     */
    function excludeFromFee(address account) external onlyOwner {
        _isExcludedFromFee[account] = true;
    }
    
    /**
     * @dev Include (`account`) in fee payment.
     * Can only be called by the current owner.
     */
    function includeInFee(address account) external onlyOwner {
        _isExcludedFromFee[account] = false;
    }

    /**
     * @dev Check if (`account`) must pay fees.
     * Can only be called by the current owner.
     */
    function isExcludedFromFee(address account) external view returns(bool) {
        return _isExcludedFromFee[account];
    }
}
