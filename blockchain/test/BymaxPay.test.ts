import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

// Define the test suite for Bymax contract
describe("Bymax", function () {

  // 30 day in seconds
  const thirtyDaysInSeconds = 30 * 24 * 60 * 60;

  // Amount 0.01 BYMAX
  const amount = ethers.parseEther("0.01");

  // Async function to deploy all contracts for tests
  async function deployFixture() {

    // Fetch the contract factory for BymaxPayCoin - Used for tests as payment coin
    const BymaxPayCoin = await ethers.getContractFactory("BymaxPayCoin");

    // Deploy the BymaxPayCoin contract
    const bymaxPayCoin = await BymaxPayCoin.deploy();

    // Wait until BymaxPayCoin is deployed
    await bymaxPayCoin.waitForDeployment();

    // Fetch the contract factory for BymaxPayCollection (Contractor 1)
    const BymaxPayCollection1 = await ethers.getContractFactory("BymaxPayCollection");

    // Deploy the BymaxPayCollection contract for Contractor 1
    const bymaxPayCollectionContractor1 = await BymaxPayCollection1.deploy();

    // Wait until BymaxPayCollectionContractor1 is deployed
    await bymaxPayCollectionContractor1.waitForDeployment();

    // Fetch the contract factory for BymaxPayCollection (Contractor 2)
    const BymaxPayCollection2 = await ethers.getContractFactory("BymaxPayCollection");

    // Deploy the BymaxPayCollection contract for Contractor 2
    const bymaxPayCollectionContractor2 = await BymaxPayCollection2.deploy();

    // Wait until BymaxPayCollectionContractor2 is deployed
    await bymaxPayCollectionContractor2.waitForDeployment();

    // Get the addresses of the deployed collections
    const collectionAddress1 = await bymaxPayCollectionContractor1.getAddress();
    const collectionAddress2 = await bymaxPayCollectionContractor2.getAddress();

    // Fetch the contract factory for BymaxPay
    const BymaxPay = await ethers.getContractFactory("BymaxPay");

    // Get the address of the BymaxPayCoin contract
    const coinAddress = await bymaxPayCoin.getAddress();

    // Deploy BymaxPay contract, passing the coin address
    const bymaxPay = await BymaxPay.deploy(coinAddress);

    // Wait until BymaxPay is deployed
    await bymaxPay.waitForDeployment();

    // Get the address of the BymaxPay contract
    const bymaxPayAddress = await bymaxPay.getAddress();

    // Set the authorized contract address in the BymaxPayCollection contracts
    await bymaxPayCollectionContractor1.setAuthorizedContract(bymaxPayAddress);
    await bymaxPayCollectionContractor2.setAuthorizedContract(bymaxPayAddress);

    // Get the signers (owner, another account, contractor, and other contractor)
    const [owner, account, otherAccount, contractor, otherContractor] = await ethers.getSigners();

    // Mint 1 BYMAX coin for the account
    await bymaxPayCoin.mint(account.address, ethers.parseEther("1"));

    // Mint 1 BYMAX coin for the otherAccount
    await bymaxPayCoin.mint(otherAccount.address, ethers.parseEther("1"));

    // Return all deployed contracts and accounts for use in tests
    return { bymaxPay, bymaxPayAddress, bymaxPayCoin, coinAddress, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2, collectionAddress1, collectionAddress2, owner, account, otherAccount, contractor, otherContractor };  
  }

  // Test case to verify event emission when updating the fee percentage
  it("Should emit FeePercentageUpdated event when updating fee percentage", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, owner } = await loadFixture(deployFixture);

    // Define a new fee percentage (e.g., 2500 = 25%)
    const newFeePercentage = 2500;

    // Expect the transaction to emit the "FeePercentageUpdated" event with the new fee
    await expect(bymaxPay.connect(owner).setFeePercentage(newFeePercentage))
      .to.emit(bymaxPay, "FeePercentageUpdated")
      .withArgs(newFeePercentage);
  });

  // Test case to verify the total number of contractors
  it("Should return the total number of contractors", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, owner, contractor, otherContractor, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register two contractors with their respective NFT collections
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());
    await bymaxPay.connect(owner).addContractor(otherContractor.address, bymaxPayCollectionContractor2.getAddress());

    // Get the total number of contractors
    const totalContractors = await bymaxPay.getTotalContractors();

    // Expect the total number of contractors to be 2
    expect(totalContractors).to.equal(2);
  });

  // Test case to verify the total number of customers
  it("Should return the total number of customers", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherAccount, bymaxPayCollectionContractor1 } = await loadFixture(deployFixture);

    // Register a contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment, associating it with the contractor
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, ethers.parseEther("0.01"), 30 * 24 * 60 * 60);

    // Get the total number of customers
    const totalCustomers = await bymaxPay.getTotalCustomers();

    // Expect the total number of customers to be 1
    expect(totalCustomers).to.equal(1);
  });

  // Test case to prevent payment with zero amount
  it("Should NOT allow payment with zero amount", async function () {
    
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, otherAccount, contractor } = await loadFixture(deployFixture);
    
    // Expect the payment to be reverted with the message "Invalid amount"
    await expect(
      bymaxPay.pay(otherAccount.address, contractor.address, 0, thirtyDaysInSeconds)
    ).to.be.revertedWith("Invalid amount");
  });

  // Test case to prevent payment with zero duration
  it("Should NOT allow payment with zero duration", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, otherAccount, contractor } = await loadFixture(deployFixture);
    
    // Expect the payment to be reverted with the message "Invalid duration"
    await expect(
      bymaxPay.pay(otherAccount.address, contractor.address, amount, 0)
    ).to.be.revertedWith("Invalid duration");
  });

  // Test case for a customer making payments to two different contractors
  it("Should allow customer to pay two different contractors", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Register the second contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(otherContractor.address, bymaxPayCollectionContractor2.getAddress());

    // Connect the BymaxPayCoin contract to the otherAccount (customer)
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve the BymaxPay contract to spend 0.01 BYMAX from otherAccount (customer)
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment from otherAccount to the first contractor
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Check that the customer has the NFT and is associated with the first contractor
    const customerData1 = await bymaxPay.customerPayments(otherAccount.address, contractor.address);
    expect(customerData1.tokenId).to.be.gt(0);

    // Verify that the customer has a new NFT and it's owned by them
    const tokenId1 = customerData1.tokenId;
    expect(await bymaxPayCollectionContractor1.ownerOf(tokenId1)).to.equal(otherAccount.address);

    // Approve sufficient BYMAX for another payment by the second contractor
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.02"));

    // Define new payment parameters for the second contractor
    const newDuration = 60 * 24 * 60 * 60; // 60 days in seconds
    const newAmount = ethers.parseEther("0.02");

    // Perform payment with the second contractor
    await bymaxPay.connect(owner).pay(otherAccount.address, otherContractor.address, newAmount, newDuration);

    // Check if the new contractor is now associated with the customer
    const customerData2 = await bymaxPay.customerPayments(otherAccount.address, otherContractor.address);
    expect(customerData2.tokenId).to.be.gt(0);

    // Verify that the customer has a new NFT and it's owned by them
    const tokenId2 = customerData2.tokenId;
    expect(await bymaxPayCollectionContractor2.ownerOf(tokenId2)).to.equal(otherAccount.address);
  });

  // Test case to handle the first payment
  it("Should do first payment", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Expect the payment to emit a "Granted" event
    await expect(bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds)).to.emit(bymaxPay, "Granted");
  });

  // Test case for insufficient balance or allowance for payment
  it("Should NOT do first payment", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Expect the payment to be reverted with an "Insufficient balance and/or allowance" error
    await expect(bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds)).to.be.revertedWith("Insufficient balance and/or allowance.");  
  });

  // Test case to handle the second payment after the first one
  it("Should do second payment", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.02 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.02"));

    // Perform the first payment
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Simulate the passage of 31 days
    await time.increase(31 * 24 * 60 * 60);

    // Expect the second payment to emit a "Paid" event
    await expect(bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds)).to.emit(bymaxPay, "Paid");
  });

  // Test case where the second payment should fail due to insufficient balance
  it("Should NOT do second payment", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Simulate the passage of 31 days
    await time.increase(31 * 24 * 60 * 60);

    // Approve a small amount (less than required) for the second payment
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.00001"));

    // Expect the second payment to emit a "Revoked" event
    await expect(bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds)).to.emit(bymaxPay, "Revoked");
  });

  // Test case for get the list of customers
  it("Should return the list of customers", async function () {
    
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Approve sufficient tokens for the first payment
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment to register the customer
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Call the getCustomers function and get the customer addresses and data
    const [customerAddresses, customerData] = await bymaxPay.getCustomers(10,0);

    // Verify that the customer was registered correctly
    expect(customerAddresses).to.include(otherAccount.address);
  });

  // Test case for getting the paginated list of customers
  it("Should return the paginated list of customers", async function () {
    
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, account, otherAccount, contractor, otherContractor, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register two contractors with their respective NFT collections
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());
    await bymaxPay.connect(owner).addContractor(otherContractor.address, bymaxPayCollectionContractor2.getAddress());

    // Approve sufficient tokens for the first payment
    const instance1 = bymaxPayCoin.connect(account);
    const instance2 = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from each customer
    await instance1.approve(bymaxPayAddress, ethers.parseEther("0.01"));
    await instance2.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform payments to register both customers
    await bymaxPay.connect(owner).pay(account.address, contractor.address, amount, thirtyDaysInSeconds);
    await bymaxPay.connect(owner).pay(otherAccount.address, otherContractor.address, amount, thirtyDaysInSeconds);

    // Get the first page of customers (limit 1, skip 0)
    let [customerAddresses, customerData] = await bymaxPay.getCustomers(1, 0);

    // Verify the first page contains the first customer
    expect(customerAddresses.length).to.equal(1);
    expect(customerAddresses[0]).to.equal(account.address);

    // Get the second page of customers (limit 1, skip 1)
    [customerAddresses, customerData] = await bymaxPay.getCustomers(1, 1);

    // Verify the second page contains the second customer
    expect(customerAddresses.length).to.equal(1);
    expect(customerAddresses[0]).to.equal(otherAccount.address);

    // Get all customers (limit 10, skip 0) to ensure both are registered
    [customerAddresses, customerData] = await bymaxPay.getCustomers(10, 0);

    // Verify both customers are present
    expect(customerAddresses.length).to.equal(2);
    expect(customerAddresses).to.include(account.address);
    expect(customerAddresses).to.include(otherAccount.address);
  });

  // Test case for successfully getting a customer with valid details
  it("Should return customer details successfully", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve sufficient tokens for payment
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment to register the customer
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Fetch the customer details using getCustomer function
    const customerData = await bymaxPay.getCustomer(otherAccount.address);

    // Verify that the customer details are correct
    expect(customerData[0].tokenId).to.be.a('bigint');
    expect(customerData[0].nextPayment).to.be.a('bigint');
    expect(customerData[0].duration).to.equal(thirtyDaysInSeconds);
  });

  // Test case for failing to return customer details for a non-existent customer
  it("Should return an empty list for non-existent customer", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, otherAccount } = await loadFixture(deployFixture);

    // Fetch the details of a customer that has not been registered
    const customerPayments = await bymaxPay.getCustomer(otherAccount.address);

    // Check if the returned customer details array is empty
    expect(customerPayments.length).to.equal(0);
  });

  // Test case to handle removal of a non-existing customer
  it("Should fail to remove a non-existing customer", async function () {

    // Load the deployed fixture
    const { bymaxPay, owner, otherAccount } = await loadFixture(deployFixture);

    // Expect the removal of a non-existing customer to be reverted
    await expect(bymaxPay.connect(owner).removeCustomer(otherAccount.address))
      .to.be.revertedWith("Customer does not exist");
  });

  // Test case to prevent removal of a customer with active NFT access
  it("Should fail to remove a customer with active NFT access", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherAccount, bymaxPayCollectionContractor1 } = await loadFixture(deployFixture);

    // Register the contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Connect the BymaxPayCoin contract to the otherAccount (customer)
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve the BymaxPay contract to spend 0.01 BYMAX from otherAccount (customer)
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment from otherAccount by contractor
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Check that the customer has the NFT and is associated with the contractor
    const customerData = await bymaxPay.getCustomerDetails(otherAccount.address, contractor);
    const tokenId = customerData.tokenId;
    expect(await bymaxPayCollectionContractor1.ownerOf(tokenId)).to.equal(otherAccount.address);

    // Attempt to remove the customer and expect the transaction to be reverted
    await expect(bymaxPay.connect(owner).removeCustomer(otherAccount.address))
      .to.be.revertedWith("Customer still has active access in a contractor");
  });
  
  // Test case for getting the paginated list of contractors
  it("Should return the paginated list of contractors", async function () {
      
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, owner, contractor, otherContractor, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register two contractors with their respective NFT collections
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());
    await bymaxPay.connect(owner).addContractor(otherContractor.address, bymaxPayCollectionContractor2.getAddress());

    // Get the first page of contractors (limit 1, skip 0)
    let [contractorAddresses, balances, nftCollections] = await bymaxPay.getContractors(1, 0);

    // Verify the first page contains the first contractor
    expect(contractorAddresses.length).to.equal(1);
    expect(contractorAddresses[0]).to.equal(contractor.address);

    // Get the second page of contractors (limit 1, skip 1)
    [contractorAddresses, balances, nftCollections] = await bymaxPay.getContractors(1, 1);

    // Verify the second page contains the second contractor
    expect(contractorAddresses.length).to.equal(1);
    expect(contractorAddresses[0]).to.equal(otherContractor.address);

    // Get all contractors (limit 10, skip 0) to ensure both are registered
    [contractorAddresses, balances, nftCollections] = await bymaxPay.getContractors(10, 0);

    // Verify both contractors are present
    expect(contractorAddresses.length).to.equal(2);
    expect(contractorAddresses).to.include(contractor.address);
    expect(contractorAddresses).to.include(otherContractor.address);
  });

  // Test case to check contractor's balance
  it("Should return the contractor's balance", async function () {
    
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Verify the initial balance of the contractor is zero
    const initialBalance = await bymaxPay.connect(contractor).getContractorBalance();
    expect(initialBalance).to.equal(0);

    // Perform a payment to increase contractor's balance
    const instance = bymaxPayCoin.connect(otherAccount);
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Check updated contractor balance
    const updatedBalance = await bymaxPay.connect(contractor).getContractorBalance();
    expect(updatedBalance).to.equal(ethers.parseEther("0.0095")); // Considering 5% fee deduction
  });

  // Test case to check contractor's NFT collection
  it("Should return the contractor's NFT collection address", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, owner, contractor, bymaxPayCollectionContractor1 } = await loadFixture(deployFixture);

    // Register the contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Get the contractor's NFT collection address
    const nftCollectionAddress = await bymaxPay.connect(contractor).getContractorNFTCollection();

    // Verify the NFT collection address is correct
    expect(nftCollectionAddress).to.equal(await bymaxPayCollectionContractor1.getAddress());
  });

  // Test case for removing a contractor
  it("Should remove contractor after balance is zero", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Approve sufficient tokens for the first payment
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));
    
    // Make the contractor receive a payment to increase balance
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Contractor tries to withdraw balance
    await bymaxPay.connect(contractor).withdrawContractorBalance();

    // Verify contractor's balance is zero
    const contractorBalanceAfterWithdrawal = await bymaxPay.connect(contractor).getContractorBalance();
    expect(contractorBalanceAfterWithdrawal).to.equal(0);

    // Remove the contractor after the balance is zero
    await bymaxPay.connect(owner).removeContractor(contractor.address);

    // Verify that the contractor has been removed from the list
    let [contractorsArray, balancesArray] = await bymaxPay.getContractors(10,0);
    expect(contractorsArray).to.not.include(contractor.address);
  });
  
  // Test case for NOT removing a contractor
  it("Should NOT remove contractor with non-zero balance", async function () {
  
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());
  
    // Approve sufficient tokens for the first payment
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));
    
    // Simulate payment to the contractor to give them a balance
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);
  
    // Verify the balance of the contractor before withdrawal
    const contractorBalance = await bymaxPay.connect(contractor).getContractorBalance();
    expect(contractorBalance).to.be.gt(0);
  
    // Attempt to remove the contractor and expect the transaction to be reverted
    await expect(bymaxPay.connect(owner).removeContractor(contractor.address))
      .to.be.revertedWith("Contractor has a balance");
  });

  // Test case to allow contractor to withdraw balance
  it("Should allow contractor to withdraw balance", async function () {
    
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());
  
    // Connect BymaxPayCoin to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);
  
    // Approve 0.01 BYMAX for payment
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));
  
    // Perform the payment
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);
  
    // Verify the balance of the contractor before withdrawal
    const contractorBalance = await bymaxPay.connect(contractor).getContractorBalance();
    expect(contractorBalance).to.be.gt(0);
  
    // Expect contractor to withdraw their balance
    await expect(bymaxPay.connect(contractor).withdrawContractorBalance())
      .to.emit(bymaxPay, "WithdrawnContractorBalance")
      .withArgs(contractorBalance, contractor.address);
  });

  // Test case to correctly calculate and distribute fees
  it("Should correctly calculate and distribute fees", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());
    
    // Fetch the current fee percentage
    const feePercentage = await bymaxPay.feePercentage();
    
    // Calculate the expected fee based on the current fee percentage
    const expectedFee = (amount * BigInt(feePercentage)) / BigInt(10000);
    
    // Calculate the contractor's expected amount after deducting the fee
    const expectedContractorAmount = amount - expectedFee;

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);
    
    // Approve BymaxPay contract to spend the specified amount from otherAccount
    await instance.approve(bymaxPayAddress, amount);

    // Perform the payment and expect the balances and fees to update accordingly
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Verify that the accumulated fees in the contract match the expected fee
    const accumulatedFees = await bymaxPay.accumulatedFees();
    expect(accumulatedFees).to.equal(expectedFee);

    // Verify that the contractor's balance matches the expected contractor amount
    const contractorBalance = await bymaxPay.connect(contractor).getContractorBalance();
    expect(contractorBalance).to.equal(expectedContractorAmount);
  });

  // Test case to update the fee percentage and verify its correct application
  it("Should update fee percentage and apply new fee correctly", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Set a new fee percentage of 10%
    const newFeePercentage = 1000; // 10%
    await bymaxPay.connect(owner).setFeePercentage(newFeePercentage);

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);
    
    // Approve BymaxPay contract to spend the specified amount from otherAccount
    await instance.approve(bymaxPayAddress, amount);

    // Perform the payment and expect the balances and fees to update according to the new fee
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Calculate the expected fee based on the new fee percentage
    const expectedFee = (amount * BigInt(newFeePercentage)) / BigInt(10000);
    
    // Calculate the contractor's expected amount after deducting the new fee
    const expectedContractorAmount = amount - expectedFee;

    // Verify that the accumulated fees match the expected fee after applying the new percentage
    const accumulatedFees = await bymaxPay.accumulatedFees();
    expect(accumulatedFees).to.equal(expectedFee);

    // Verify that the contractor's balance matches the expected contractor amount after the fee
    const contractorBalance = await bymaxPay.connect(contractor).getContractorBalance();
    expect(contractorBalance).to.equal(expectedContractorAmount);
  });

  // Test case for withdrawing accumulated fees by the owner
  it("Should allow owner to withdraw fees", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve 0.01 BYMAX for payment
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the payment
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Expect owner to withdraw accumulated fees
    await expect(bymaxPay.connect(owner).withdrawFees()).to.emit(bymaxPay, "WithdrawnFees");
  });

  // Test case for preventing non-owner from withdrawing accumulated fees
  it("Should NOT allow non-owner to withdraw fees", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve 0.01 BYMAX for payment
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the payment to accumulate fees
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Attempt to withdraw fees as a non-owner account (otherAccount) and expect the transaction to be reverted
    await expect(bymaxPay.connect(otherAccount).withdrawFees()).to.be.revertedWithCustomError(bymaxPay, "OwnableUnauthorizedAccount")
    .withArgs(otherAccount.address);
  });

  // Test case for handling the second payment after a revoke
  it("Should do second payment after revoke", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Simulate the passage of 31 days and revoke the NFT due to insufficient payment
    await time.increase(31 * 24 * 60 * 60);
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.00001")); // Approve insufficient amount
    await expect(bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds)).to.emit(bymaxPay, "Revoked");

    // Approve sufficient BYMAX for payment after revocation
    await instance.approve(bymaxPayAddress, ethers.parseEther("1"));

    // Perform the second payment after revocation and expect "Granted" event
    await expect(bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds)).to.emit(bymaxPay, "Granted");

    // Fetch the updated payment info for the customer
    const payment = await bymaxPay.getCustomerDetails(otherAccount.address, contractor);

    // Verify that the customer now owns the NFT again
    expect(await bymaxPayCollectionContractor1.ownerOf(payment.tokenId)).to.equal(otherAccount.address);
  });

  // Test case to handle removal of a customer and revoke of the NFT
  it("Should remove customer and revoke NFT", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment, associating it with the contractor
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Fetch payment info for the customer (otherAccount)
    let customer = await bymaxPay.getCustomerDetails(otherAccount.address, contractor);

    // Verify that the customer owns the NFT (tokenId is valid)
    expect(await bymaxPayCollectionContractor1.ownerOf(customer.tokenId)).to.equal(otherAccount.address);

    // Simulate the passage of 31 days
    await time.increase(31 * 24 * 60 * 60);

    // Perform the second payment and revoke the NFT due to insufficient payment
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);
    
    // Owner removes the customer
    await bymaxPay.connect(owner).removeCustomer(otherAccount.address);

    // Fetch payment info for the customer (otherAccount)
    customer = await bymaxPay.getCustomerDetails(otherAccount.address, contractor);

    // Expect the NFT to no longer exist after being burned
    expect(customer.tokenId).to.equal(0);
  });

  // Test case to handle overpayment and accumulate future access time
  it("Should handle overpayment and accumulate future access time", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve sufficient BYMAX (0.02 BYMAX) for multiple payments (overpayment)
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.02"));

    // Perform the first payment, associating it with the contractor
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Fetch the initial next payment time after the first payment
    let payment = await bymaxPay.getCustomerDetails(otherAccount.address, contractor);
    const initialNextPaymentTime = BigInt(payment.nextPayment);

    // Simulate the passage of 15 days
    await time.increase(15 * 24 * 60 * 60);

    // Perform the second payment, which accumulates future access time
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Fetch the updated next payment time after the second payment
    payment = await bymaxPay.getCustomerDetails(otherAccount.address, contractor);
    const updatedNextPaymentTime = BigInt(payment.nextPayment);

    // Verify that the next payment time has been correctly updated and accumulated
    expect(updatedNextPaymentTime).to.equal(initialNextPaymentTime + BigInt(thirtyDaysInSeconds));
  });
  
  // Test case to handle transferring an NFT back to a customer after revocation and payment
  it("Should transfer NFT back to customer after revoked and payment", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollectionContractor1, bymaxPayCollectionContractor2 } = await loadFixture(deployFixture);

    // Register the first contractor with its NFT collection
    await bymaxPay.connect(owner).addContractor(contractor.address, bymaxPayCollectionContractor1.getAddress());

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment, associating it with the contractor
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Fetch payment info and check that the NFT was minted to the customer
    let payment = await bymaxPay.getCustomerDetails(otherAccount.address, contractor);
    expect(await bymaxPayCollectionContractor1.ownerOf(payment.tokenId)).to.equal(otherAccount.address);

    // Simulate the passage of 31 days and revoke the NFT due to insufficient payment
    await time.increase(31 * 24 * 60 * 60);
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.00001")); // Approve insufficient amount
    await expect(bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds)).to.emit(bymaxPay, "Revoked");

    // Check that the contract now owns the NFT after revocation
    expect(await bymaxPayCollectionContractor1.ownerOf(payment.tokenId)).to.equal(bymaxPayAddress);

    // Approve sufficient BYMAX (1 BYMAX) for payment after revocation
    await instance.approve(bymaxPayAddress, ethers.parseEther("1"));

    // Perform the second payment after revocation
    await expect(bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds)).to.emit(bymaxPay, "Granted");

    // Fetch the updated payment info and check the owner of the NFT
    payment = await bymaxPay.getCustomerDetails(otherAccount.address, contractor);

    // Verify that the customer now owns the NFT again
    expect(await bymaxPayCollectionContractor1.ownerOf(payment.tokenId)).to.equal(otherAccount.address);
  });
});
