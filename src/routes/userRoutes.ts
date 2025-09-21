import { Router } from "express";
import { registerUserController } from "../controllers/userController";
const router = Router();

router.post("/register", registerUserController);

export default router;