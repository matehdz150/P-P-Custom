import { Injectable } from "@nestjs/common";
import { db } from "./connection";

@Injectable()
export class DbService {
	public db = db;
}
