import {
  IsDefined,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateBy,
  ValidateIf,
} from 'class-validator';
import { CANONICAL_NON_NEGATIVE_INTEGER_PATTERN } from '../database-id.utils';
import { DatabaseIdValidationOptions } from '../types/database-id.types';

export function IsNonNegativeBigIntId(
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
    Matches(CANONICAL_NON_NEGATIVE_INTEGER_PATTERN, { message: '1004' })(
      target,
      propertyName,
    );
    ValidateBy(
      {
        name: 'isWithinMysqlSignedBigIntRange',
        validator: {
          validate(value: unknown): boolean {
            if (typeof value !== 'string' || !/^\d+$/.test(value)) return true;
            return BigInt(value) <= 9223372036854775807n;
          },
        },
      },
      { message: '1004' },
    )(target, propertyName);
  };
}
