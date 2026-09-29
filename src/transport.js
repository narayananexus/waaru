import {
  WaaruError,
  WaaruApiError,
  WaaruConnectionError,
  WaaruTimeoutError,
  WaaruProtocolError,
} from "./errors.js";
import {
  check,
  idempotencyKey as validateIdempotencyKey,
  object,
  requestId as validateRequestId,
  timeout,
} from "./validation.js";

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BYTES = 256 * 1024;
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const responseMetadata = new WeakMap();

function validateOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    check(false, "Invalid API base URL.");
  }
  check(
    !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/" &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))),
    "API base URL must be a trusted HTTPS origin (loopback HTTP is allowed for development).",
  );
  return url.origin;
}

function validatePath(path) {
  check(
    typeof path === "string" &&
      path.startsWith("/v1/") &&
      !path.includes("?") &&
      !path.includes("#") &&
      !path.includes("\\") &&
      !path.includes("//") &&
      !/(^|\/)\.\.?($|\/)/.test(path) &&
      !/%2e/i.test(path),
    "Request path is invalid.",
  );
  return path;
}

function buildUrl(origin, path, query) {
  const url = new URL(validatePath(path), origin);
  if (query === undefined) return url.toString();
  check(
    query !== null && typeof query === "object" && !Array.isArray(query),
    "Query must be an object.",
  );
  for (const [key, value] of Object.entries(query)) {
    check(/^[A-Za-z][A-Za-z0-9]*$/.test(key), "Query contains an invalid key.");
    if (value === undefined) continue;
    check(
      typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean",
      "Query values must be strings, numbers or booleans.",
    );
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function responseRequestId(response, fallback) {
  return [
    response.headers.get("x-request-id"),
    response.headers.get("x-waaru-request-id"),
    fallback,
  ].find((value) => typeof value === "string" && SAFE_REQUEST_ID.test(value));
}

function retryAfterSeconds(response) {
  const raw = response.headers.get("retry-after");
  if (raw === null) return undefined;
  if (/^\d+$/.test(raw)) return Number(raw);
  const date = Date.parse(raw);
  return Number.isFinite(date)
    ? Math.max(0, Math.ceil((date - Date.now()) / 1000))
    : undefined;
}

function safeCode(value) {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,128}$/.test(value)
    ? value
    : "http_error";
}

function protocolError(message, outcomeUnknown, requestId) {
  return new WaaruProtocolError(message, outcomeUnknown, requestId);
}

async function readJson(response, signal, outcomeUnknown, requestId) {
  if (!response.body) {
    throw protocolError("Waaru returned an empty JSON response.", outcomeUnknown, requestId);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  const cancel = () => void reader.cancel().catch(() => {});
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_JSON_BYTES) {
        cancel();
        throw protocolError(
          "Waaru returned a response larger than the SDK limit.",
          outcomeUnknown,
          requestId,
        );
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw protocolError("Waaru returned invalid JSON.", outcomeUnknown, requestId);
  }
}

function safeFailure(error, { isWrite, dispatched, requestId, timedOut }) {
  if (error instanceof WaaruError) {
    if (error.requestId === undefined && requestId !== undefined) {
      error.requestId = requestId;
    }
    return error;
  }
  const outcomeUnknown = isWrite && dispatched;
  return timedOut
    ? new WaaruTimeoutError(
        outcomeUnknown
          ? "Request timed out. The write outcome is unknown."
          : "Request timed out.",
        outcomeUnknown,
        requestId,
      )
    : new WaaruConnectionError(
        outcomeUnknown
          ? "The connection failed. The write outcome may be unknown."
          : "The connection failed.",
        outcomeUnknown,
        requestId,
      );
}

function wrapBinary(response, lifecycle) {
  if (!response.body) {
    lifecycle.cleanup();
    throw protocolError(
      "Waaru returned an empty media response.",
      false,
      lifecycle.requestId,
    );
  }
  const reader = response.body.getReader();
  let finished = false;
  let streamController;
  const finish = () => {
    if (finished) return;
    finished = true;
    lifecycle.cleanup();
  };
  const fail = async (error) => {
    if (finished) return;
    finish();
    streamController?.error(error);
    await reader.cancel().catch(() => {});
  };
  lifecycle.onInterrupt = fail;
  const body = new ReadableStream({
    start(controller) {
      streamController = controller;
    },
    async pull(controller) {
      if (finished) return;
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        await fail(
          safeFailure(error, {
            isWrite: false,
            dispatched: true,
            requestId: lifecycle.requestId,
            timedOut: lifecycle.timedOut,
          }),
        );
      }
    },
    async cancel(reason) {
      finish();
      await reader.cancel(reason).catch(() => {});
    },
  });
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export function getResponseRequestId(value) {
  return value && typeof value === "object"
    ? responseMetadata.get(value)?.requestId
    : undefined;
}

export function createTransport(options = {}) {
  check(
    typeof window === "undefined",
    "Waaru requires a server environment; never expose your API key in a browser.",
  );
  object(options, ["apiKey", "baseUrl", "timeoutMs", "fetch"], "Client options");
  const apiKey = options.apiKey ?? process.env.WAARU_API_KEY;
  check(
    typeof apiKey === "string" && /^wak_[a-fA-F0-9]{64}$/.test(apiKey),
    "Set WAARU_API_KEY to the API key created in Waaru Settings > Developer.",
  );
  const baseUrl = validateOrigin(
    options.baseUrl ?? process.env.WAARU_BASE_URL ?? "https://api.waaru.app",
  );
  const defaultTimeout = timeout(options.timeoutMs ?? 30000);
  const fetch = options.fetch ?? globalThis.fetch;
  check(typeof fetch === "function", "A Fetch implementation is required.");

  return Object.freeze({
    async request({
      method,
      path,
      query,
      body,
      options: requestOptions = {},
      expectedStatus,
      binary = false,
      idempotencyKey,
    }) {
      check(
        ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method),
        "Unsupported request method.",
      );
      check(
        Number.isInteger(expectedStatus) && expectedStatus >= 200 && expectedStatus <= 299,
        "Expected status must be a successful HTTP status.",
      );
      object(
        requestOptions,
        ["signal", "timeoutMs", "requestId", "idempotencyKey"],
        "Request options",
      );
      if (requestOptions.signal !== undefined) {
        check(requestOptions.signal instanceof AbortSignal, "signal must be an AbortSignal.");
      }
      const requestId = requestOptions.requestId === undefined
        ? undefined
        : validateRequestId(requestOptions.requestId);
      const sendKey = idempotencyKey ?? requestOptions.idempotencyKey;
      if (sendKey !== undefined) validateIdempotencyKey(sendKey);
      check(
        sendKey === undefined || (method === "POST" && path === "/v1/messages"),
        "Idempotency keys are supported only for POST /v1/messages.",
      );
      const duration = timeout(requestOptions.timeoutMs ?? defaultTimeout);
      const url = buildUrl(baseUrl, path, query);
      let serialized;
      if (body !== undefined) {
        check(method !== "GET" && method !== "DELETE", "This request cannot include a body.");
        try {
          serialized = JSON.stringify(body);
        } catch {
          check(false, "Request body cannot be serialized.");
        }
        check(
          Buffer.byteLength(serialized) <= MAX_REQUEST_BYTES,
          "Request exceeds the 256 KiB limit.",
        );
      }
      if (requestOptions.signal?.aborted) {
        throw new WaaruConnectionError("Request cancelled before dispatch.", false, requestId);
      }

      const isWrite = method !== "GET";
      const controller = new AbortController();
      let dispatched = false;
      let timedOut = false;
      let cleaned = false;
      let onInterrupt;
      let rejectInterrupted;
      const interrupted = new Promise((_, reject) => {
        rejectInterrupted = reject;
      });
      let timer;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        clearTimeout(timer);
        requestOptions.signal?.removeEventListener("abort", callerAbort);
      };
      const interrupt = (error) => {
        controller.abort();
        rejectInterrupted(error);
        void onInterrupt?.(error);
      };
      const callerAbort = () => {
        interrupt(
          new WaaruConnectionError(
            isWrite && dispatched
              ? "Request cancelled after dispatch. The write outcome is unknown."
              : "Request cancelled.",
            isWrite && dispatched,
            requestId,
          ),
        );
      };
      requestOptions.signal?.addEventListener("abort", callerAbort, { once: true });
      timer = setTimeout(() => {
        timedOut = true;
        interrupt(
          new WaaruTimeoutError(
            isWrite && dispatched
              ? "Request timed out. The write outcome is unknown."
              : "Request timed out.",
            isWrite && dispatched,
            requestId,
          ),
        );
      }, duration);

      let binaryTransferred = false;
      try {
        const run = async () => {
          dispatched = true;
          const response = await fetch(url, {
            method,
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: binary ? "*/*" : "application/json",
              ...(serialized === undefined ? {} : { "Content-Type": "application/json" }),
              ...(requestId ? { "x-request-id": requestId } : {}),
              ...(sendKey ? { "Idempotency-Key": sendKey } : {}),
            },
            ...(serialized === undefined ? {} : { body: serialized }),
            credentials: "omit",
            redirect: "error",
            signal: controller.signal,
          });
          const resolvedRequestId = responseRequestId(response, requestId);
          if (!response.ok) {
            let data;
            try {
              data = await readJson(
                response,
                controller.signal,
                isWrite && (response.status === 408 || response.status >= 500),
                resolvedRequestId,
              );
            } catch {
              data = undefined;
            }
            const code = safeCode(data?.code);
            const outcomeUnknown =
              isWrite &&
              (response.status === 408 ||
                response.status >= 500 ||
                code === "http_error" ||
                typeof data?.message !== "string");
            throw new WaaruApiError(
              response.status,
              code,
              resolvedRequestId,
              retryAfterSeconds(response),
              outcomeUnknown,
            );
          }
          if (response.status !== expectedStatus) {
            throw protocolError(
              "Waaru returned an unexpected success status.",
              isWrite,
              resolvedRequestId,
            );
          }
          if (binary) {
            binaryTransferred = true;
            return wrapBinary(response, {
              cleanup,
              requestId: resolvedRequestId,
              get timedOut() {
                return timedOut;
              },
              set onInterrupt(value) {
                onInterrupt = value;
              },
            });
          }
          const data = await readJson(response, controller.signal, isWrite, resolvedRequestId);
          if (data && typeof data === "object") {
            responseMetadata.set(data, { requestId: resolvedRequestId });
          }
          return data;
        };
        return await Promise.race([run(), interrupted]);
      } catch (error) {
        throw safeFailure(error, { isWrite, dispatched, requestId, timedOut });
      } finally {
        if (!binaryTransferred) {
          cleanup();
          controller.abort();
        }
      }
    },
  });
}
