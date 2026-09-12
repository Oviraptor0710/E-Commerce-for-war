import { conversationAction } from '../../helpers/actions/conversation.action';
import { getTestUsers, TestUser } from '../../helpers/test-user.helper';
import { failMsg } from '../../helpers/api-client.helper';
import { RESPONSE } from '../../constants/respones';
import { EXPIRED_TOKEN } from '../../fixtures/user.fixture';

let U1: TestUser;
let U2: TestUser;
let U3: TestUser;
let U4: TestUser;
let U5: TestUser;

let convIdValid: string;

beforeAll(async () => {
  [U1, U2, U3, U4, U5] = getTestUsers();

  const sendRes = await conversationAction.sendMessage(U1.token, {
    to_id: Number(U2.userId),
    client_message_id: `get-conversation:${Date.now()}:${Math.floor(Math.random() * 1_000_000)}`,
    message: 'Khởi tạo dữ liệu hội thoại',
    type_message: 'text',
  });
  convIdValid = sendRes.body.data?.conversation_id || '1';
});

// Thành công
describe('Thành công', () => {
  it('TC24 — Lấy conversation theo partner_id, có tin nhắn', async () => {
    const res = await conversationAction.getConversation(U1.token, {
      partner_id: Number(U2.userId),
      index: 0,
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(RESPONSE.OK.code);
    expect(Array.isArray(res.body.data.messages), failMsg(res)).toBe(true);
    expect(res.body.data.messages.length, failMsg(res)).toBeGreaterThanOrEqual(
      1,
    );
    expect(res.body.data.can_send_message, failMsg(res)).toBe(true);
  });

  it('TC25 — Lấy conversation với partner chưa nhắn tin → messages rỗng, can_send_message = true', async () => {
    const res = await conversationAction.getConversation(U3.token, {
      partner_id: Number(U4.userId),
      index: 0,
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(RESPONSE.OK.code);
    expect(res.body.data.messages, failMsg(res)).toEqual([]);
    expect(res.body.data.can_send_message, failMsg(res)).toBe(true);
  });

  it('TC26 — can_send_message = false khi có block (user1 ↔ user5)', async () => {
    const res = await conversationAction.getConversation(U1.token, {
      partner_id: Number(U5.userId),
      index: 0,
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(RESPONSE.OK.code);
    expect(res.body.data.can_send_message, failMsg(res)).toBe(false);
  });

  it('TC27 — Phân trang: index=2 trả về mảng rỗng khi ít tin nhắn', async () => {
    const res = await conversationAction.getConversation(U1.token, {
      partner_id: Number(U2.userId),
      index: 20,
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(RESPONSE.OK.code);
    expect(res.body.data.messages, failMsg(res)).toEqual([]);
  });

  it('TC28 — Lấy conversation theo conversation_id hợp lệ', async () => {
    const res = await conversationAction.getConversation(U1.token, {
      conversation_id: String(convIdValid),
      index: 0,
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(RESPONSE.OK.code);
    expect(Array.isArray(res.body.data.messages), failMsg(res)).toBe(true);
  });
});

// Thất bại -> Thiếu tham số
describe('Thiếu tham số', () => {
  it('TC29 — Không có token', async () => {
    const res = await conversationAction.getConversationRaw(null, {
      partner_id: Number(U2.userId),
      index: 0,
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(RESPONSE.TOKEN_INVALID.code);
  });

  it('TC30 — Không có partner_id lẫn conversation_id', async () => {
    const res = await conversationAction.getConversationRaw(U1.token, {
      index: 0,
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(
      RESPONSE.PARAMETER_VALUE_INVALID.code,
    );
    expect(res.body.data, failMsg(res)).toBeNull();
  });

  it('TC31 — Thiếu index', async () => {
    const res = await conversationAction.getConversationRaw(U1.token, {
      partner_id: Number(U2.userId),
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(
      RESPONSE.PARAMETER_NOT_ENOUGH.code,
    );
    expect(res.body.data, failMsg(res)).toBeNull();
  });

  it('TC32 — Thiếu count', async () => {
    const res = await conversationAction.getConversationRaw(U1.token, {
      partner_id: Number(U2.userId),
      index: 0,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(
      RESPONSE.PARAMETER_NOT_ENOUGH.code,
    );
    expect(res.body.data, failMsg(res)).toBeNull();
  });
});

// Thất bại -> Giá trị không hợp lệ
describe('Giá trị không hợp lệ', () => {
  it('TC33 — Tự lấy conversation với chính mình (partner_id = currentUser)', async () => {
    const res = await conversationAction.getConversationRaw(U1.token, {
      partner_id: Number(U1.userId),
      index: 0,
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(
      RESPONSE.PARAMETER_VALUE_INVALID.code,
    );
    expect(res.body.data, failMsg(res)).toBeNull();
  });

  it('TC34 — conversation_id không tồn tại', async () => {
    const res = await conversationAction.getConversationRaw(U1.token, {
      conversation_id: '999999',
      index: 0,
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(
      RESPONSE.PARAMETER_VALUE_INVALID.code,
    );
    expect(res.body.data, failMsg(res)).toBeNull();
  });

  it('TC35 — conversation_id dạng number bị từ chối để tránh mất chính xác BIGINT', async () => {
    const res = await conversationAction.getConversationRaw(U1.token, {
      conversation_id: Number(convIdValid),
      index: 0,
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(
      RESPONSE.PARAMETER_TYPE_INVALID.code,
    );
    expect(res.body.data, failMsg(res)).toBeNull();
  });

  it('TC36 — partner_id không tồn tại', async () => {
    const res = await conversationAction.getConversationRaw(U1.token, {
      partner_id: 999999,
      index: 0,
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(RESPONSE.USER_NOT_EXIST.code);
    expect(res.body.data, failMsg(res)).toBeNull();
  });
});

// Thất bại -> Token không hợp lệ
describe('Token không hợp lệ', () => {
  it('TC37 — Token sai định dạng', async () => {
    const res = await conversationAction.getConversationRaw('bad.token', {
      partner_id: Number(U2.userId),
      index: 0,
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(RESPONSE.TOKEN_INVALID.code);
  });

  it('TC38 — Token đã hết hạn', async () => {
    const res = await conversationAction.getConversationRaw(EXPIRED_TOKEN, {
      partner_id: Number(U2.userId),
      index: 0,
      count: 10,
    });

    expect(res.status, failMsg(res)).toBe(200);
    expect(res.body.code, failMsg(res)).toBe(RESPONSE.TOKEN_INVALID.code);
  });
});
