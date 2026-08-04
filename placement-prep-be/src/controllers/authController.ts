import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";

const signToken = (id: string) => {
  return jwt.sign({ id }, env.JWT_SECRET, {
    expiresIn: "90d",
  });
};

export const register = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError("Email already in use", 400));
    }

    const newUser = await User.create({
      name,
      email,
      password,
      role,
    });

    const token = signToken(newUser._id.toString());

    res.status(201).json({
      status: "success",
      token,
      data: {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      },
    });
  }
);

export const login = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError("Please provide email and password", 400));
    }

    // Explicitly select password since it might be excluded in schema query by default if set
    const user = await User.findOne({ email }); 

    // @ts-ignore - user methods defined in schema
    if (!user || !(await user.correctPassword(password))) {
      return next(new AppError("Incorrect email or password", 401));
    }

    const token = signToken(user._id.toString());

    res.status(200).json({
      status: "success",
      token,
    });
  }
);
