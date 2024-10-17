// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./INFTCollection.sol";
//import "hardhat/console.sol";

contract BymaxPay is ERC721Holder, Ownable, ReentrancyGuard {
    INFTCollection public nftCollection;
    IERC20 public acceptedToken;
    using SafeERC20 for IERC20;

    uint public feePercentage = 500; // Fee percentage (5%)
    uint public accumulatedFees; // Accumulated fees in the contract
    struct Contractor {
        uint balance;
    }
    struct Customer {
        uint tokenId;
        uint nextPayment;
        uint index;
        address contractor;
    }

    mapping(address => Customer) public payments; // customer address => payment info
    mapping(address => Contractor) public contractorsData; // contractor address => struct containing balance
    mapping(address => bool) private isContractorRegistered; // contractor address => registered
    address[] public contractors; // list of contractors
    address[] public customers; // list of customers

    event ContractorRemoved(address contractor);
    event Paid(address indexed customer, address indexed contractor, uint date, uint amount, uint duration);
    event Granted(address indexed customer, uint tokenId, uint date);
    event Revoked(address indexed customer, uint tokenId, uint date);
    event Removed(address indexed customer, uint tokenId, uint date);
    event FeeAccumulated(uint feeAmount);
    event WithdrawnFees(uint amount, address recipient);
    event WithdrawnContractorBalance(uint amount, address contractor);

    constructor(address tokenAddress, address nftAddress) Ownable(msg.sender) {
        acceptedToken = IERC20(tokenAddress);
        nftCollection = INFTCollection(nftAddress);
    }

    function setFeePercentage(uint newFee) external onlyOwner {
        require(newFee <= 5000, "Fee percentage too high"); // Max 50% (5000 bps)
        feePercentage = newFee;
    }

    function getCustomers() external view onlyOwner returns (address[] memory, Customer[] memory) {
        address[] memory customerAddresses = customers;
        Customer[] memory customerData = new Customer[](customers.length);
        
        for (uint i = 0; i < customers.length; i++) {
            customerData[i] = payments[customers[i]];
        }
        
        return (customerAddresses, customerData);
    }

    function getCustomer(address customer) external view returns (Customer memory) {
        require(payments[customer].nextPayment != 0, "Customer does not exist");
        return payments[customer];
    }

    function getContractors() external view onlyOwner returns (address[] memory, uint[] memory) {
        uint[] memory balances = new uint[](contractors.length);
        for (uint i = 0; i < contractors.length; i++) {
            balances[i] = contractorsData[contractors[i]].balance;
        }
        return (contractors, balances);
    }

    function getContractorBalance() external view returns (uint) {
        return contractorsData[msg.sender].balance;
    }

    function removeCustomer(address customer) external onlyOwner {
        require(payments[customer].nextPayment != 0, "Customer does not exist");

        uint tokenId = payments[customer].tokenId;
        nftCollection.burn(tokenId);

        // Swap and pop to remove customer from the array
        uint index = payments[customer].index;
        if (index < customers.length - 1) {
            customers[index] = customers[customers.length - 1];
            payments[customers[index]].index = index;
        }
        customers.pop();

        delete payments[customer];

        emit Removed(customer, tokenId, block.timestamp);
    }

    function removeContractor(address contractor) external onlyOwner {
        require(contractor != address(0), "Invalid contractor address");
        require(contractorsData[contractor].balance == 0, "Contractor has a balance");

        // Remove contractor from contractor array
        for (uint i = 0; i < contractors.length; i++) {
            if (contractors[i] == contractor) {
                contractors[i] = contractors[contractors.length - 1];
                contractors.pop();
                break;
            }
        }

        // Remove contractor data
        delete contractorsData[contractor];
        isContractorRegistered[contractor] = false;

        emit ContractorRemoved(contractor);
    }

    function pay(address customer, address contractor, uint amount, uint duration) external onlyOwner {
        require(contractor != address(0), "Invalid contractor address");
        require(payments[customer].contractor == address(0) || payments[customer].contractor == contractor, "Customer already associated with another contractor");
        require(amount > 0, "Invalid amount");
        require(duration > 0, "Invalid duration");

        bool timeExpired = payments[customer].nextPayment <= block.timestamp;
        bool firstPayment = payments[customer].nextPayment == 0;
        bool hasAmount = acceptedToken.balanceOf(customer) >= amount;
        bool hasAllowance = acceptedToken.allowance(customer, address(this)) >= amount;

        if ((timeExpired || firstPayment) && (!hasAmount || !hasAllowance)) {
            if (!firstPayment) {
                nftCollection.safeTransferFrom(customer, address(this), payments[customer].tokenId);
                emit Revoked(customer, payments[customer].tokenId, block.timestamp);
                return;
            } else {
                revert("Insufficient balance and/or allowance.");
            }
        }

        if (firstPayment) {
            nftCollection.mint(customer);
            payments[customer].tokenId = nftCollection.getLastTokenId();
            payments[customer].index = customers.length;
            payments[customer].contractor = contractor;
            customers.push(customer);
            emit Granted(customer, payments[customer].tokenId, block.timestamp);
        }

        // Check if the contractor is already registered, otherwise add him
        if (!isContractorRegistered[contractor]) {
            contractors.push(contractor);
            isContractorRegistered[contractor] = true;
        }
   
        // Calculate fee and remaining amount to allocate to the contractor
        uint feeAmount = (amount * feePercentage) / 10000;
        uint contractorAmount = amount - feeAmount;

        // Accumulate fee in the contract
        accumulatedFees += feeAmount;
        emit FeeAccumulated(feeAmount);

        // Accumulate contractor's balance
        contractorsData[contractor].balance += contractorAmount;

        // Transfer payment from customer
        acceptedToken.safeTransferFrom(customer, address(this), amount);

        // Emit "Paid" event for every successful payment
        emit Paid(customer, contractor, block.timestamp, amount, duration);

        // Update the next payment date
        if (firstPayment || timeExpired) {
            payments[customer].nextPayment = block.timestamp + duration;
        } else {
            payments[customer].nextPayment += duration;
        }

        if (payments[customer].nextPayment > block.timestamp && nftCollection.ownerOf(payments[customer].tokenId) != customer) {
            nftCollection.safeTransferFrom(
                address(this),
                customer,
                payments[customer].tokenId
            );

            emit Granted(
                customer,
                payments[customer].tokenId,
                block.timestamp
            );
        }
    }

    // Allow only contractor to withdraw their balance
    function withdrawContractorBalance() external nonReentrant {
        uint amountToWithdraw = contractorsData[msg.sender].balance;
        require(amountToWithdraw > 0, "No balance to withdraw");

        contractorsData[msg.sender].balance = 0; // Reset the balance before transfer to avoid reentrancy
        acceptedToken.safeTransfer(msg.sender, amountToWithdraw);

        emit WithdrawnContractorBalance(amountToWithdraw, msg.sender);
    }

    // Function to allow only the owner to withdraw accumulated fees
    function withdrawFees() external onlyOwner nonReentrant {
        uint amountToWithdraw = accumulatedFees;
        require(amountToWithdraw > 0, "No fees to withdraw");

        accumulatedFees = 0; // Reset fees before transfer to prevent reentrancy
        acceptedToken.safeTransfer(owner(), amountToWithdraw);

        emit WithdrawnFees(amountToWithdraw, owner());
    }
}
