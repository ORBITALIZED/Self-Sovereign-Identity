/**
 * Typed errors thrown by the SDK. Apps should `instanceof`-check these.
 */

export class SSIError extends Error {
  readonly code: string;
  constructor(code: string, message: string, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = "SSIError";
    this.code = code;
  }
}

export class IdentityAlreadyExistsError extends SSIError {
  constructor(pubkey: string) {
    super("IDENTITY_EXISTS", `identity already exists for ${pubkey}`);
    this.name = "IdentityAlreadyExistsError";
  }
}

export class IdentityNotFoundError extends SSIError {
  constructor(pubkey: string) {
    super("IDENTITY_NOT_FOUND", `identity not found for ${pubkey}`);
    this.name = "IdentityNotFoundError";
  }
}

export class UnauthorizedIssuerError extends SSIError {
  constructor(addr: string) {
    super("UNAUTHORIZED_ISSUER", `${addr} is not an authorised issuer`);
    this.name = "UnauthorizedIssuerError";
  }
}

export class ZKProofError extends SSIError {
  constructor(message: string) {
    super("ZK_PROOF_ERROR", message);
    this.name = "ZKProofError";
  }
}

export class ChainConnectionError extends SSIError {
  constructor(chain: "stellar" | "evm", url: string) {
    super("CHAIN_CONNECTION", `cannot connect to ${chain} at ${url}`);
    this.name = "ChainConnectionError";
  }
}
