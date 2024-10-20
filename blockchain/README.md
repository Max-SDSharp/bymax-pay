# BymaxPay - Decentralized Payment Management

BymaxPay is a smart contract-based recurring payment management system designed to facilitate automated payments using ERC20 tokens and access control with NFT-based licenses. It allows contractors to own their NFT collection, manage customer payments, and handle token withdrawals securely.

## Table of Contents

- [Project Overview](#project-overview)
- [Contract Structure](#contract-structure)
- [Features](#features)
- [Installation](#installation)
- [Deployment](#deployment)
- [Usage](#usage)
- [Testing](#testing)
- [License](#license)

## Project Overview

BymaxPay is a Solidity-based smart contract that supports multiple contractors, each with their own NFT collections for granting access. Customers can be associated with multiple contractors and make payments for services or subscriptions. The contract manages payments, access permissions, and balances for contractors while ensuring security and preventing unauthorized access.

## Contract Structure

The smart contract has the following main components:

1. **BymaxPay.sol**: 
   - Manages the main payment system.
   - Handles contractor registration and customer payments.
   - Supports multiple contractors and NFT collections for each.
   - Manages fee accumulation and withdrawals.

2. **BymaxPayCollection.sol**:
   - Manages the NFT collection for each contractor. 
   - It enables minting, burning, and transferring of NFTs, which are used to control customer access to each contractor’s services.

3. **INFTCollection.sol**:
   - Interface for the NFT collection contract, which includes minting, burning, and transferring of NFTs for customer access control.

4. **BymaxPayCoin.sol**:
   - ERC20 token used for transactions within the BymaxPay system.

## Features

- **Multi-Contractor Support**: 
  - Allows multiple contractors to register their own NFT collections.
  - Customers can be associated with multiple contractors simultaneously.

- **NFT-Based Access**: 
  - Each contractor manages access through an NFT collection.
  - NFTs are minted and burned based on customer payments.

- **Payment Management**: 
  - Supports automated payments for customers with dynamic durations and amounts.
  - Manages balances and withdrawals for contractors.
  - Allows fee percentage adjustment by the owner.

- **Security and Flexibility**: 
  - Uses reentrancy protection and secure ERC20 token transfers.
  - Allows contract owner to withdraw accumulated fees.

- **Pagination**: 
  - Supports paginated retrieval of contractors and customers.

## Installation

To set up the project locally, follow these steps:

1. Clone the repository:

   ```
   git clone <repository-url>
   cd bymax-pay
   ```

2. Install the necessary dependencies:

   ```
   npm install
   ```

3. Set up environment variables in a .env file:

   ```
   INFURA_API_KEY=<your-infura-api-key>
   API_KEY=<your-etherscan/block-explorer-api-key>
   CHAIN_ID=<your-blockchain-chain-id>
   SECRET=<your-12-word-mnemonic-phrase>
   ```

## Deployment

To deploy the contracts, use Hardhat:

1. Compile the contracts:

   ```
   npm run compile
   ```

2. Deploy the contracts:

   ```
   npm run deploy
   ```

3. Verify contract deployment (BymaxPayCoin, BymaxPayCollection):

   ```
   npx hardhat verify --network polygon <contract-address>
   ```

4. Verify contract deployment (BymaxPay):

   ```
   npx hardhat verify --network polygon <contract-address> <token-accepted-address>
   ```

## Usage

Contractor Registration

Contractors can be registered with their own NFT collections:

   ```
   addContractor(address contractorAddress, address nftCollection);
   ```

Customer Payments

Customers can make payments for services:

   ```
   pay(address customer, address contractor, uint amount, uint duration);
   ```

Fee Management

The owner can set the fee percentage or withdraw accumulated fees:

   ```
   setFeePercentage(uint newFee);
   withdrawFees();
   ```

## Testing

The project uses the Hardhat framework for testing. To run the test suite:

1. Run the tests:

   ```
   npm run test
   ```

## License

This project is licensed under the MIT License. See the LICENSE file for more details.
