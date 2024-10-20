import { Injectable } from '@nestjs/common';
import connect from "../config/db";
import Config from '../config'
@Injectable()
export class AppService {
  async getHello(): Promise<string> {

    const db = await connect();

    const whereClause = {};

    const certificates = await db.customers.findMany({
        where: whereClause,
    });

    console.log(certificates);




    return 'Hello World!';
  }
}
