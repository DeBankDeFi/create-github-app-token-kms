import * as core from "@actions/core";
import { KMSClient } from "@aws-sdk/client-kms";

import { createInstallationToken } from "./github.js";
import { createAppJwt } from "./jwt.js";

function optionalJsonObjectInput(name) {
  const value = core.getInput(name);
  if (!value) {
    return undefined;
  }

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`Input '${name}' must be valid JSON.`);
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`Input '${name}' must be a JSON object.`);
  }
  return parsed;
}

function optionalJsonStringArrayInput(name) {
  const value = core.getInput(name);
  if (!value) {
    return undefined;
  }

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`Input '${name}' must be valid JSON.`);
  }

  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error(`Input '${name}' must be a JSON array of repository names.`);
  }
  return parsed;
}

export async function run() {
  const appId = core.getInput("app-id", { required: true });
  const installationId = core.getInput("installation-id", { required: true });
  const kmsKeyId = core.getInput("kms-key-id", { required: true });
  const region = core.getInput("aws-region", { required: true });
  const apiUrl =
    core.getInput("github-api-url") || process.env.GITHUB_API_URL || "https://api.github.com";

  const kmsClient = new KMSClient({ region });
  const { jwt } = await createAppJwt({ appId, kmsKeyId, kmsClient });
  const { token, expiresAt } = await createInstallationToken({
    appJwt: jwt,
    installationId,
    apiUrl,
    permissions: optionalJsonObjectInput("permissions"),
    repositories: optionalJsonStringArrayInput("repositories"),
  });

  core.setSecret(jwt);
  core.setSecret(token);
  core.setOutput("token", token);
  core.setOutput("expires-at", expiresAt);
}

if (process.env.NODE_ENV !== "test") {
  run().catch((error) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}
