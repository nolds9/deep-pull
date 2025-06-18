import { clerkMiddleware } from "@clerk/express";

// This middleware requires authentication and will throw an error if the user is not authenticated.
// It also makes the `req.auth` object available and typed on the request.
export const requireAuth = clerkMiddleware();
