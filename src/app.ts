import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";

import { errorHandler } from "@/middlewares/errorHandler";
import { insightRoutes } from "@/routes/insightRoutes";
import { liveRoutes } from "@/routes/liveRoutes";
// import userRoutes from "@/routes/users";

const app: express.Application = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/insights", insightRoutes);
app.use("/api/live", liveRoutes);
// app.use("/api/users", userRoutes);

app.use(errorHandler);

export default app;
