// src/controllers/userController.ts
import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/userServices";
import { catchAsync } from "../utils/catchAsync";

const userService = new UserService();

export const registerUserController = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await userService.registerUser(req.body);
    res.status(201).json({ success: true, data: user });
  }
);
