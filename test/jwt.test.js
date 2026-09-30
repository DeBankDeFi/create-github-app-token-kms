import assert from "node:assert/strict";
import { generateKeyPairSync, sign, verify } from "node:crypto";
import test from "node:test";

import { createAppJwt } from "../src/jwt.js";

function decodeJson(segment) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

test("creates an RS256 JWT from a KMS signature over header.payload", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  let sentCommand;
  const kmsClient = {
    async send(command) {
      sentCommand = command;
      return {
        Signature: sign("RSA-SHA256", command.input.Message, privateKey),
      };
    },
  };

  const now = new Date("2026-09-30T02:00:00.000Z");
  const { jwt, expiresAt } = await createAppJwt({
    appId: "Iv1.testClientId",
    kmsKeyId: "arn:aws:kms:ap-southeast-1:123456789012:key/test",
    kmsClient,
    now,
  });

  const [headerSegment, payloadSegment, signatureSegment] = jwt.split(".");
  assert.deepEqual(decodeJson(headerSegment), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(decodeJson(payloadSegment), {
    iat: 1790733540,
    exp: 1790734140,
    iss: "Iv1.testClientId",
  });
  assert.equal(expiresAt.toISOString(), "2026-09-30T02:09:00.000Z");

  assert.deepEqual(sentCommand.input, {
    KeyId: "arn:aws:kms:ap-southeast-1:123456789012:key/test",
    Message: Buffer.from(`${headerSegment}.${payloadSegment}`, "ascii"),
    MessageType: "RAW",
    SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
  });
  assert.equal(
    verify(
      "RSA-SHA256",
      Buffer.from(`${headerSegment}.${payloadSegment}`, "ascii"),
      publicKey,
      Buffer.from(signatureSegment, "base64url"),
    ),
    true,
  );
});

test("rejects a KMS response without a signature", async () => {
  await assert.rejects(
    createAppJwt({
      appId: "Iv1.testClientId",
      kmsKeyId: "key-id",
      kmsClient: { send: async () => ({}) },
    }),
    /returned no signature/,
  );
});
