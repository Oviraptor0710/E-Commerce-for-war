import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';

export class ApiResponseBaseDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  message!: string;
}

type ScalarType = typeof String | typeof Number | typeof Boolean;
type ApiDataType = Type<unknown> | ScalarType;

export interface ApiDataResponseOptions {
  /** HTTP status returned by the endpoint on success. */
  status?: number;
  /** DTO or scalar type carried in the `data` field. Omit for null-only data. */
  type?: ApiDataType;
  /** Set when successful data is a list of the supplied type. */
  isArray?: boolean;
  /** Most endpoints return null in `data` when their application code is not 1000. */
  nullable?: boolean;
  description?: string;
}

function schemaForType(type?: ApiDataType, isArray = false, nullable = true) {
  if (!type) {
    return {
      nullable: true,
      description: 'Không có dữ liệu trả về.',
    };
  }

  const scalarTypes = new Map<ApiDataType, string>([
    [String, 'string'],
    [Number, 'number'],
    [Boolean, 'boolean'],
  ]);
  const scalar = scalarTypes.get(type);

  if (isArray) {
    return {
      type: 'array',
      nullable,
      items: scalar ? { type: scalar } : { $ref: getSchemaPath(type) },
    };
  }

  return scalar
    ? { type: scalar, nullable }
    : { allOf: [{ $ref: getSchemaPath(type) }], nullable };
}

/**
 * Documents the response envelope used by buildResponse() while keeping the
 * payload model specific to each endpoint.
 */
export function ApiDataResponse(options: ApiDataResponseOptions = {}) {
  const {
    status = 200,
    type,
    isArray = false,
    nullable = true,
    description,
  } = options;
  const extraModels: Function[] = [ApiResponseBaseDto];
  if (type && ![String, Number, Boolean].includes(type as ScalarType)) {
    extraModels.push(type as Type<unknown>);
  }

  return applyDecorators(
    ApiExtraModels(...extraModels),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseBaseDto) },
          {
            type: 'object',
            required: ['data'],
            properties: {
              data: schemaForType(type, isArray, nullable),
            },
          },
        ],
      },
    }),
  );
}
