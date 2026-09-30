const API_VERSION = "2026-03-10";
const USER_AGENT = "create-github-app-token-kms";

function apiUrlFor(apiUrl, path) {
  const normalizedApiUrl = apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`;
  return new URL(path, normalizedApiUrl).toString();
}

function githubHeaders(appJwt) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${appJwt}`,
    "User-Agent": USER_AGENT,
    "X-GitHub-Api-Version": API_VERSION,
  };
}

/**
 * Resolves the GitHub App installation for an OWNER/REPOSITORY string.
 *
 * @param {{ appJwt: string, repository: string, apiUrl: string, fetchImplementation?: typeof fetch }} options
 * @returns {Promise<string>}
 */
export async function getInstallationIdForRepository({
  appJwt,
  repository,
  apiUrl,
  fetchImplementation = fetch,
}) {
  const [owner, repositoryName, ...remainingParts] = repository.split("/");
  if (!owner || !repositoryName || remainingParts.length > 0) {
    throw new Error("Repository must use the OWNER/REPOSITORY format.");
  }

  const response = await fetchImplementation(
    apiUrlFor(
      apiUrl,
      `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}/installation`,
    ),
    {
      method: "GET",
      headers: githubHeaders(appJwt),
    },
  );

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `GitHub installation lookup for '${repository}' failed (${response.status}): ${responseText}`,
    );
  }

  const result = await response.json();
  if (typeof result.id !== "number" && typeof result.id !== "string") {
    throw new Error(`GitHub installation lookup for '${repository}' returned no installation ID.`);
  }

  return String(result.id);
}

/**
 * Exchanges a GitHub App JWT for an installation access token.
 *
 * @param {{ appJwt: string, installationId: string, apiUrl: string, permissions?: object, repositories?: string[], fetchImplementation?: typeof fetch }} options
 * @returns {Promise<{ token: string, expiresAt: string }>}
 */
export async function createInstallationToken({
  appJwt,
  installationId,
  apiUrl,
  permissions,
  repositories,
  fetchImplementation = fetch,
}) {
  const body = {};
  if (permissions) {
    body.permissions = permissions;
  }
  if (repositories) {
    body.repositories = repositories;
  }

  const response = await fetchImplementation(
    apiUrlFor(apiUrl, `app/installations/${encodeURIComponent(installationId)}/access_tokens`),
    {
      method: "POST",
      headers: githubHeaders(appJwt),
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `GitHub installation token request failed (${response.status}): ${responseText}`,
    );
  }

  const result = await response.json();
  if (typeof result.token !== "string" || typeof result.expires_at !== "string") {
    throw new Error("GitHub installation token response did not contain token and expires_at.");
  }

  return { token: result.token, expiresAt: result.expires_at };
}
