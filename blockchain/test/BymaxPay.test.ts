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

  // Fetch the contract factory for BymaxPayCollection
  const BymaxPayCollection = await ethers.getContractFactory("BymaxPayCollection");

  // Deploy the BymaxPayCollection contract
  const bymaxPayCollection = await BymaxPayCollection.deploy();

  // Wait until BymaxPayCollection is deployed
  await bymaxPayCollection.waitForDeployment();

  // Get the address of the deployed collection
  const collectionAddress = await bymaxPayCollection.getAddress();

  // Fetch the contract factory for BymaxPay
  const BymaxPay = await ethers.getContractFactory("BymaxPay");

  // Get the address of the BymaxPayCoin contract
  const coinAddress = await bymaxPayCoin.getAddress();

  // Deploy BymaxPay contract, passing the coin and collection addresses
  const bymaxPay = await BymaxPay.deploy(coinAddress, collectionAddress);

  // Wait until BymaxPay is deployed
  await bymaxPay.waitForDeployment();

  // Get the address of the BymaxPay contract
  const bymaxPayAddress = await bymaxPay.getAddress();

  // Set the authorized contract address in the BymaxPayCollection contract
  await bymaxPayCollection.setAuthorizedContract(bymaxPayAddress);

  // Get the signers (owner, another account, and contractor)
  const [owner, otherAccount, contractor, otherContractor] = await ethers.getSigners();

  // Mint 1 BYMAX coin for the otherAccount
  await bymaxPayCoin.mint(otherAccount.address, ethers.parseEther("1"));

  // Return all deployed contracts and accounts for use in tests
  return { bymaxPay, bymaxPayAddress, bymaxPayCoin, coinAddress, bymaxPayCollection, collectionAddress, owner, otherAccount, contractor, otherContractor };  }

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

  // Test case to prevent a different contractor from charging a customer
  it("Should NOT allow a different contractor to charge a customer", async function () {
    
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount } = await loadFixture(deployFixture);

    // Connect the BymaxPayCoin contract to the otherAccount (customer)
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve the BymaxPay contract to spend 0.01 BYMAX from otherAccount (customer)
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment from otherAccount by contractor
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Check that the payment was successful and the customer is associated with the contractor
    const customerData = await bymaxPay.payments(otherAccount.address);
    expect(customerData.contractor).to.equal(contractor.address);

    // Try to perform a payment from otherAccount by a different contractor (otherContractor)
    const newAmount = ethers.parseEther("0.02");
    const newDuration = 60 * 24 * 60 * 60; // 60 days in seconds

    // Expect the transaction to revert with the error "Customer already associated with another contractor"
    await expect(
      bymaxPay.connect(owner).pay(otherAccount.address, otherContractor.address, newAmount, newDuration)
    ).to.be.revertedWith("Customer already associated with another contractor");
  });

  // Test case for removing a customer and allowing a different contractor to charge them after removal
  it("Should remove customer and allow another contractor to charge them", async function () {
    
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherContractor, otherAccount, bymaxPayCollection } = await loadFixture(deployFixture);

    // Connect the BymaxPayCoin contract to the otherAccount (customer)
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve the BymaxPay contract to spend 0.01 BYMAX from otherAccount (customer)
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment from otherAccount by contractor
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Check that the customer has the NFT and is associated with the contractor
    const customerData = await bymaxPay.payments(otherAccount.address);
    expect(customerData.contractor).to.equal(contractor.address);

    const tokenId = customerData.tokenId;
    expect(await bymaxPayCollection.ownerOf(tokenId)).to.equal(otherAccount.address);

    // Remove the customer (which should also burn the NFT)
    await bymaxPay.connect(owner).removeCustomer(otherAccount.address);

    // Check that the customer no longer owns the NFT
    await expect(bymaxPayCollection.ownerOf(tokenId)).to.be.revertedWithCustomError(bymaxPayCollection, "ERC721NonexistentToken")
    .withArgs(tokenId);

    // Approve sufficient BYMAX for another payment by a new contractor (otherContractor)
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.02"));

    // New payment from otherContractor
    const newDuration = 60 * 24 * 60 * 60; // 60 days in seconds
    const newAmount = ethers.parseEther("0.02");

    // Perform payment with the new contractor
    await bymaxPay.connect(owner).pay(otherAccount.address, otherContractor.address, newAmount, newDuration);

    // Check if the new contractor is now associated with the customer
    const newCustomerData = await bymaxPay.payments(otherAccount.address);
    expect(newCustomerData.contractor).to.equal(otherContractor.address);

    // Verify that the customer has a new NFT and it's owned by them
    const newTokenId = newCustomerData.tokenId;
    expect(await bymaxPayCollection.ownerOf(newTokenId)).to.equal(otherAccount.address);
  });
  
  // Test case to handle the first payment
  it("Should do first payment", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, contractor } = await loadFixture(deployFixture);
    
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
    const { bymaxPay, otherAccount, contractor } = await loadFixture(deployFixture);

    // Expect the payment to be reverted with an "Insufficient balance and/or allowance" error
    await expect(bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds)).to.be.revertedWith("Insufficient balance and/or allowance.");  
  });

  // Test case to handle the second payment after the first one
  it("Should do second payment", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, contractor } = await loadFixture(deployFixture);

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
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, contractor } = await loadFixture(deployFixture);

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
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, owner, contractor } = await loadFixture(deployFixture);

    // Approve sufficient tokens for the first payment
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment to register the customer
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Call the getCustomers function and get the customer addresses and data
    const [customerAddresses, customerData] = await bymaxPay.getCustomers();

    // Verify that the customer was registered correctly
    expect(customerAddresses).to.include(otherAccount.address);
  });
  
  // Test case for removing a contractor
  it("Should remove contractor after balance is zero", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, owner, contractor } = await loadFixture(deployFixture);

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
    let [contractorsArray, balancesArray] = await bymaxPay.getContractors();
    expect(contractorsArray).to.not.include(contractor.address);
  });
  
  // Test case for NOT removing a contractor
  it("Should NOT remove contractor with non-zero balance", async function () {
  
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherAccount } = await loadFixture(deployFixture);
  
    // Approve sufficient tokens for the first payment
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));
    
    // Simulate payment to the contractor to give them a balance
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);
  
    // Verify that the contractor's balance is greater than 0
    const contractorData = await bymaxPay.contractorsData(contractor.address);
    expect(contractorData).to.be.gt(0);
  
    // Attempt to remove the contractor and expect the transaction to be reverted
    await expect(bymaxPay.connect(owner).removeContractor(contractor.address))
      .to.be.revertedWith("Contractor has a balance");
  });

  // Test case to allow contractor to withdraw balance
  it("Should allow contractor to withdraw balance", async function () {
    
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, contractor } = await loadFixture(deployFixture);
  
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
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, contractor } = await loadFixture(deployFixture);
    
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
    const contractorBalance = await bymaxPay.contractorsData(contractor.address);
    expect(contractorBalance).to.equal(expectedContractorAmount);
  });

  // Test case to update the fee percentage and verify its correct application
  it("Should update fee percentage and apply new fee correctly", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, otherAccount, contractor } = await loadFixture(deployFixture);

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
    const contractorBalance = await bymaxPay.contractorsData(contractor.address);
    expect(contractorBalance).to.equal(expectedContractorAmount);
  });

  // Test case for withdrawing accumulated fees by the owner
  it("Should allow owner to withdraw fees", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, owner, contractor } = await loadFixture(deployFixture);

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
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, owner, contractor } = await loadFixture(deployFixture);

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
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, bymaxPayCollection, otherAccount, contractor } = await loadFixture(deployFixture);

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
    const payment = await bymaxPay.payments(otherAccount.address);

    // Verify that the customer now owns the NFT again
    expect(await bymaxPayCollection.ownerOf(payment.tokenId)).to.equal(otherAccount.address);
  });

  // Test case to handle removal of a customer and burning of the NFT
  it("Should remove customer and burn NFT", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, bymaxPayCollection, otherAccount, owner, contractor } = await loadFixture(deployFixture);

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment, associating it with the contractor
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Fetch payment info for the customer (otherAccount)
    const payment = await bymaxPay.payments(otherAccount.address);

    // Verify that the customer owns the NFT (tokenId is valid)
    expect(await bymaxPayCollection.ownerOf(payment.tokenId)).to.equal(otherAccount.address);

    // Owner removes the customer and burns the NFT
    await bymaxPay.connect(owner).removeCustomer(otherAccount.address);

    // Expect the NFT to no longer exist after being burned
    await expect(bymaxPayCollection.ownerOf(payment.tokenId)).to.be.revertedWithCustomError(bymaxPayCollection, "ERC721NonexistentToken")
        .withArgs(payment.tokenId);
  });

  // Test case to handle overpayment and accumulate future access time
  it("Should handle overpayment and accumulate future access time", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, contractor } = await loadFixture(deployFixture);

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve sufficient BYMAX (0.02 BYMAX) for multiple payments (overpayment)
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.02"));

    // Perform the first payment, associating it with the contractor
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Fetch the initial next payment time after the first payment
    let payment = await bymaxPay.payments(otherAccount.address);
    const initialNextPaymentTime = BigInt(payment.nextPayment);

    // Simulate the passage of 15 days
    await time.increase(15 * 24 * 60 * 60);

    // Perform the second payment, which accumulates future access time
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Fetch the updated next payment time after the second payment
    payment = await bymaxPay.payments(otherAccount.address);
    const updatedNextPaymentTime = BigInt(payment.nextPayment);

    // Verify that the next payment time has been correctly updated and accumulated
    expect(updatedNextPaymentTime).to.equal(initialNextPaymentTime + BigInt(thirtyDaysInSeconds));
  });
  
  // Test case to handle removal of a non-existing customer gracefully
  it("Should handle removal of non-existing customer gracefully", async function () {

    // Load the deployed fixture
    const { bymaxPay, owner, otherAccount } = await loadFixture(deployFixture);

    // Expect the removal of a non-existing customer to be reverted
    await expect(bymaxPay.connect(owner).removeCustomer(otherAccount.address)).to.be.revertedWith("Customer does not exist");
  });

  // Test case to handle transferring an NFT back to a customer after revocation and payment
  it("Should transfer NFT back to customer after revoked and payment", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, bymaxPayCollection, otherAccount, contractor } = await loadFixture(deployFixture);

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment, associating it with the contractor
    await bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds);

    // Fetch payment info and check that the NFT was minted to the customer
    let payment = await bymaxPay.payments(otherAccount.address);
    expect(await bymaxPayCollection.ownerOf(payment.tokenId)).to.equal(otherAccount.address);

    // Simulate the passage of 31 days and revoke the NFT due to insufficient payment
    await time.increase(31 * 24 * 60 * 60);
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.00001")); // Approve insufficient amount
    await expect(bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds)).to.emit(bymaxPay, "Revoked");

    // Check that the contract now owns the NFT after revocation
    expect(await bymaxPayCollection.ownerOf(payment.tokenId)).to.equal(bymaxPayAddress);

    // Approve sufficient BYMAX (1 BYMAX) for payment after revocation
    await instance.approve(bymaxPayAddress, ethers.parseEther("1"));

    // Perform the second payment after revocation
    await expect(bymaxPay.pay(otherAccount.address, contractor.address, amount, thirtyDaysInSeconds)).to.emit(bymaxPay, "Granted");

    // Fetch the updated payment info and check the owner of the NFT
    payment = await bymaxPay.payments(otherAccount.address);

    // Verify that the customer now owns the NFT again
    expect(await bymaxPayCollection.ownerOf(payment.tokenId)).to.equal(otherAccount.address);
  });
});
