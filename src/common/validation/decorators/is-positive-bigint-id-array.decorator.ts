import { ValidateBy, ValidationOptions } from 'class-validator';
import {
  isCanonicalPositiveIntegerString,
  isWithinMysqlSignedBigIntRange,
} from '../database-id.utils';

export function IsPositiveBigIntIdArray(
  validationOptions: ValidationOptions = {},
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isPositiveBigIntIdArray',
      validator: {
        validate(value: unknown): boolean {
          if (!Array.isArray(value)) return true;
          return value.every(
            (item) =>
              isCanonicalPositiveIntegerString(item) &&
              isWithinMysqlSignedBigIntRange(item),
          );
        },
      },
    },
    { message: '1004', ...validationOptions },
  );
}
