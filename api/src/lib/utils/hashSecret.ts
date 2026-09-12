import bcrypt from "bcrypt";
import { AppResult } from "@/lib/result";
import { EncryptionError } from "@/lib/errors/domain";
import { ResultAsync } from "neverthrow";

const SALT_ROUNDS = 10;

export const hashSecret = (
  secret: string,
): AppResult<string, EncryptionError> =>
  ResultAsync.fromPromise(
    bcrypt.hash(secret, SALT_ROUNDS),
    (error) => new EncryptionError(String(error)),
  );

export const compareSecret = (
  plainSecret: string,
  hashedSecret: string,
): AppResult<boolean, EncryptionError> =>
  ResultAsync.fromPromise(
    bcrypt.compare(plainSecret, hashedSecret),
    (error) => new EncryptionError(String(error)),
  );