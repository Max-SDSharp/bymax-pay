import * as dotenv from "dotenv";
dotenv.config();

export default class ConfigBase {
    //system
    static NODE_ENV: string = `${process.env.NODE_ENV || "development"}`;
    static DEV_ENV: boolean = ConfigBase.NODE_ENV === "development";

    //database
    static DATABASE_URL: string = `${process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/bymax-pay"}`;

    //blockchain
    static BYMAXPAY_CONTRACT: string = `${process.env.BYMAXPAY_CONTRACT}`;
    static NETWORK: string = `${process.env.NETWORK}`;

    //security
    static CORS_ORIGIN: string = `${process.env.CORS_ORIGIN || "*"}`;
    static JWT_SECRET: string = `${process.env.JWT_SECRET}`;
    static JWT_EXPIRES: number = parseInt(`${process.env.JWT_EXPIRES}`);
    static AES_KEY: string = `${process.env.AES_KEY}`;
}