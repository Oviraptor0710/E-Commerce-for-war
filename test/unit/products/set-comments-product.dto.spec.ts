import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetCommentsProductDto } from '../../../src/modules/products/dto/set_comments_product.dto';

async function errorsFor(payload: Record<string, unknown>) {
  return validate(plainToInstance(SetCommentsProductDto, payload));
}

describe('SetCommentsProductDto', () => {
  const base = {
    product_id: '1',
    idempotency_key: 'comment-request-1',
  };

  it.each([
    { ...base, content: 'Nội dung' },
    { ...base, media_ids: ['10'] },
    { ...base, content: 'Nội dung', media_ids: ['10', '11', '12', '13'] },
  ])('accepts a supported comment payload', async (payload) => {
    await expect(errorsFor(payload)).resolves.toHaveLength(0);
  });

  it.each([
    base,
    { ...base, content: '   ' },
    { ...base, content: 'x'.repeat(2001) },
    { ...base, media_ids: [] },
    { ...base, media_ids: ['10', '10'] },
    { ...base, media_ids: ['10', '11', '12', '13', '14'] },
    { ...base, media_ids: ['01'] },
    { ...base, media_ids: ['9223372036854775808'] },
  ])('rejects an unsupported comment payload', async (payload) => {
    expect(await errorsFor(payload)).not.toHaveLength(0);
  });
});
