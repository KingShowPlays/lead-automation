import mongoose from "mongoose";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export async function connectDb(uri: string = config.MONGODB_URI): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  logger.info({ db: conn.connection.name }, "MongoDB connected");
  return conn;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
