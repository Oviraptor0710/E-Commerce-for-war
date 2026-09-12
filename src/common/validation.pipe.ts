import {
  BadRequestException,
  Injectable,
  ValidationError,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';
import { APP_RESPONSE, buildResponse } from './constants/response.constants';

@Injectable()
export class ValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = flattenErrors(errors);

        const hasMissingField = messages.includes('1002');
        const hasInvalidType = messages.includes('1003');

        const response = hasMissingField
          ? APP_RESPONSE.PARAMETER_NOT_ENOUGH
          : hasInvalidType
            ? APP_RESPONSE.PARAMETER_TYPE_INVALID
            : APP_RESPONSE.PARAMETER_VALUE_INVALID;

        return new BadRequestException(buildResponse(response, null));
      },
    });
  }
}

function flattenErrors(errors: ValidationError[]): string[] {
  const result: string[] = [];

  for (const error of errors) {
    if (error.constraints) {
      result.push(...Object.values(error.constraints));
    }

    if (error.children && error.children.length > 0) {
      result.push(...flattenErrors(error.children));
    }
  }

  return result;
}
