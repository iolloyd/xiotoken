// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TokenSwap is Pausable, AccessControl, ReentrancyGuard {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    IERC20 public xgenToken;
    IERC20 public xioToken;
    uint256 public swapStartTime;
    uint256 public constant SWAP_RATIO = 1;

    event TokensSwapped(address indexed user, uint256 amount);

    constructor(
        address _xgenToken,
        address _xioToken,
        uint256 _swapStartTime
    ) {
        require(_xgenToken != address(0), "XGEN address cannot be zero");
        require(_xioToken != address(0), "XIO address cannot be zero");
        require(_swapStartTime > block.timestamp, "Start time must be in future");

        xgenToken = IERC20(_xgenToken);
        xioToken = IERC20(_xioToken);
        swapStartTime = _swapStartTime;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    function swap(uint256 amount) external nonReentrant whenNotPaused {
        require(block.timestamp >= swapStartTime, "Swap not started");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 xioAmount = amount * SWAP_RATIO;
        require(xioToken.balanceOf(address(this)) >= xioAmount, "Insufficient XIO balance");

        require(xgenToken.transferFrom(msg.sender, address(this), amount), "XGEN transfer failed");
        require(xioToken.transfer(msg.sender, xioAmount), "XIO transfer failed");

        emit TokensSwapped(msg.sender, amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function withdrawXIO(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(xioToken.transfer(msg.sender, amount), "Transfer failed");
    }

    function withdrawXGEN(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(xgenToken.transfer(msg.sender, amount), "Transfer failed");
    }
}