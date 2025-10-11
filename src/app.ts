import express from "express";

const app = express();

app.use(express.json());

// Import and use user routes
import userRoutes from "./routes/userRoutes";
import tenderRoutes from "./routes/tenderRoutes";
app.use("/api/user", userRoutes);
app.use("/api/tenders", tenderRoutes);
export default app;
