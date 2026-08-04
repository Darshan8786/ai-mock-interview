import { NextFunction, Response, Request } from "express";
import jwt, {JwtPayload} from "jsonwebtoken";
const jwtSecret = process.env.JWT_SECRET as string;

export function userMiddleware (req: Request, res: Response, next: NextFunction) {
    const header = req.headers.token;
    const decoded = jwt.verify(header as string, jwtSecret)
   // console.log (decoded);
    if (decoded){
        if (typeof decoded === "string") {
            res.status(403).json({
                message:"You are not logged in"
            })
            return;
        }
        //@ts-ignore
        req.userId = (decoded as JwtPayload).id;
        next ()
    } else {
        res.status(403).json({
            message: "You are not logged in"
        })
    }
}