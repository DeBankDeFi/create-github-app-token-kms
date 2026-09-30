const API_VERSION = "2026-03-10";
const USER_AGENT = "create-github-app-token-kms";

function installationTokenUrl(apiUrl, installationId) {
  const normalizedApiUrl = apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`;
  return new URL(
    `app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    normalizedApiUrl,
  ).toString();
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
    installationTokenUrl(apiUrl, installationId),
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${appJwt}`,
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": API_VERSION,
      },
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
