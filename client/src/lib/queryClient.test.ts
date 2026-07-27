import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { apiRequest } from "./queryClient";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function captureRequest(
  invoke: () => Promise<Response>,
): Promise<{ input: string | URL | Request; init?: RequestInit }> {
  let captured: { input: string | URL | Request; init?: RequestInit } | undefined;

  globalThis.fetch = async (input, init) => {
    captured = { input, init };
    return new Response(null, { status: 204 });
  };

  await invoke();
  assert.ok(captured, "apiRequest should invoke fetch");
  return captured;
}

test("GET preserves method, URL, credentials, and an empty body", async () => {
  const request = await captureRequest(() => apiRequest("GET", "/api/example"));

  assert.equal(request.input, "/api/example");
  assert.equal(request.init?.method, "GET");
  assert.equal(request.init?.credentials, "include");
  assert.equal(request.init?.body, undefined);
});

test("POST serializes a JSON request body", async () => {
  const request = await captureRequest(() =>
    apiRequest("POST", "/api/example", { name: "TUTELA" }),
  );

  assert.equal(request.init?.method, "POST");
  assert.deepEqual(request.init?.headers, { "Content-Type": "application/json" });
  assert.equal(request.init?.body, JSON.stringify({ name: "TUTELA" }));
});

test("PATCH serializes a JSON request body", async () => {
  const request = await captureRequest(() =>
    apiRequest("PATCH", "/api/example/1", { status: "active" }),
  );

  assert.equal(request.init?.method, "PATCH");
  assert.equal(request.init?.body, JSON.stringify({ status: "active" }));
});

test("DELETE preserves the method without inventing a request body", async () => {
  const request = await captureRequest(() =>
    apiRequest("DELETE", "/api/example/1"),
  );

  assert.equal(request.init?.method, "DELETE");
  assert.equal(request.init?.body, undefined);
});
