import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

interface CommentPayload {
  content?: unknown;
  media_ids?: unknown;
}

export function HasCommentPayload(
  validationOptions: ValidationOptions = {},
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'hasCommentPayload',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: { message: '1004', ...validationOptions },
      validator: {
        validate(_value: unknown, args: ValidationArguments): boolean {
          const payload = args.object as CommentPayload;
          const hasContent =
            typeof payload.content === 'string' &&
            payload.content.trim().length > 0;
          const hasMedia =
            Array.isArray(payload.media_ids) && payload.media_ids.length > 0;
          return hasContent || hasMedia;
        },
      },
    });
  };
}
