import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

// Define the test suite for Bymax contract
describe("Bymax", function () {

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
    const [owner, otherAccount, contractor] = await ethers.getSigners();

    // Mint 1 BYMAX coin for the otherAccount
    await bymaxPayCoin.mint(otherAccount.address, ethers.parseEther("1"));

    // Return all deployed contracts and accounts for use in tests
    return { bymaxPay, bymaxPayAddress, bymaxPayCoin, coinAddress, bymaxPayCollection, collectionAddress, owner, otherAccount, contractor };  }

  // Test case to handle the first payment
  it("Should do first payment", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, contractor } = await loadFixture(deployFixture);
    
    // Set the contractor's monthly payment amount to 0.01 BYMAX
    await bymaxPay.setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.01"));

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Expect the payment to emit a "Granted" event
    await expect(bymaxPay.pay(otherAccount.address, contractor.address)).to.emit(bymaxPay, "Granted");
  });

  // Test case for insufficient balance or allowance for payment
  it("Should NOT do first payment", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, otherAccount, contractor } = await loadFixture(deployFixture);

    // Set the contractor's monthly payment amount to 0.01 BYMAX
    await bymaxPay.setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.01"));

    // Expect the payment to be reverted with an "Insufficient balance and/or allowance" error
    await expect(bymaxPay.pay(otherAccount.address, contractor.address)).to.be.revertedWith("Insufficient balance and/or allowance.");  
  });

  // Test case to handle the second payment after the first one
  it("Should do second payment", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, contractor } = await loadFixture(deployFixture);

    // Set the contractor's monthly payment amount to 0.01 BYMAX
    await bymaxPay.setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.01"));

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.02 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.02"));

    // Perform the first payment
    await bymaxPay.pay(otherAccount.address, contractor.address);

    // Simulate the passage of 31 days
    await time.increase(31 * 24 * 60 * 60);

    // Expect the second payment to emit a "Paid" event
    await expect(bymaxPay.pay(otherAccount.address, contractor.address)).to.emit(bymaxPay, "Paid");
  });

  // Test case where the second payment should fail due to insufficient balance
  it("Should NOT do second payment", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, contractor } = await loadFixture(deployFixture);

    // Set the contractor's monthly payment amount to 0.01 BYMAX
    await bymaxPay.setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.01"));

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment
    await bymaxPay.pay(otherAccount.address, contractor.address);

    // Simulate the passage of 31 days
    await time.increase(31 * 24 * 60 * 60);

    // Approve a small amount (less than required) for the second payment
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.00001"));

    // Expect the second payment to emit a "Revoked" event
    await expect(bymaxPay.pay(otherAccount.address, contractor.address)).to.emit(bymaxPay, "Revoked");
  });

  // Test case for get the list of customers
  it("Should return the list of customers", async function () {
    
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, owner, contractor } = await loadFixture(deployFixture);

    // Set the contractor's monthly payment amount to 0.01 BYMAX
    await bymaxPay.setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.01"));

    // Approve sufficient tokens for the first payment
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment to register the customer
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address);

    // Call the getCustomers function and verify that otherAccount is in the customer list
    const customers = await bymaxPay.getCustomers();
    
    // Verify that the customer was registered correctly
    expect(customers).to.include(otherAccount.address);
  });
  
  // Test case for allowing the owner to set a new contractor monthly amount
  it("Should allow owner to set contractor monthly amount", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, owner, contractor } = await loadFixture(deployFixture);

    // Owner sets a new contractor monthly amount to 0.002 BYMAX
    await bymaxPay.connect(owner).setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.002"));

    // Fetch contractor's data (struct with balance and monthlyAmount)
    const contractorData = await bymaxPay.contractorsData(contractor.address);

    // Verify that the contractor's monthly amount has been updated
    expect(contractorData.monthlyAmount).to.equal(ethers.parseEther("0.002"));
  });

  // Test case to prevent non-owner accounts from setting a monthly payment amount
  it("Should prevent non-owner from setting monthly payment amount", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, otherAccount, contractor } = await loadFixture(deployFixture);

    // Attempt to set contractor monthly amount using otherAccount (non-owner)
    // Expect the transaction to be reverted with a custom error or Ownable error
    await expect(
        bymaxPay.connect(otherAccount).setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.002"))
    ).to.be.revertedWithCustomError(bymaxPay, "OwnableUnauthorizedAccount")
      .withArgs(otherAccount.address);
  });

  // Test case for emitting ContractorMonthlyAmountSet event
  it("Should emit ContractorMonthlyAmountSet event when setting contractor monthly amount", async function () {
    
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, owner, contractor } = await loadFixture(deployFixture);

    // Owner sets a new contractor monthly amount to 0.002 BYMAX and expects the event to be emitted
    await expect(
      bymaxPay.connect(owner).setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.002"))
    )
      .to.emit(bymaxPay, "ContractorMonthlyAmountSet")
      .withArgs(contractor.address, ethers.parseEther("0.002"));
  });

  // Test case for removing a contractor
  it("Should remove contractor", async function () {
    
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, owner, contractor } = await loadFixture(deployFixture);
  
    // Set the contractor's monthly payment amount
    await bymaxPay.connect(owner).setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.002"));
  
    // Verify that the contractor has been added to the list
    let [contractorsArray, balancesArray] = await bymaxPay.getContractors();
    expect(contractorsArray).to.include(contractor.address);
    
    // Remove the contractor
    await bymaxPay.connect(owner).removeContractor(contractor.address);
  
    // Verify that the contractor has been removed from the list
    [contractorsArray, balancesArray] = await bymaxPay.getContractors();
    expect(contractorsArray.length).to.equal(0);
  });
  
  // Test case for NOT removing a contractor
  it("Should NOT remove contractor with non-zero balance", async function () {
  
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherAccount } = await loadFixture(deployFixture);
  
    // Set the contractor's monthly payment amount to 0.002 BYMAX
    await bymaxPay.connect(owner).setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.002"));
  
    // Approve sufficient tokens for the first payment
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));
    
    // Simulate payment to the contractor to give them a balance
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address);
  
    // Verify that the contractor's balance is greater than 0
    const contractorData = await bymaxPay.contractorsData(contractor.address);
    expect(contractorData.balance).to.be.gt(0);
  
    // Attempt to remove the contractor and expect the transaction to be reverted
    await expect(bymaxPay.connect(owner).removeContractor(contractor.address))
      .to.be.revertedWith("Contractor has a balance");
  });

  // Test case to verify contractor can be removed after withdrawing their balance
  it("Should allow contractor to be removed after withdrawing balance", async function () {
    
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, owner, contractor, otherAccount } = await loadFixture(deployFixture);
  
    // Set the contractor's monthly payment amount
    await bymaxPay.setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.01"));
  
    // Approve and perform a payment to give the contractor a balance
    const instance = bymaxPayCoin.connect(otherAccount);
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));
    await bymaxPay.pay(otherAccount.address, contractor.address);
  
    // Contractor withdraws their balance
    await bymaxPay.connect(contractor).withdrawContractorBalance();
  
    // Verify contractor's balance is zero
    const contractorBalanceAfterWithdrawal = await bymaxPay.connect(contractor).getContractorBalance();
    expect(contractorBalanceAfterWithdrawal).to.equal(0);

    // Attempt to remove the contractor
    await bymaxPay.connect(owner).removeContractor(contractor.address);

    // Verify that the contractor has been removed
    const [contractorsArray, balancesArray] = await bymaxPay.connect(owner).getContractors();
    expect(contractorsArray).to.not.include(contractor.address);
  });

  // Test case to allow contractor to withdraw balance
  it("Should allow contractor to withdraw balance", async function () {
    
    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, contractor } = await loadFixture(deployFixture);
  
    // Set the contractor's monthly payment amount to 0.01 BYMAX
    await bymaxPay.setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.01"));
  
    // Connect BymaxPayCoin to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);
  
    // Approve 0.01 BYMAX for payment
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));
  
    // Perform the payment
    await bymaxPay.pay(otherAccount.address, contractor.address);
  
    // Verify the balance of the contractor before withdrawal
    const contractorBalance = await bymaxPay.connect(contractor).getContractorBalance();
    expect(contractorBalance).to.be.gt(0);
  
    // Expect contractor to withdraw their balance
    await expect(bymaxPay.connect(contractor).withdrawContractorBalance())
      .to.emit(bymaxPay, "WithdrawnContractorBalance")
      .withArgs(contractorBalance, contractor.address);
  });

  // Test case for withdrawing accumulated fees by the owner
  it("Should allow owner to withdraw fees", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, otherAccount, owner, contractor } = await loadFixture(deployFixture);

    // Set the contractor's monthly payment amount to 0.01 BYMAX
    await bymaxPay.setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.01"));

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve 0.01 BYMAX for payment
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the payment
    await bymaxPay.pay(otherAccount.address, contractor.address);

    // Expect owner to withdraw accumulated fees
    await expect(bymaxPay.connect(owner).withdrawFees()).to.emit(bymaxPay, "WithdrawnFees");
  });

  // Test case for handling the second payment after a revoke
  it("Should do second payment after revoke", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, bymaxPayCollection, otherAccount, contractor } = await loadFixture(deployFixture);

    // Set the contractor's monthly payment amount to 0.01 BYMAX
    await bymaxPay.setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.01"));

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment
    await bymaxPay.pay(otherAccount.address, contractor.address);

    // Simulate the passage of 31 days and revoke the NFT due to insufficient payment
    await time.increase(31 * 24 * 60 * 60);
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.00001")); // Approve insufficient amount
    await expect(bymaxPay.pay(otherAccount.address, contractor.address)).to.emit(bymaxPay, "Revoked");

    // Approve sufficient BYMAX for payment after revocation
    await instance.approve(bymaxPayAddress, ethers.parseEther("1"));

    // Perform the second payment after revocation and expect "Granted" event
    await expect(bymaxPay.pay(otherAccount.address, contractor.address)).to.emit(bymaxPay, "Granted");

    // Fetch the updated payment info for the customer
    const payment = await bymaxPay.payments(otherAccount.address);

    // Verify that the customer now owns the NFT again
    expect(await bymaxPayCollection.ownerOf(payment.tokenId)).to.equal(otherAccount.address);
  });

  // Test case to handle removal of a customer and burning of the NFT
  it("Should remove customer and burn NFT", async function () {

    // Load the deployed fixture (contracts and accounts)
    const { bymaxPay, bymaxPayAddress, bymaxPayCoin, bymaxPayCollection, otherAccount, owner, contractor } = await loadFixture(deployFixture);

    // Set the contractor's monthly payment amount to 0.01 BYMAX
    await bymaxPay.setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.01"));

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment, associating it with the contractor
    await bymaxPay.connect(owner).pay(otherAccount.address, contractor.address);

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

    // Set the contractor's monthly payment amount to 0.01 BYMAX
    await bymaxPay.setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.01"));

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve sufficient BYMAX (0.02 BYMAX) for multiple payments (overpayment)
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.02"));

    // Perform the first payment, associating it with the contractor
    await bymaxPay.pay(otherAccount.address, contractor.address);

    // Fetch the initial next payment time after the first payment
    let payment = await bymaxPay.payments(otherAccount.address);
    const initialNextPaymentTime = BigInt(payment.nextPayment);

    // Simulate the passage of 15 days
    await time.increase(15 * 24 * 60 * 60);

    // Perform the second payment, which accumulates future access time
    await bymaxPay.pay(otherAccount.address, contractor.address);

    // Fetch the updated next payment time after the second payment
    payment = await bymaxPay.payments(otherAccount.address);
    const updatedNextPaymentTime = BigInt(payment.nextPayment);

    // Expected next payment should be 30 days after the initial next payment time
    const thirtyDaysInSeconds = BigInt(30 * 24 * 60 * 60);

    // Verify that the next payment time has been correctly updated and accumulated
    expect(updatedNextPaymentTime).to.equal(initialNextPaymentTime + thirtyDaysInSeconds);
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

    // Set the contractor's monthly payment amount to 0.01 BYMAX
    await bymaxPay.setContractorMonthlyAmount(contractor.address, ethers.parseEther("0.01"));

    // Connect the BymaxPayCoin contract to the otherAccount
    const instance = bymaxPayCoin.connect(otherAccount);

    // Approve BymaxPay contract to spend 0.01 BYMAX from otherAccount
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.01"));

    // Perform the first payment, associating it with the contractor
    await bymaxPay.pay(otherAccount.address, contractor.address);

    // Fetch payment info and check that the NFT was minted to the customer
    let payment = await bymaxPay.payments(otherAccount.address);
    expect(await bymaxPayCollection.ownerOf(payment.tokenId)).to.equal(otherAccount.address);

    // Simulate the passage of 31 days and revoke the NFT due to insufficient payment
    await time.increase(31 * 24 * 60 * 60);
    await instance.approve(bymaxPayAddress, ethers.parseEther("0.00001")); // Approve insufficient amount
    await expect(bymaxPay.pay(otherAccount.address, contractor.address)).to.emit(bymaxPay, "Revoked");

    // Check that the contract now owns the NFT after revocation
    expect(await bymaxPayCollection.ownerOf(payment.tokenId)).to.equal(bymaxPayAddress);

    // Approve sufficient BYMAX (1 BYMAX) for payment after revocation
    await instance.approve(bymaxPayAddress, ethers.parseEther("1"));

    // Perform the second payment after revocation
    await expect(bymaxPay.pay(otherAccount.address, contractor.address)).to.emit(bymaxPay, "Granted");

    // Fetch the updated payment info and check the owner of the NFT
    payment = await bymaxPay.payments(otherAccount.address);

    // Verify that the customer now owns the NFT again
    expect(await bymaxPayCollection.ownerOf(payment.tokenId)).to.equal(otherAccount.address);
  });
});
