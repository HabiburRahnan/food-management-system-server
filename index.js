const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const mealCollection = client.db("mealManagement").collection("meals");
    const usersCollection = client.db("mealManagement").collection("users");
    const requestCollection = client.db("mealManagement").collection("request");
    const LikeCollection = client.db("mealManagement").collection("like");
    const reviewsCollection = client.db("mealManagement").collection("reviews");
    const aboutCollection = client.db("mealManagement").collection("About");
    const memberCollection = client.db("mealManagement").collection("member");
    const upcomingCollection = client
      .db("mealManagement")
      .collection("upcoming");

    // jwt route
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "24h",
      });
      res.send({ token });
    });

    // verify token middleware

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    //  use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // users collection
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const exitingUser = await usersCollection.findOne(query);
      if (exitingUser) {
        return res.send({ message: "user Already exists", insertedId: null });
      } else {
        const result = await usersCollection.insertOne(user);
        res.send(result);
      }
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const filter = req.query;
      // console.log(filter.search);
      if (filter.search) {
        const query = {
          name: { $regex: filter.search, $options: "i" },
          // email: { $regex: filter.search, $options: "i" },
        };
        const result = await usersCollection.find(query).toArray();
        res.send(result);
      }
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
      };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    app.get(
      "/users/admin/:email",
      verifyToken,

      async (req, res) => {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: "forbidden access" });
        }
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === "admin";
        }
        res.send({ admin });
      }
    );

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    //  meals collection
    app.post("/meals", verifyToken, verifyAdmin, async (req, res) => {
      const menuItem = req.body;
      const result = await mealCollection.insertOne(menuItem);
      res.send(result);
    });

    app.get("/meals", async (req, res) => {
      const filter = req.query;
      if (filter.search || filter.sort) {
        const query = {
          mealName: { $regex: filter.search, $options: "i" },
        };
        const options = {
          sort: {
            price: filter?.sort === "asc" ? 1 : -1,
          },
        };
        const result = await mealCollection.find(query, options).toArray();
        res.send(result);
      } else {
        const result = await mealCollection.find().toArray();
        res.send(result);
      }
    });

    app.get("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealCollection.findOne(query);
      res.send(result);
    });
    app.patch("/meals/:id", verifyToken, verifyAdmin, async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          mealName: data.mealName,
          type: data.type,
          Rating: data.Rating,
          date: data.date,
          price: data.Price,
          description: data.description,
          reviews: data.reviews,
          ingredients: data.ingredients,
          adminEmail: data.adminEmail,
          adminName: data.adminName,
          image: data.image,
        },
      };
      const result = await mealCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.delete("/meals/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealCollection.deleteOne(query);
      res.send(result);
    });
    app.post("/upcoming", async (req, res) => {
      const menuItem = req.body;
      const result = await upcomingCollection.insertOne(menuItem);
      res.send(result);
    });

    app.get("/upcoming", async (req, res) => {
      const result = await upcomingCollection.find().toArray();
      res.send(result);
    });
    //  like
    app.post("/likeCount", verifyToken, async (req, res) => {
      const requestLike = req.body;
      const result = await LikeCollection.insertOne(requestLike);
      res.send(result);
    });
    app.get("/likeCount/:mealName", verifyToken, async (req, res) => {
      const mealName = req.params.mealName;
      const query = {
        mealName: mealName,
      };
      const result = await LikeCollection.find(query).toArray();
      res.send(result);
    });
    // reviews related api
    app.post("/reviews", verifyToken, async (req, res) => {
      const reviews = req.body;
      const result = await reviewsCollection.insertOne(reviews);
      res.send(result);
    });
    app.get("/reviews", verifyToken, async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });
    app.get("/reviews/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
      };
      const result = await reviewsCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/reviews/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewsCollection.deleteOne(query);
      res.send(result);
    });
    app.patch("/reviews/:id", verifyToken, async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {},
      };
      const result = await mealCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // request related api
    app.post("/request", verifyToken, async (req, res) => {
      const query = req.body;
      const result = await requestCollection.insertOne(query);
      res.send(result);
    });
    app.get("/request/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
      };
      const result = await requestCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/request/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/about", verifyToken, async (req, res) => {
      const about = req.body;
      const result = await aboutCollection.insertOne(about);
      res.send(result);
    });
    app.get("/about/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
      };
      const result = await aboutCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/member", verifyToken, async (req, res) => {
      const member = req.body;
      const result = await memberCollection.insertOne(member);
      res.send(result);
    });
    app.get("/member/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
      };
      const result = await memberCollection.find(query).toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Meals management..");
});

app.listen(port, () => {
  console.log(`meals management is running on port ${port}`);
});
