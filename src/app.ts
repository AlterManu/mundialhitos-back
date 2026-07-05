import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";

import { errorHandler } from "@/middlewares/errorHandler";
import { insightRoutes } from "@/routes/insightRoutes";
import { fixtureRoutes } from "@/routes/fixtureRoutes";
import { liveRoutes } from "@/routes/liveRoutes";
import { pollingRoutes } from "@/routes/pollingRoutes";
import { devRoutes } from "@/routes/devRoutes";
import { mappingRoutes } from "@/routes/mappingRoutes";
import { adminRoutes } from "@/routes/adminRoutes";
// import userRoutes from "@/routes/users";

const app: express.Application = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/fixtures", fixtureRoutes);
app.use("/api/insights", insightRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/mappings", mappingRoutes);
app.use("/api/polling", pollingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dev", devRoutes);
// app.use("/api/users", userRoutes);

app.use(errorHandler);

export default app;
