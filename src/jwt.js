import { SignCommand } from "@aws-sdk/client-kms";

const JWT_ALGORITHM = "RS256";
const KMS_SIGNING_ALGORITHM = "RSASSA_PKCS1_V1_5_SHA_256";
const CLOCK_SKEW_SECONDS = 60;
const JWT_LIFETIME_SECONDS = 9 * 60;

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

/**
 * Creates a GitHub App JWT signed by an asymmetric AWS KMS signing key.
 *
 * @param {{ appId: string, kmsKeyId: string, kmsClient: { send(command: SignCommand): Promise<{ Signature?: Uint8Array }> }, now?: Date }} options
 * @returns {Promise<{ jwt: string, expiresAt: Date }>}
 */
export async function createAppJwt({ appId, kmsKeyId, kmsClient, now = new Date() }) {
  const currentTimeSeconds = Math.floor(now.getTime() / 1000);
  const issuedAt = currentTimeSeconds - CLOCK_SKEW_SECONDS;
  const expiresAtSeconds = currentTimeSeconds + JWT_LIFETIME_SECONDS;

  const header = base64UrlEncode(JSON.stringify({ alg: JWT_ALGORITHM, typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({ iat: issuedAt, exp: expiresAtSeconds, iss: appId }),
  );
  const signingInput = `${header}.${payload}`;

  const response = await kmsClient.send(
    new SignCommand({
      KeyId: kmsKeyId,
      Message: Buffer.from(signingInput, "ascii"),
      MessageType: "RAW",
      SigningAlgorithm: KMS_SIGNING_ALGORITHM,
    }),
  );

  if (!response.Signature) {
    throw new Error("AWS KMS Sign returned no signature.");
  }

  return {
    jwt: `${signingInput}.${base64UrlEncode(response.Signature)}`,
    expiresAt: new Date(expiresAtSeconds * 1000),
  };
}
