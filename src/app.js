import express from 'express';
import dotenv from 'dotenv';
import { connectRedis } from './config/redis.js';
import connectDB from './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();