import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BymaxPayModule = buildModule("BymaxPayModule", (m) => {
    const bymaxPayCoin = m.contract("BymaxPayCoin");
    const bymaxPayCollection = m.contract("BymaxPayCollection");
    const bymaxPay = m.contract("BymaxPay", [bymaxPayCoin, bymaxPayCollection]);

    m.call(bymaxPayCollection, "setAuthorizedContract", [bymaxPay]);

    return { bymaxPay, bymaxPayCoin, bymaxPayCollection };
});

export default BymaxPayModule;