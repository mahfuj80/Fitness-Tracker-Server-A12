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
    const trainersCollection = client
      .db('fitnessTracker')
      .collection('trainers');
    const imageCollection = client
      .db('fitnessTracker')
      .collection('galleryImages');
    const usersCollection = client.db('fitnessTracker').collection('users');
    const appliedTrainersCollection = client
      .db('fitnessTracker')
      .collection('appliedTrainers');

    //  -----------------------------------------------------JWT ---------------------------------------
    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h',
      });
      res.send({ token });
    });

    // ---------------------------------------------------- MIDDLE-WARES -------------------------------
    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log('inside verified token', req.headers.authorization);
      if (!req.headers?.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
      });
    };

    // verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    };

    // verify trainer after verify token
    const verifyTrainers = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'trainer';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    };

    // verify Trainers or Admin
    const verifyTrainersOrAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'trainer';
      const isTrainer = user?.role === 'admin';
      if (!isAdmin && !isTrainer) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    };

    //------------------------------------------------ conform Server is Running --------------------------
    app.get('/', (req, res) => {
      res.send('Fitness Tracker is running...');
    });

    // -------------------------------------------------Newsletter Email Post--------------------------------
    // Post NewsLetter Subscribers
    app.post('/news-letter', async (req, res) => {
      try {
        const item = req.body;
        console.log(item);
        const result = await newsLetterCollection.insertOne(item);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.send(error);
      }
    });

    // -----------------------------------------------Get Gallery Images by query----------------------------------
    app.get('/galleryImages', async (req, res) => {
      try {
        let queryObj = {};
        const category = req.query.category;
        if (category) {
          queryObj.category = category;
        }
        const result = await imageCollection.find(queryObj).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.send(error);
      }
    });

    // ---------------------------------------------------- USERS ---------------------------------------

    // post users
    app.post('/users', async (req, res) => {
      try {
        const user = req.body;
        // insert email if user doesn't exists:
        // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
        const query = { email: user?.email };
        const existingUser = await usersCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: 'user already exists', insertedId: null });
        }
        const result = await usersCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    app.get('/users/role/:email', verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        let role = false;
        if (user) {
          role = user?.role;
        }
        res.send({ role });
      } catch (error) {
        res.send(error);
      }
    });

    // ----------------------------------------------------------TRAINERS-------------------------------------------
    // Get All Trainers
    app.get('/trainers', async (req, res) => {
      try {
        const result = await trainersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // Get Single Trainers By Id
    app.get('/trainers/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = {
          _id: new ObjectId(id),
        };
        const result = await trainersCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // -----------------------------------------------Applied Trainers ------------------------------
    // Post a single Trainers
    app.post('/applied-trainers', verifyToken, async (req, res) => {
      try {
        const trainer = req.body;
        const query = { email: trainer.email };
        const existingTrainer = await appliedTrainersCollection.findOne(query);
        if (existingTrainer) {
          return res.send({
            message: 'exists',
            insertedId: null,
          });
        }
        const result = await appliedTrainersCollection.insertOne(trainer);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // /users/isApplied/${user?.email}
    // Get Is User Applied For Trainer?
    app.get('/applied-trainers/:email', verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        const isApplied = await appliedTrainersCollection.findOne(query);
        if (isApplied) {
          return res.send(true);
        } else {
          return res.send(false);
        }
      } catch (error) {
        console.log(error);
        res.send(error);
      }
    });

    // ------------------------------------------------------Admin ----------------------------------------------
    // Get Count of NewsLetter Subscribers
    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
      try {
        const totalSubscribers =
          await newsLetterCollection.estimatedDocumentCount();
        const totalUsers = await usersCollection.estimatedDocumentCount();
        const totalTrainers = await trainersCollection.estimatedDocumentCount();
        const totalAppliedTrainers =
          await appliedTrainersCollection.estimatedDocumentCount();

        res.send({
          totalSubscribers,
          totalUsers,
          totalTrainers,
          totalAppliedTrainers,
        });
      } catch (error) {
        res.send(error);
        console.log(error);
      }
    });

    //get all subscribe
    app.get(
      '/admin/all-subscribers',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const result = await newsLetterCollection.find().toArray();
          res.send(result);
        } catch (error) {
          console.log(error);
          res.send(error);
        }
      }
    );

    // get all Trainers
    app.get(
      '/admin/all-trainers',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const result = await trainersCollection.find().toArray();
          res.send(result);
        } catch (error) {
          console.log(error);
          res.send(error);
        }
      }
    );

    // get applied Trainers
    app.get(
      '/admin/applied-trainers',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const result = await appliedTrainersCollection.find().toArray();
          res.send(result);
        } catch (error) {
          console.log(error);
          res.send(error);
        }
      }
    );

    app.post('/admin/accept-applied-trainer/:id', async (req, res) => {
      try {
        // Delete document from the first collection
        const appliedTrainerInfo = req.body;
        const id = req.params.id;
        let { _id, ...updatedTrainerInfo } = appliedTrainerInfo;
        updatedTrainerInfo.startDate = new Date();

        await appliedTrainersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        // Insert document into the second collection
        await trainersCollection.insertOne(updatedTrainerInfo);

        // Update document in the third collection
        await usersCollection.updateOne(
          { email: appliedTrainerInfo.email },
          { $set: { role: 'trainer' } }
        );

        res.status(200).send({
          acknowledge: true,
          message: 'Document Delete Update Insert successful',
        });
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });

    app.post('/forum', verifyToken, verifyTrainers);

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
