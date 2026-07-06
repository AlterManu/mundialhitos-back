import { Router, type Router as ExpressRouter } from "express";
import { FindManyOptions, FindOptionsWhere } from "typeorm";
import { AppDataSource } from "@/config/dataSource";
import { Insight, InsightStatus } from "@/entities/Insight";

export const insightRoutes: ExpressRouter = Router();

insightRoutes.get("/", async (req, res, next) => {
  try {
    const repo = AppDataSource.getRepository(Insight);
    const status = parseStatus(req.query.status);
    const take = parseLimit(req.query.limit);
    const includeHidden = req.query.includeHidden === "true";
    const onlyHidden = req.query.show === "false";
    const where: FindOptionsWhere<Insight> = {};

    const options: FindManyOptions<Insight> = {
      order: {
        importance_score: "DESC",
        created_at: "DESC",
      },
      take,
    };

    if (status) {
      where.status = status;
    }
    if (!includeHidden) {
      where.show = !onlyHidden;
    }
    if (Object.keys(where).length > 0) {
      options.where = where;
    }

    const insights = await repo.find(options);

    res.json({ data: insights });
  } catch (error) {
    next(error);
  }
});

function parseStatus(value: unknown): InsightStatus | undefined {
  if (typeof value !== "string") return undefined;
  if (Object.values(InsightStatus).includes(value as InsightStatus)) {
    return value as InsightStatus;
  }
  return undefined;
}

function parseLimit(value: unknown): number {
  if (typeof value !== "string") return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return 50;
  return Math.min(Math.max(parsed, 1), 200);
}
