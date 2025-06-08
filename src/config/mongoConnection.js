import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

const { DB_HOST, DB_NODE_PORT,DB_NAME,DB_USER,DB_PASSWORD } = process.env;

const username = DB_USER;
const password = DB_PASSWORD;
const host = DB_HOST;
const port = DB_NODE_PORT;

const uri = `mongodb://${username}:${password}@${host}:${port}/${DB_NAME}?authSource=admin&directConnection=true`;

export async function connectWithMongoose() {
    console.log('Mongo URI:', uri);
  try {
    await mongoose.connect(uri);
    console.log('✅ Mongoose connected to MongoDB');
  } catch (error) {
    console.error('❌ Mongoose connection error:', error.message);
  }
}