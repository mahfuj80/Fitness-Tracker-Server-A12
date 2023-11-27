const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fllucor.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    app.listen(port, () => {
      console.log(`Bistro boss is sitting on port ${port}`);
    });
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // collections
    const newsLetterCollection = client
      .db('fitnessTracker')
      .collection('newsLetter');
    const trainersLetterCollection = client
      .db('fitnessTracker')
      .collection('trainers');

    // conform Server is Running
    app.get('/', (req, res) => {
      res.send('Fitness Tracker is running...');
    });

    // Newsletter Email Post
    app.post('/news-letter', async (req, res) => {
      const item = req.body;
      console.log(item);
      const result = await newsLetterCollection.insertOne(item);
      res.send(result);
    });

    // Get All Trainers
    app.get('/trainers', async (req, res) => {
      const result = await trainersLetterCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //     await client.close();
  }
}
run().catch(console.dir);
