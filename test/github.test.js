import assert from "node:assert/strict";
import test from "node:test";

import { createInstallationToken } from "../src/github.js";

test("exchanges an app JWT and forwards optional installation token restrictions", async () => {
  let request;
  const result = await createInstallationToken({
    appJwt: "header.payload.signature",
    installationId: "12345",
    apiUrl: "https://github.example/api/v3",
    permissions: { contents: "read" },
    repositories: ["repo-a", "repo-b"],
    fetchImplementation: async (url, options) => {
      request = { url, options };
      return new Response(
        JSON.stringify({ token: "ghs_example", expires_at: "2026-09-30T03:00:00Z" }),
        { status: 201 },
      );
    },
  });

  assert.equal(result.token, "ghs_example");
  assert.equal(result.expiresAt, "2026-09-30T03:00:00Z");
  assert.equal(request.url, "https://github.example/api/v3/app/installations/12345/access_tokens");
  assert.equal(request.options.headers.Authorization, "Bearer header.payload.signature");
  assert.deepEqual(JSON.parse(request.options.body), {
    permissions: { contents: "read" },
    repositories: ["repo-a", "repo-b"],
  });
});

test("surfaces GitHub REST API errors", async () => {
  await assert.rejects(
    createInstallationToken({
      appJwt: "jwt",
      installationId: "12345",
      apiUrl: "https://api.github.com",
      fetchImplementation: async () => new Response("not authorized", { status: 401 }),
    }),
    /401.*not authorized/,
  );
});
