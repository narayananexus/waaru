export class WaaruError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}
export class WaaruValidationError extends WaaruError {}
export class WaaruApiError extends WaaruError {
  constructor(status, code, requestId, retryAfterSeconds, outcomeUnknown = false) {
    super(outcomeUnknown
      ? `Request unsuccessful (HTTP ${status}). The write outcome is unknown; do not retry blindly.`
      : `Waaru rejected the request (HTTP ${status}). Check the error code.`);
    Object.assign(this, { status, code, requestId, retryAfterSeconds, outcomeUnknown });
  }
  toJSON() {
    return {
      name: this.name,
      status: this.status,
      code: this.code,
      ...(this.requestId ? { requestId: this.requestId } : {}),
      ...(this.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: this.retryAfterSeconds }),
      outcomeUnknown: this.outcomeUnknown,
    };
  }
}
export class WaaruConnectionError extends WaaruError {
  constructor(
    message = "The connection failed. The send outcome may be unknown.",
    outcomeUnknown = true,
    requestId,
  ) {
    super(message);
    this.outcomeUnknown = outcomeUnknown;
    this.requestId = requestId;
  }
  toJSON() {
    return {
      name: this.name,
      ...(this.requestId ? { requestId: this.requestId } : {}),
      outcomeUnknown: this.outcomeUnknown,
    };
  }
}
export class WaaruTimeoutError extends WaaruConnectionError {}
export class WaaruProtocolError extends WaaruConnectionError {}
