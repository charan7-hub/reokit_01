import { Router, type IRouter } from "express";
import healthRouter from "./health";
import loansRouter from "./loans";

const router: IRouter = Router();

router.use(healthRouter);
router.use(loansRouter);

export default router;
