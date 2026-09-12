import {
  IsDefined,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateBy,
  ValidateIf,
} from 'class-validator';
import {
  CANONICAL_POSITIVE_INTEGER_PATTERN,
  isCanonicalPositiveIntegerString,
  isWithinMysqlSignedBigIntRange,
} from '../database-id.utils';
import { DatabaseIdValidationOptions } from '../types/database-id.types';

function IsWithinMysqlSignedBigIntRange(): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isWithinMysqlSignedBigIntRange',
      validator: {
        validate(value: unknown): boolean {
          if (!isCanonicalPositiveIntegerString(value)) return true;
          return isWithinMysqlSignedBigIntRange(value);
        },
      },
    },
    { message: '1004' },
  );
}

export function IsPositiveBigIntId(
  options: DatabaseIdValidationOptions = {},
): PropertyDecorator {
  const required = options.required ?? true;

  return (target: object, propertyKey: string | symbol) => {
    const propertyName = propertyKey.toString();

    if (required) {
      IsDefined({ message: '1002' })(target, propertyName);
      IsNotEmpty({ message: '1002' })(target, propertyName);
    } else {
      ValidateIf((_object, value: unknown) => value !== undefined)(
        target,
        propertyName,
      );
    }

    IsString({ message: '1003' })(target, propertyName);
    Matches(CANONICAL_POSITIVE_INTEGER_PATTERN, { message: '1004' })(
      target,
      propertyName,
    );
    IsWithinMysqlSignedBigIntRange()(target, propertyName);
  };
}
