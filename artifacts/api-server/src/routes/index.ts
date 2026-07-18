import { Router, type IRouter } from "express";
import healthRouter from "./health";
import kpisRouter from "./kpis";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/kpis", kpisRouter);

export default router;
