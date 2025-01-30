require("dotenv").config();
const express = require("express");
const redis = require("redis");

const app = express();
const PORT = process.env.PORT || 3000;
console.log("PORT", PORT);

const CACHE_EXPIRY = process.env.CACHE_EXPIRY || 600;

// Create Redis client
const redisClient = redis.createClient();

// Handle Redis connection
redisClient
  .connect()
  .then(() => console.log("Connected to Redis"))
  .catch((err) => console.error("Redis Connection Error:", err));

redisClient.on("error", (err) => console.error("Redis Client Error", err));

app.use(express.json());

// Simulate heavy computation using a function
const heavyComputation = () => {
  let sum = 0;
  for (let i = 0; i < 1e8; i++) {
    sum += i;
  }
  return sum;
};

// Route with Redis caching
app.get("/redis", async (req, res) => {
  try {
    const cacheKey = "X-Data";

    // Check Redis cache
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json({ fromCache: true, data: JSON.parse(cachedData) });
    }

    // If not in cache, perform computation
    const data = heavyComputation();

    // Store in Redis for future requests
    await redisClient.setEx(cacheKey, CACHE_EXPIRY, JSON.stringify(data));

    res.json({ fromCache: false, data });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Clear cache manually (useful for admin actions)
app.delete("/clear-cache", async (req, res) => {
  try {
    await redisClient.del("X-Data");
    res.json({ message: "X-Data cache cleared" });
  } catch (error) {
    console.error("Error clearing cache:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route without Redis caching
app.get("/", (req, res) => {
  try {
    const data = heavyComputation();
    res.json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Closing Redis client...");
  await redisClient.quit();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
