import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { JwtPayload, TokenPair } from "../types";

export const generateAccessToken = (admin: {
  id: string;
  email: string;
  role: "admin";
}): string => {
  const payload: JwtPayload = { ...admin, type: "access" };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
  });
};

export const generateRefreshToken = (admin: {
  id: string;
  email: string;
  role: "admin";
}): string => {
  const payload: JwtPayload = { ...admin, type: "refresh" };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
  });
};

export const generateTokenPair = (admin: {
  id: string;
  email: string;
  role: "admin";
}): TokenPair => {
  return {
    accessToken: generateAccessToken(admin),
    refreshToken: generateRefreshToken(admin),
  };
};

export const verifyAccessToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  return decoded as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  return decoded as JwtPayload;
};
