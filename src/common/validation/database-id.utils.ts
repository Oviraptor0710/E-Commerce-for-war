import { BadRequestException } from '@nestjs/common';
import { APP_RESPONSE, buildResponse } from '../constants/response.constants';
import { MYSQL_SIGNED_BIGINT_MAX } from './constants/database-limits.constants';

export const CANONICAL_POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
export const CANONICAL_NON_NEGATIVE_INTEGER_PATTERN = /^(0|[1-9]\d*)$/;

export function isCanonicalPositiveIntegerString(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' && CANONICAL_POSITIVE_INTEGER_PATTERN.test(value)
  );
}

export function isWithinMysqlSignedBigIntRange(value: string): boolean {
  return (
    value.length < MYSQL_SIGNED_BIGINT_MAX.length ||
    (value.length === MYSQL_SIGNED_BIGINT_MAX.length &&
      value <= MYSQL_SIGNED_BIGINT_MAX)
  );
}

export type DatabaseIdErrorCode = '1002' | '1003' | '1004';

export function databaseIdValidationException(
  code: DatabaseIdErrorCode,
): BadRequestException {
  const response =
    code === APP_RESPONSE.PARAMETER_NOT_ENOUGH.code
      ? APP_RESPONSE.PARAMETER_NOT_ENOUGH
      : code === APP_RESPONSE.PARAMETER_TYPE_INVALID.code
        ? APP_RESPONSE.PARAMETER_TYPE_INVALID
        : APP_RESPONSE.PARAMETER_VALUE_INVALID;

  return new BadRequestException(buildResponse(response, null));
}
