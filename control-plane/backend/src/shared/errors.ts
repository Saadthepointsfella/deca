// backend/src/shared/errors.ts
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class BadRequestError extends Error {
  constructor(message = "Bad request") {
    super(message);
    this.name = "BadRequestError";
  }
}
