import { StrictAuthProp } from "@clerk/express";

declare global {
  namespace Express {
    interface Request extends StrictAuthProp {}
  }
}
