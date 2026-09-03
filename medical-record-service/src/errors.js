// API errors in the same shape as the Java services' ApiError (status, error, message, path, timestamp).

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (message) => new ApiError(404, message);
export const badRequest = (message, details) => new ApiError(400, message, details);
export const unprocessable = (message, details) => new ApiError(422, message, details);

const REASONS = { 400: "Bad Request", 404: "Not Found", 409: "Conflict", 422: "Unprocessable Entity", 500: "Internal Server Error", 503: "Service Unavailable" };

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || "Internal error";
  let details = err.details;

  // MongoDB schema validation ($jsonSchema validator) arrives as server error 121.
  if (err.code === 121) {
    status = 422;
    message = "Document rejected by the collection's schema validation";
    details = err.errInfo?.details;
  }
  // Unique index violation.
  if (err.code === 11000) {
    status = 409;
    message = "A document with this unique key already exists";
    details = err.keyValue;
  }

  if (status >= 500) console.error(err);

  res.status(status).json({
    timestamp: new Date().toISOString(),
    status,
    error: REASONS[status] || "Error",
    message,
    path: req.originalUrl,
    ...(details !== undefined ? { details } : {}),
  });
}
