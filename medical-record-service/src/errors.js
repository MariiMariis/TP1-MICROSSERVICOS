// Erros de API no mesmo formato do ApiError dos servicos Java (status, error, message, path, timestamp).

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
  let message = err.message || "Erro interno";
  let details = err.details;

  // Schema validation do MongoDB (validator $jsonSchema) chega como erro 121 do servidor.
  if (err.code === 121) {
    status = 422;
    message = "Documento rejeitado pelo schema validation da colecao";
    details = err.errInfo?.details;
  }
  // Violacao de indice unico.
  if (err.code === 11000) {
    status = 409;
    message = "Ja existe um documento com essa chave unica";
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
