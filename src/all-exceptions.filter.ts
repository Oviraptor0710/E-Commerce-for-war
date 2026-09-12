import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  APP_RESPONSE,
  buildResponse,
} from './common/constants/response.constants';
import { ApiResponse } from './common/interfaces/api-response.interface';

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    'data' in candidate
  );
}

function responseForHttpStatus(status: number) {
  if (status === 401) return APP_RESPONSE.TOKEN_INVALID;
  if (status === 403) return APP_RESPONSE.NOT_ACCESS;
  if (status >= 400 && status < 500)
    return APP_RESPONSE.PARAMETER_VALUE_INVALID;
  return APP_RESPONSE.EXCEPTION_ERROR;
}

@Catch() // Bắt mọi loại lỗi
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (
      exception instanceof Error &&
      exception.name === 'MulterError' &&
      (exception as Error & { code?: string }).code === 'LIMIT_FILE_SIZE'
    ) {
      return response
        .status(HttpStatus.OK)
        .json(buildResponse(APP_RESPONSE.FILE_SIZE_TOO_BIG, null));
    }

    // Nếu lỗi là HttpException (các lỗi do bạn chủ động ném ra hoặc từ Pipe)
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (isApiResponse(exceptionResponse)) {
        return response.status(HttpStatus.OK).json(exceptionResponse);
      }

      return response
        .status(HttpStatus.OK)
        .json(
          buildResponse(responseForHttpStatus(exception.getStatus()), null),
        );
    }

    // Nếu là lỗi hệ thống (500 Internal Server Error, crash code...)
    return response
      .status(HttpStatus.OK)
      .json(buildResponse(APP_RESPONSE.EXCEPTION_ERROR, null));
  }
}
