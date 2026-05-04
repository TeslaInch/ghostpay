/**
 * Minimal Encrypt gRPC client.
 *
 * Loads the .proto schema dynamically with @grpc/proto-loader so we don't
 * need a protoc/codegen step. Mirrors the API of @encrypt.xyz/pre-alpha-solana-client.
 */

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROTO_PATH = join(__dirname, "encrypt_service.proto");

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: Number,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDef) as any;
const EncryptService = proto.encrypt.v1.EncryptService;

export const Chain = { Solana: 0 } as const;
export type Chain = (typeof Chain)[keyof typeof Chain];

export interface EncryptedInput {
  ciphertextBytes: Uint8Array;
  fheType: number;
}

export interface CreateInputParams {
  chain: number;
  inputs: EncryptedInput[];
  proof?: Buffer;
  authorized: Buffer;
  networkEncryptionPublicKey: Buffer;
}

export interface CreateInputResult {
  ciphertextIdentifiers: Uint8Array[];
}

export interface ReadCiphertextParams {
  message: Buffer;
  signature: Buffer;
  signer: Buffer;
}

export interface ReadCiphertextResult {
  value: Buffer;
  fheType: number;
  digest: Buffer;
}

export const DEVNET_PRE_ALPHA_GRPC_URL =
  "pre-alpha-dev-1.encrypt.ika-network.net:443";

export function createEncryptClient(grpcUrl: string = DEVNET_PRE_ALPHA_GRPC_URL) {
  const isLocal =
    grpcUrl.startsWith("localhost") || grpcUrl.startsWith("127.0.0.1");
  const creds = isLocal
    ? grpc.credentials.createInsecure()
    : grpc.credentials.createSsl();
  const client = new EncryptService(grpcUrl, creds);

  return {
    createInput(params: CreateInputParams): Promise<CreateInputResult> {
      return new Promise((resolve, reject) => {
        client.CreateInput(
          {
            chain: params.chain,
            inputs: params.inputs.map((inp) => ({
              ciphertextBytes: Buffer.from(inp.ciphertextBytes),
              fheType: inp.fheType,
            })),
            proof: params.proof ?? Buffer.alloc(0),
            authorized: Buffer.from(params.authorized),
            networkEncryptionPublicKey: Buffer.from(
              params.networkEncryptionPublicKey
            ),
          },
          (err: grpc.ServiceError | null, response: any) => {
            if (err) reject(err);
            else
              resolve({
                ciphertextIdentifiers: response.ciphertextIdentifiers,
              });
          }
        );
      });
    },

    readCiphertext(params: ReadCiphertextParams): Promise<ReadCiphertextResult> {
      return new Promise((resolve, reject) => {
        client.ReadCiphertext(
          {
            message: params.message,
            signature: params.signature,
            signer: params.signer,
          },
          (err: grpc.ServiceError | null, response: any) => {
            if (err) reject(err);
            else
              resolve({
                value: response.value,
                fheType: response.fheType,
                digest: response.digest,
              });
          }
        );
      });
    },

    close() {
      client.close();
    },
  };
}

/**
 * BCS-encode a ReadCiphertextMessage.
 *
 * Format: chain(u8) + ciphertext_identifier(vec) + reencryption_key(vec) + epoch(u64)
 * where vec = ULEB128 length prefix + bytes (1 byte for len < 128).
 */
export function encodeReadCiphertextMessage(
  chain: number,
  ciphertextIdentifier: Uint8Array,
  reencryptionKey: Uint8Array,
  epoch: bigint
): Buffer {
  const ctIdLen = ciphertextIdentifier.length;
  const rekeyLen = reencryptionKey.length;
  const totalLen = 1 + 1 + ctIdLen + 1 + rekeyLen + 8;
  const buf = Buffer.alloc(totalLen);
  let offset = 0;

  buf[offset++] = chain;
  buf[offset++] = ctIdLen;
  Buffer.from(ciphertextIdentifier).copy(buf, offset);
  offset += ctIdLen;
  buf[offset++] = rekeyLen;
  Buffer.from(reencryptionKey).copy(buf, offset);
  offset += rekeyLen;
  buf.writeBigUInt64LE(epoch, offset);

  return buf;
}
