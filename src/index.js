import {
  check,
  object,
  string,
  recipient,
  timeout,
  template,
} from "./validation.js";
import {
  WaaruError,
  WaaruApiError,
  WaaruConnectionError,
  WaaruTimeoutError,
  WaaruProtocolError,
} from "./errors.js";
export * from "./errors.js";

async function readJson(response, signal) {
  if (!response.body)
    throw new WaaruProtocolError(
      "Waaru returned an empty response. The send outcome is unknown.",
    );
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        void reader.cancel().catch(() => {});
        throw new WaaruProtocolError(
          "Response exceeds the SDK size limit. The send outcome is unknown.",
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
    throw new WaaruProtocolError(
      "Waaru returned invalid JSON. The send outcome is unknown.",
    );
  }
}

export class Waaru {
  #apiKey;
  #baseUrl;
  #fetch;
  #timeout;
  constructor(options = {}) {
    check(
      typeof window === "undefined",
      "Waaru requires a server environment; never expose your API key in a browser.",
    );
    object(
      options,
      ["apiKey", "baseUrl", "timeoutMs", "fetch"],
      "Client options",
    );
    const key = options.apiKey ?? process.env.WAARU_API_KEY;
    check(
      typeof key === "string" && /^wak_[a-fA-F0-9]{64}$/.test(key),
      "Set WAARU_API_KEY to the API key created in Waaru Settings > Developer.",
    );
    let url;
    try {
      url = new URL(
        options.baseUrl ??
          process.env.WAARU_BASE_URL ??
          "https://api.waaru.app",
      );
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
    this.#apiKey = key;
    this.#baseUrl = url.origin;
    this.#timeout = timeout(options.timeoutMs ?? 30000);
    this.#fetch = options.fetch ?? globalThis.fetch;
    check(
      typeof this.#fetch === "function",
      "A Fetch implementation is required.",
    );
    this.messages = Object.freeze({
      sendText: this.#sendText.bind(this),
      sendTemplate: this.#sendTemplate.bind(this),
    });
  }
  async #sendText(input, options) {
    object(input, ["to", "text", "previewUrl"], "Text message");
    recipient(input.to);
    string(input.text, 4096, "Text");
    if (input.previewUrl !== undefined)
      check(
        typeof input.previewUrl === "boolean",
        "previewUrl must be boolean.",
      );
    return this.#send(
      {
        messaging_product: "whatsapp",
        to: input.to,
        type: "text",
        text: {
          body: input.text,
          ...(input.previewUrl === undefined
            ? {}
            : { preview_url: input.previewUrl }),
        },
      },
      options,
    );
  }
  async #sendTemplate(input, options) {
    object(input, ["to", "name", "language", "components"], "Template message");
    recipient(input.to);
    template(input);
    return this.#send(
      {
        messaging_product: "whatsapp",
        to: input.to,
        type: "template",
        template: {
          name: input.name,
          language: { code: input.language },
          ...(input.components === undefined
            ? {}
            : { components: input.components }),
        },
      },
      options,
    );
  }
  async #send(payload, options = {}) {
    object(options, ["signal", "timeoutMs", "requestId"], "Request options");
    const duration = timeout(options.timeoutMs ?? this.#timeout);
    if (options.signal !== undefined)
      check(
        options.signal instanceof AbortSignal,
        "signal must be an AbortSignal.",
      );
    if (options.requestId !== undefined)
      check(
        typeof options.requestId === "string" &&
          /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(options.requestId),
        "Invalid request ID.",
      );
    let body;
    try {
      body = JSON.stringify(payload);
    } catch {
      check(false, "Message cannot be serialized.");
    }
    check(
      Buffer.byteLength(body) <= 262144,
      "Message exceeds the 256 KiB request limit.",
    );
    if (options.signal?.aborted)
      throw new WaaruConnectionError(
        "Request cancelled before dispatch.",
        false,
        options.requestId,
      );
    const controller = new AbortController();
    let timer;
    let rejectAbort;
    const interrupted = new Promise((_, reject) => {
      rejectAbort = reject;
    });
    const abort = () => {
      controller.abort();
      rejectAbort(
        new WaaruConnectionError(
          "Request cancelled after dispatch. The send outcome is unknown.",
        ),
      );
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      rejectAbort(
        new WaaruTimeoutError(
          "Request timed out. The send outcome is unknown.",
        ),
      );
    }, duration);
    const run = async () => {
      const response = await this.#fetch(`${this.#baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(options.requestId ? { "x-request-id": options.requestId } : {}),
        },
        body,
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      });
      const requestId = [
        response.headers.get("x-request-id"),
        response.headers.get("x-waaru-request-id"),
        options.requestId,
      ].find(value => typeof value === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value));
      let data;
      try {
        data = await readJson(response, controller.signal);
      } catch (error) {
        if (response.ok) throw error;
        data = null;
      }
      if (!response.ok) {
        const raw = response.headers.get("retry-after");
        const delay =
          raw === null
            ? NaN
            : /^\d+$/.test(raw)
              ? Number(raw)
              : Math.max(0, Math.ceil((Date.parse(raw) - Date.now()) / 1000));
        const code =
          typeof data?.code === "string" &&
          /^[a-zA-Z0-9_.:-]{1,128}$/.test(data.code)
            ? data.code
            : "http_error";
        throw new WaaruApiError(
          response.status,
          code,
          requestId,
          Number.isFinite(delay) ? delay : undefined,
          response.status >= 500 || response.status === 408 ||
            code === "http_error" || typeof data?.message !== "string",
        );
      }
      if (
        response.status !== 202 ||
        data?.messaging_product !== "whatsapp" ||
        data?.status !== "queued" ||
        typeof data?.messageId !== "string" ||
        !data.messageId
      )
        throw new WaaruProtocolError(
          "Unexpected acceptance response. The send outcome is unknown.",
        );
      return {
        messaging_product: "whatsapp",
        messageId: data.messageId,
        status: "queued",
        ...(requestId ? { requestId } : {}),
      };
    };
    try {
      return await Promise.race([run(), interrupted]);
    } catch (error) {
      const failure = error instanceof WaaruError ? error : new WaaruConnectionError();
      if (failure.requestId === undefined && options.requestId !== undefined)
        failure.requestId = options.requestId;
      throw failure;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      controller.abort();
    }
  }
}
export default Waaru;
