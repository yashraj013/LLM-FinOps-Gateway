import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/database.js';

dotenv.config();  // Load .env file

await connectDB();  // Connect to MongoDB

const app = express();
const PORT = process.env.PORT || 3000;  // Default to 3000 if not set

app.get('/', (req, res) => {
  res.send('Welcome to the LLM FinOps Gateway!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});