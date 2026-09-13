export class WaaruError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}
export class WaaruValidationError extends WaaruError {}
export class WaaruApiError extends WaaruError {
  constructor(status, code, requestId, retryAfterSeconds, outcomeUnknown = true) {
    super(outcomeUnknown
      ? `Request unsuccessful (HTTP ${status}). The send outcome is unknown; do not resend blindly.`
      : `Waaru rejected the request (HTTP ${status}). Check the error code.`);
    Object.assign(this, { status, code, requestId, retryAfterSeconds, outcomeUnknown });
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
}
export class WaaruTimeoutError extends WaaruConnectionError {}
export class WaaruProtocolError extends WaaruConnectionError {}
