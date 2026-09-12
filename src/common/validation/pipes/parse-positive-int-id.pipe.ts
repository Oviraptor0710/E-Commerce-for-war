import { Injectable, PipeTransform } from '@nestjs/common';
import { MYSQL_SIGNED_INT_MAX } from '../constants/database-limits.constants';
import {
  databaseIdValidationException,
  isCanonicalPositiveIntegerString,
} from '../database-id.utils';
import { IntId } from '../types/database-id.types';

@Injectable()
export class ParsePositiveIntIdPipe implements PipeTransform<unknown, IntId> {
  transform(value: unknown): IntId {
    if (value === undefined || value === null || value === '') {
      throw databaseIdValidationException('1002');
    }
    if (typeof value !== 'string') {
      throw databaseIdValidationException('1003');
    }
    if (!isCanonicalPositiveIntegerString(value)) {
      throw databaseIdValidationException('1004');
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed > MYSQL_SIGNED_INT_MAX) {
      throw databaseIdValidationException('1004');
    }

    return parsed;
  }
}
