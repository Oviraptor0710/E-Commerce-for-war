import { ApiResponse } from '../interfaces/api-response.interface';

const defineResponse = <TCode extends string, TMessage extends string>(
  code: TCode,
  message: TMessage,
) => ({ code, message, data: null }) as const;

export const APP_RESPONSE = {
  OK: defineResponse('1000', 'OK.'),
  SPAM: defineResponse('9991', 'Spam.'),
  PRODUCT_NOT_EXISTED: defineResponse('9992', 'Product is not existed.'),
  CODE_VERIFY_INCORRECT: defineResponse('9993', 'Code verify is incorrect.'),
  NO_DATA_OR_END_OF_LIST: defineResponse(
    '9994',
    'No Data or end of list data.',
  ),
  USER_NOT_VALIDATED: defineResponse('9995', 'User is not validated.'),
  USER_EXISTED: defineResponse('9996', 'User existed.'),
  METHOD_INVALID: defineResponse('9997', 'Method is invalid.'),
  TOKEN_INVALID: defineResponse('9998', 'Token is invalid.'),
  EXCEPTION_ERROR: defineResponse('9999', 'Exception error.'),
  CAN_NOT_CONNECT_DB: defineResponse('1001', 'Can not connect to DB.'),
  PARAMETER_NOT_ENOUGH: defineResponse('1002', 'Parameter is not enough.'),
  PARAMETER_TYPE_INVALID: defineResponse('1003', 'Parameter type is invalid.'),
  PARAMETER_VALUE_INVALID: defineResponse(
    '1004',
    'Parameter value is invalid.',
  ),
  UNKNOWN_ERROR: defineResponse('1005', 'Unknown error.'),
  FILE_SIZE_TOO_BIG: defineResponse('1006', 'File size is too big.'),
  UPLOAD_FILE_FAILED: defineResponse('1007', 'Upload File Failed!.'),
  MAXIMUM_NUMBER_OF_IMAGES: defineResponse('1008', 'Maximum number of images.'),
  NOT_ACCESS: defineResponse('1009', 'Not access.'),
  ACTION_DONE_PREVIOUSLY: defineResponse(
    '1010',
    'action has been done previously by this user.',
  ),
  PRODUCT_SOLD: defineResponse('1011', 'The product has been sold.'),
  ADDRESS_NOT_SUPPORT_SHIPPING: defineResponse(
    '1012',
    'Address does not support Shipping.',
  ),
  USER_NOT_EXIST: defineResponse('1013', 'User does not exist.'),
  PROMOTIONAL_CODE_EXPIRED: defineResponse('1014', 'Promotional code expired.'),
  CAN_NOT_PROCESS_BANK_CARD: defineResponse(
    '1015',
    'Can not process bank card.',
  ),
  POLICY_VIOLATION: defineResponse(
    '1016',
    'Policy Violation, not support weight over 20KG & price over 30M.',
  ),
  CHANGE_USERNAME_MIN_30_DAYS: defineResponse(
    '1017',
    'Change Username: requires minimum 30 days.',
  ),
  CHANGE_USERNAME_SAME_OTHER_NAME: defineResponse(
    '1018',
    'Change Username: same other name.',
  ),
} as const;

export type AppResponseKey = keyof typeof APP_RESPONSE;
export type AppResponseDefinition = (typeof APP_RESPONSE)[AppResponseKey];

export const buildResponse = <T = unknown>(
  response: { code: string; message: string },
  data: T | null = null,
): ApiResponse<T> => ({
  code: response.code,
  message: response.message,
  data,
});
