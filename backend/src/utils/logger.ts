import { createLogger, format, transports } from "winston";

export const logger = createLogger({
  level: "info",
  format: format.combine(
    format.colorize(),
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const metaString = Object.keys(meta).length ? JSON.stringify(meta) : "";
      return `[${timestamp}] ${level}: ${message} ${metaString}`;
    })
  ),
  transports: [new transports.Console()],
});
