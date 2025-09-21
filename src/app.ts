import express from "express";

const app = express();

app.use(express.json());

// Import and use user routes
import userRoutes from "./routes/userRoutes";
app.use("/api/user", userRoutes);

export default app;
