import { BadRequestException } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import {
  IsPositiveBigIntId,
  IsPositiveIntId,
  MYSQL_SIGNED_BIGINT_MAX,
  MYSQL_SIGNED_INT_MAX,
  ParsePositiveBigIntIdPipe,
  ParsePositiveIntIdPipe,
} from '../../../src/common/validation';
import {
  APP_RESPONSE,
  buildResponse,
} from '../../../src/common/constants/response.constants';
import { CancelOrderDto } from '../../../src/modules/orders/dto/cancel-order.dto';
import { SetReadNotificationDto } from '../../../src/modules/notifications/dto/set-read-notification.dto';

class RequiredIdsDto {
  @IsPositiveIntId()
  int_id: unknown;

  @IsPositiveBigIntId()
  bigint_id: unknown;
}

class OptionalIdsDto {
  @IsPositiveIntId({ required: false })
  int_id?: unknown;

  @IsPositiveBigIntId({ required: false })
  bigint_id?: unknown;
}

function validationMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...validationMessages(error.children ?? []),
  ]);
}

function expectPipeError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('Expected the pipe to reject the value.');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      code,
    });
  }
}

describe('database ID validation infrastructure', () => {
  describe('IsPositiveIntId', () => {
    it.each([1, MYSQL_SIGNED_INT_MAX])('accepts INT ID %s', async (value) => {
      const dto = Object.assign(new RequiredIdsDto(), {
        int_id: value,
        bigint_id: '1',
      });

      expect(await validate(dto)).toHaveLength(0);
    });

    it('distinguishes missing, wrong type and out-of-range values', async () => {
      const missing = Object.assign(new RequiredIdsDto(), { bigint_id: '1' });
      const wrongType = Object.assign(new RequiredIdsDto(), {
        int_id: '1',
        bigint_id: '1',
      });
      const outOfRange = Object.assign(new RequiredIdsDto(), {
        int_id: MYSQL_SIGNED_INT_MAX + 1,
        bigint_id: '1',
      });

      expect(validationMessages(await validate(missing))).toContain('1002');
      expect(validationMessages(await validate(wrongType))).toContain('1003');
      expect(validationMessages(await validate(outOfRange))).toContain('1004');
    });
  });

  describe('IsPositiveBigIntId', () => {
    it.each(['1', MYSQL_SIGNED_BIGINT_MAX])(
      'accepts BIGINT ID %s',
      async (value) => {
        const dto = Object.assign(new RequiredIdsDto(), {
          int_id: 1,
          bigint_id: value,
        });

        expect(await validate(dto)).toHaveLength(0);
      },
    );

    it.each(['001', '1.5', '1e3', ' 1', '9223372036854775808'])(
      'rejects non-canonical or out-of-range BIGINT ID %s',
      async (value) => {
        const dto = Object.assign(new RequiredIdsDto(), {
          int_id: 1,
          bigint_id: value,
        });

        expect(validationMessages(await validate(dto))).toContain('1004');
      },
    );

    it('rejects a JSON number with type error 1003', async () => {
      const dto = Object.assign(new RequiredIdsDto(), {
        int_id: 1,
        bigint_id: 1,
      });

      expect(validationMessages(await validate(dto))).toContain('1003');
    });
  });

  it('allows omitted optional IDs but rejects explicit null', async () => {
    expect(await validate(new OptionalIdsDto())).toHaveLength(0);

    const dto = Object.assign(new OptionalIdsDto(), {
      int_id: null,
      bigint_id: null,
    });
    expect(validationMessages(await validate(dto))).toContain('1003');
  });

  describe('ID parsing pipes', () => {
    const intPipe = new ParsePositiveIntIdPipe();
    const bigintPipe = new ParsePositiveBigIntIdPipe();

    it('parses a valid INT route parameter to number', () => {
      expect(intPipe.transform('123')).toBe(123);
    });

    it('keeps a valid BIGINT route parameter as string', () => {
      expect(bigintPipe.transform(MYSQL_SIGNED_BIGINT_MAX)).toBe(
        MYSQL_SIGNED_BIGINT_MAX,
      );
    });

    it('returns the established API error codes', () => {
      expectPipeError(() => intPipe.transform(undefined), '1002');
      expectPipeError(() => intPipe.transform(1), '1003');
      expectPipeError(() => intPipe.transform('2147483648'), '1004');
      expectPipeError(() => bigintPipe.transform('001'), '1004');
      expectPipeError(
        () => bigintPipe.transform('9223372036854775808'),
        '1004',
      );
    });
  });

  describe('representative API contracts', () => {
    it('requires an order INT ID to be a JSON number', async () => {
      const valid = Object.assign(new CancelOrderDto(), { id: 12 });
      const invalid = Object.assign(new CancelOrderDto(), { id: '12' });

      expect(await validate(valid)).toHaveLength(0);
      expect(validationMessages(await validate(invalid))).toContain('1003');
    });

    it('requires a notification BIGINT ID to be a JSON string', async () => {
      const valid = Object.assign(new SetReadNotificationDto(), {
        notification_id: '12',
      });
      const invalid = Object.assign(new SetReadNotificationDto(), {
        notification_id: 12,
      });

      expect(await validate(valid)).toHaveLength(0);
      expect(validationMessages(await validate(invalid))).toContain('1003');
    });

    it('keeps every response inside the code/message/data envelope', () => {
      expect(APP_RESPONSE.PARAMETER_VALUE_INVALID).toEqual({
        code: '1004',
        message: 'Parameter value is invalid.',
        data: null,
      });
      expect(buildResponse(APP_RESPONSE.OK, { id: 1 })).toEqual({
        code: '1000',
        message: 'OK.',
        data: { id: 1 },
      });
    });
  });
});
