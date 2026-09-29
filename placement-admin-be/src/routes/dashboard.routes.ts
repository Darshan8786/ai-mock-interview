import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboard.controller";

const router = Router();

router.get("/", getDashboardStats); // admin check applied where the router is mounted (app.ts)

export default router;
