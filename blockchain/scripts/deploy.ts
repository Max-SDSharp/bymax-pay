import { ethers } from "hardhat";

async function main() {

  const BymaxPayCoin = await ethers.getContractFactory("BymaxPayCoin");
  const bymaxPayCoin = await BymaxPayCoin.deploy();

  await bymaxPayCoin.waitForDeployment();
  console.log(`BymaxPayCoin deployed to ${bymaxPayCoin.target}`);

  const BymaxPayCollection = await ethers.getContractFactory("BymaxPayCollection");
  const bymaxPayCollection = await BymaxPayCollection.deploy();

  await bymaxPayCollection.waitForDeployment();
  console.log(`BymaxPayCollection deployed to ${bymaxPayCollection.target}`);

  const BymaxPay = await ethers.getContractFactory("BymaxPay");
  const bymaxPay = await BymaxPay.deploy(bymaxPayCoin.target, bymaxPayCollection.target);

  await bymaxPay.waitForDeployment();
  console.log(`BymaxPay deployed to ${bymaxPay.target}`);

  await bymaxPayCollection.setAuthorizedContract(bymaxPay.target);
  console.log(`BymaxPay authorized on BymaxPayCollection`);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
