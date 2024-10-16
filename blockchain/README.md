# Bymax Pay Project

Welcome to the **Bymax Pay** system, a decentralized application built to facilitate payments and NFT management on the Polygon blockchain. This project leverages smart contracts for handling transactions, managing a native token (BymaxPayCoin), and an NFT collection (BymaxPayCollection), ensuring seamless and secure interactions.

## Project Overview

The Bymax Pay system consists of three primary smart contracts:
- **BymaxPayCoin**: A custom ERC20 token used for payments within the system.
- **BymaxPayCollection**: An ERC721 NFT contract that handles a collection of NFTs, which can be minted and burned based on user activity.
- **BymaxPay**: The core contract that facilitates payments, manages customer subscriptions, and interacts with both the BymaxPayCoin and BymaxPayCollection contracts.

The system is designed to handle:
- Customer registration via payments using BymaxPayCoin.
- NFT minting upon customer registration and revoking after subscription expiration.
- Management of overpayments by accumulating extra access time for customers.

---

## Installation and Setup

Before diving into the contracts and deployment, ensure you have the following installed:

1. **Node.js**: Install [Node.js](https://nodejs.org) if you haven’t already.
2. **Hardhat**: The project uses [Hardhat](https://hardhat.org/) for compiling, testing, and deploying contracts.

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/bymax-pay.git
   cd bymax-pay

   