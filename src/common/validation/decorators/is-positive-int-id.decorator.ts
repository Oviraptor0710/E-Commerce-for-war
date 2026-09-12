import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { MYSQL_SIGNED_INT_MAX } from '../constants/database-limits.constants';
import { DatabaseIdValidationOptions } from '../types/database-id.types';

export function IsPositiveIntId(
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

    IsInt({ message: '1003' })(target, propertyName);
    Min(1, { message: '1004' })(target, propertyName);
    Max(MYSQL_SIGNED_INT_MAX, { message: '1004' })(target, propertyName);
  };
}
