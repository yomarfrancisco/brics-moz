// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DepositContract is Ownable {
    address public immutable usdtAddress;
    mapping(address => uint256) public userDeposits;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    constructor(address _usdtAddress) Ownable(msg.sender) {
        usdtAddress = _usdtAddress;
    }

    function deposit(uint256 amount) external {
        IERC20 usdt = IERC20(usdtAddress);
        uint256 allowance = usdt.allowance(msg.sender, address(this));
        require(allowance >= amount, "Insufficient allowance");

        bool success = usdt.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        userDeposits[msg.sender] += amount;
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        IERC20 usdt = IERC20(usdtAddress);
        require(userDeposits[msg.sender] >= amount, "Insufficient deposited amount");
        require(usdt.balanceOf(address(this)) >= amount, "Insufficient contract balance");

        userDeposits[msg.sender] -= amount;
        bool success = usdt.transfer(msg.sender, amount);
        require(success, "Withdrawal failed");

        emit Withdrawal(msg.sender, amount);
    }

    function getContractAddress() external view returns (address) {
        return address(this);
    }

    function withdrawToTreasury(address treasury, uint256 amount) external onlyOwner {
        IERC20 usdt = IERC20(usdtAddress);
        require(usdt.balanceOf(address(this)) >= amount, "Insufficient contract balance");
        bool success = usdt.transfer(treasury, amount);
        require(success, "Treasury withdrawal failed");
    }
}