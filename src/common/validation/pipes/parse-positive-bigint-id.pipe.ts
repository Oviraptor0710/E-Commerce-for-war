import { Injectable, PipeTransform } from '@nestjs/common';
import {
  databaseIdValidationException,
  isCanonicalPositiveIntegerString,
  isWithinMysqlSignedBigIntRange,
} from '../database-id.utils';
import { BigIntId } from '../types/database-id.types';

@Injectable()
export class ParsePositiveBigIntIdPipe implements PipeTransform<
  unknown,
  BigIntId
> {
  transform(value: unknown): BigIntId {
    if (value === undefined || value === null || value === '') {
      throw databaseIdValidationException('1002');
    }
    if (typeof value !== 'string') {
      throw databaseIdValidationException('1003');
    }
    if (
      !isCanonicalPositiveIntegerString(value) ||
      !isWithinMysqlSignedBigIntRange(value)
    ) {
      throw databaseIdValidationException('1004');
    }

    return value;
  }
}
