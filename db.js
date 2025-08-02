const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

// Configuration with environment variables
const mongoConfig = {
  uri: process.env.MONGO_URI,
  options: {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    maxPoolSize: 50,
    minPoolSize: 5
  }
};

// Singleton client instance
let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use global variable to preserve connection
  if (!global._mongoClientPromise) {
    client = new MongoClient(mongoConfig.uri, mongoConfig.options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, create new connection
  client = new MongoClient(mongoConfig.uri, mongoConfig.options);
  clientPromise = client.connect();
}

// Export the promise to be used throughout the app
module.exports = clientPromise;