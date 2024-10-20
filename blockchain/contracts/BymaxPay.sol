// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./INFTCollection.sol";
//import "hardhat/console.sol";

contract BymaxPay is ERC721Holder, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public acceptedToken;
    uint public feePercentage = 500;    // Fee percentage (5%)
    uint public accumulatedFees;        // Accumulated fees in the contract
    struct Contractor {
        address nftCollection;          // NFT Collection for the contractor
        uint balance;                   // Contractor balance
    }
    struct Customer {
        uint tokenId;
        uint nextPayment;
        uint duration;
    }

    mapping(address => mapping(address => Customer)) public customerPayments; // customer => contractor => customerPayments info
    mapping(address => Contractor) public contractorsData; // contractor address => struct containing balance

    address[] public contractors;   // list of contractors
    address[] public customers;     // list of customers

    event ContractorRemoved(address contractor);
    event Paid(address indexed customer, address indexed contractor, uint date, uint amount, uint duration);
    event Granted(address indexed customer, address indexed contractor, uint tokenId, uint date);
    event Revoked(address indexed customer, address indexed contractor, uint tokenId, uint date);
    event Removed(address indexed customer, address indexed contractor, uint tokenId, uint date);
    event FeeAccumulated(uint feeAmount);
    event FeePercentageUpdated(uint newFee);
    event WithdrawnFees(uint amount, address recipient);
    event WithdrawnContractorBalance(uint amount, address contractor);

    constructor(address tokenAddress) Ownable(msg.sender) {
        acceptedToken = IERC20(tokenAddress);
    }

    function setFeePercentage(uint newFee) external onlyOwner {
        require(newFee <= 5000, "Fee percentage too high"); // Max 50% (5000 bps)
        feePercentage = newFee;
        emit FeePercentageUpdated(newFee);
    }

    function addContractor(address contractor, address nftCollection) external onlyOwner {
        require(contractor != address(0), "Invalid contractor address");
        require(nftCollection != address(0), "Invalid NFT collection");

        // Check if the nftCollection supports the INFTCollection interface
        require(IERC165(nftCollection).supportsInterface(type(INFTCollection).interfaceId),
            "NFT collection does not support INFTCollection interface"
        );

        contractorsData[contractor] = Contractor({
            nftCollection: nftCollection,
            balance: 0
        });
        contractors.push(contractor);
    }

    function getTotalContractors() external view returns (uint256) {
        return contractors.length;
    }

    function getTotalCustomers() external view returns (uint256) {
        return customers.length;
    }

    function getCustomers(uint limit, uint skip) external view onlyOwner returns (address[] memory, Customer[][] memory) {
        require(skip <= customers.length, "Skip exceeds total customers");

        uint maxLimit = (skip + limit > customers.length) ? customers.length - skip : limit;

        address[] memory customerAddresses = new address[](maxLimit);
        Customer[][] memory customerData = new Customer[][](maxLimit);

        for (uint i = 0; i < maxLimit; i++) {
            address customer = customers[skip + i];
            uint contractorCount = contractors.length;

            Customer[] memory contractorPayments = new Customer[](contractorCount);

            for (uint j = 0; j < contractorCount; j++) {
                address contractor = contractors[j];
                contractorPayments[j] = customerPayments[customer][contractor];
            }

            customerAddresses[i] = customer;
            customerData[i] = contractorPayments;
        }

        return (customerAddresses, customerData);
    }

    function getCustomer(address customer) external view returns (Customer[] memory) {
        uint contractorCount = contractors.length;
        Customer[] memory contractorPayments = new Customer[](contractorCount);

        for (uint i = 0; i < contractorCount; i++) {
            address contractor = contractors[i];
            contractorPayments[i] = customerPayments[customer][contractor];
        }

        return contractorPayments;
    }

    function getCustomerDetails(address customer, address contractor) external view returns (Customer memory) {
        return customerPayments[customer][contractor];
    }

    function getContractors(uint limit, uint skip) external view onlyOwner returns (address[] memory, uint[] memory, address[] memory) {
        require(skip <= contractors.length, "Skip exceeds total contractors");

        uint end = skip + limit > contractors.length ? contractors.length : skip + limit;
        uint resultLength = end - skip;

        address[] memory paginatedContractors = new address[](resultLength);
        uint[] memory balances = new uint[](resultLength);
        address[] memory nftCollections = new address[](resultLength);

        for (uint i = skip; i < end; i++) {
            paginatedContractors[i - skip] = contractors[i];
            balances[i - skip] = contractorsData[contractors[i]].balance;
            nftCollections[i - skip] = contractorsData[contractors[i]].nftCollection;
        }

        return (paginatedContractors, balances, nftCollections);
    }

    function getContractorBalance() external view returns (uint) {
        return contractorsData[msg.sender].balance;
    }

    function getContractorNFTCollection() external view returns (address) {
        return contractorsData[msg.sender].nftCollection;
    }

    function removeCustomer(address customer) external onlyOwner {
        bool hasCustomer = false;
        bool hasActiveAccess = false;

        for (uint i = 0; i < contractors.length; i++) {
            address contractorAddress = contractors[i];
            uint tokenId = customerPayments[customer][contractorAddress].tokenId;
            address nftCollectionAddress = contractorsData[contractorAddress].nftCollection;

           if (tokenId != 0) {
                hasCustomer = true;

                if (INFTCollection(nftCollectionAddress).ownerOf(tokenId) == customer) {
                    hasActiveAccess = true;
                    break;
                }
            }
        }

        require(hasCustomer, "Customer does not exist");
        require(!hasActiveAccess, "Customer still has active access in a contractor");

        for (uint i = 0; i < contractors.length; i++) {
            address contractorAddress = contractors[i];
            delete customerPayments[customer][contractorAddress];
        }

        for (uint i = 0; i < customers.length; i++) {
            if (customers[i] == customer) {
                customers[i] = customers[customers.length - 1];
                customers.pop();
                break;
            }
        }

        emit Removed(customer, address(0), 0, block.timestamp);
    }

    function removeContractor(address contractor) external onlyOwner {
        require(contractor != address(0), "Invalid contractor address");
        require(contractorsData[contractor].balance == 0, "Contractor has a balance");

        for (uint i = 0; i < contractors.length; i++) {
            if (contractors[i] == contractor) {
                contractors[i] = contractors[contractors.length - 1];
                contractors.pop();
                break;
            }
        }

        for (uint i = 0; i < customers.length; i++) {
            address customer = customers[i];
            if (customerPayments[customer][contractor].nextPayment != 0) {
                delete customerPayments[customer][contractor];
            }
        }

        delete contractorsData[contractor];

        emit ContractorRemoved(contractor);
    }

    function pay(address customer, address contractor, uint amount, uint duration) external onlyOwner nonReentrant {
        require(contractor != address(0), "Invalid contractor address");
        require(amount > 0, "Invalid amount");
        require(duration > 0, "Invalid duration");

        Contractor storage contractorInfo = contractorsData[contractor];
        require(contractorInfo.nftCollection != address(0), "Contractor not registered");

        Customer storage paymentInfo = customerPayments[customer][contractor];

        bool timeExpired = paymentInfo.nextPayment <= block.timestamp;
        bool firstPayment = paymentInfo.nextPayment == 0;
        bool hasAmount = acceptedToken.balanceOf(customer) >= amount;
        bool hasAllowance = acceptedToken.allowance(customer, address(this)) >= amount;

        if ((timeExpired || firstPayment) && (!hasAmount || !hasAllowance)) {
            if ((!firstPayment) && (INFTCollection(contractorInfo.nftCollection).ownerOf(paymentInfo.tokenId) == customer)) {
                try INFTCollection(contractorInfo.nftCollection).safeTransferFrom(customer, address(this), paymentInfo.tokenId) {
                    emit Revoked(customer, contractor, paymentInfo.tokenId, block.timestamp);
                } catch {
                    revert("Failed to revoke NFT. Customer may not own it.");
                }                
                return;
            } else {
                revert("Insufficient balance and/or allowance.");
            }
        }

        if (firstPayment) {
            INFTCollection(contractorInfo.nftCollection).mint(customer);
            paymentInfo.tokenId = INFTCollection(contractorInfo.nftCollection).getLastTokenId();
            customers.push(customer);
            emit Granted(customer, contractor, paymentInfo.tokenId, block.timestamp);
        }

        // Calculate fee and remaining amount to allocate to the contractor
        uint feeAmount = (amount * feePercentage) / 10000;
        uint contractorAmount = amount - feeAmount;

        // Accumulate fee in the contract
        accumulatedFees += feeAmount;
        emit FeeAccumulated(feeAmount);

        // Accumulate contractor's balance
        contractorInfo.balance += contractorAmount;

        // Transfer payment from customer
        acceptedToken.safeTransferFrom(customer, address(this), amount);

        // Emit "Paid" event for every successful payment
        emit Paid(customer, contractor, block.timestamp, amount, duration);

        // Update the next payment date
        if (firstPayment || timeExpired) {
            paymentInfo.nextPayment = block.timestamp + duration;
        } else {
            paymentInfo.nextPayment += duration;
        }
        paymentInfo.duration = duration;

        if (paymentInfo.nextPayment > block.timestamp && INFTCollection(contractorInfo.nftCollection).ownerOf(paymentInfo.tokenId) != customer) {
            INFTCollection(contractorInfo.nftCollection).safeTransferFrom(
                address(this),
                customer,
                paymentInfo.tokenId
            );

            emit Granted(
                customer,
                contractor,
                paymentInfo.tokenId,
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
