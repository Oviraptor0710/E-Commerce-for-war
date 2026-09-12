import { conversationAction } from '../../helpers/actions/conversation.action';
import { getTestUsers, TestUser } from '../../helpers/test-user.helper';
import { failMsg } from '../../helpers/api-client.helper';
import { RESPONSE } from '../../constants/respones';
import { EXPIRED_TOKEN } from '../../fixtures/user.fixture';

interface SendResponseBody {
  data: { conversation_id: string; message_id: string };
}

interface ReadResponseBody {
  code: string;
  updated: boolean;
  data: { last_read_message_id: string; unread_count: number };
}

interface ErrorResponseBody {
  code: string;
  data: unknown;
}

const getBody = <T>(response: { body: unknown }) => response.body as T;

let U1: TestUser;
let U2: TestUser;
let U3: TestUser;
let U4: TestUser;
let conversationId: string;
let firstMessageId: string;
let secondMessageId: string;
let otherConversationMessageId: string;
let testRunId: string;

beforeAll(async () => {
  [U1, U2, U3, U4] = getTestUsers();
  testRunId = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

  const first = await conversationAction.sendMessage(U2.token, {
    to_id: Number(U1.userId),
    client_message_id: `read-cursor:${testRunId}:first`,
    message: 'Tin thứ nhất để kiểm tra đọc một phần',
    type_message: 'text',
  });
  const second = await conversationAction.sendMessage(U2.token, {
    to_id: Number(U1.userId),
    client_message_id: `read-cursor:${testRunId}:second`,
    message: 'Tin thứ hai vẫn phải chưa đọc',
    type_message: 'text',
  });
  const other = await conversationAction.sendMessage(U4.token, {
    to_id: Number(U3.userId),
    client_message_id: `read-cursor:${testRunId}:other`,
    message: 'Tin thuộc conversation khác',
    type_message: 'text',
  });

  const firstBody = getBody<SendResponseBody>(first);
  const secondBody = getBody<SendResponseBody>(second);
  const otherBody = getBody<SendResponseBody>(other);
  conversationId = String(firstBody.data.conversation_id);
  firstMessageId = String(firstBody.data.message_id);
  secondMessageId = String(secondBody.data.message_id);
  otherConversationMessageId = String(otherBody.data.message_id);
});

describe('Thành công', () => {
  it('TC01 — Chỉ đánh dấu đến message được xác nhận và giữ lại tin mới hơn', async () => {
    const res = await conversationAction.setReadMessage(U1.token, {
      conversation_id: conversationId,
      last_read_message_id: firstMessageId,
    });
    const body = getBody<ReadResponseBody>(res);

    expect(res.status, failMsg(res)).toBe(200);
    expect(body.code, failMsg(res)).toBe(RESPONSE.OK.code);
    expect(body.updated, failMsg(res)).toBe(true);
    expect(body.data.last_read_message_id, failMsg(res)).toBe(firstMessageId);
    expect(body.data.unread_count, failMsg(res)).toBeGreaterThanOrEqual(1);
  });

  it('TC02 — Đọc đến message mới nhất thì cập nhật đúng read cursor', async () => {
    const res = await conversationAction.setReadMessage(U1.token, {
      conversation_id: conversationId,
      last_read_message_id: secondMessageId,
    });
    const body = getBody<ReadResponseBody>(res);

    expect(res.status, failMsg(res)).toBe(200);
    expect(body.code, failMsg(res)).toBe(RESPONSE.OK.code);
    expect(body.updated, failMsg(res)).toBe(true);
    expect(body.data.last_read_message_id, failMsg(res)).toBe(secondMessageId);
  });

  it('TC03 — Request cũ đến muộn không kéo mốc đọc lùi lại', async () => {
    const res = await conversationAction.setReadMessage(U1.token, {
      conversation_id: conversationId,
      last_read_message_id: firstMessageId,
    });
    const body = getBody<ReadResponseBody>(res);

    expect(res.status, failMsg(res)).toBe(200);
    expect(body.code, failMsg(res)).toBe(RESPONSE.OK.code);
    expect(body.updated, failMsg(res)).toBe(false);
    expect(body.data.last_read_message_id, failMsg(res)).toBe(secondMessageId);
  });

  it('TC04 — Tin đến đồng thời với read request vẫn được giữ là chưa đọc', async () => {
    const [incoming] = await Promise.all([
      conversationAction.sendMessage(U2.token, {
        to_id: Number(U1.userId),
        client_message_id: `read-cursor:${testRunId}:concurrent`,
        message: 'Tin đến đồng thời với xác nhận đọc',
        type_message: 'text',
      }),
      conversationAction.setReadMessage(U1.token, {
        conversation_id: conversationId,
        last_read_message_id: secondMessageId,
      }),
    ]);
    const incomingBody = getBody<SendResponseBody>(incoming);

    const stateResponse = await conversationAction.setReadMessage(U1.token, {
      conversation_id: conversationId,
      last_read_message_id: secondMessageId,
    });
    const stateBody = getBody<ReadResponseBody>(stateResponse);
    expect(stateBody.data.last_read_message_id, failMsg(stateResponse)).toBe(
      secondMessageId,
    );
    expect(stateBody.data.unread_count, failMsg(stateResponse)).toBe(1);

    const cleanupResponse = await conversationAction.setReadMessage(U1.token, {
      conversation_id: conversationId,
      last_read_message_id: incomingBody.data.message_id,
    });
    const cleanupBody = getBody<ReadResponseBody>(cleanupResponse);
    expect(cleanupBody.data.unread_count, failMsg(cleanupResponse)).toBe(0);
  });
});

describe('Thiếu tham số và xác thực', () => {
  it('TC05 — Không có token', async () => {
    const res = await conversationAction.setReadMessageRaw(null, {
      conversation_id: conversationId,
      last_read_message_id: firstMessageId,
    });
    const body = getBody<ErrorResponseBody>(res);

    expect(res.status, failMsg(res)).toBe(200);
    expect(body.code, failMsg(res)).toBe(RESPONSE.TOKEN_INVALID.code);
  });

  it('TC06 — Thiếu last_read_message_id', async () => {
    const res = await conversationAction.setReadMessageRaw(U1.token, {
      conversation_id: conversationId,
    });
    const body = getBody<ErrorResponseBody>(res);

    expect(res.status, failMsg(res)).toBe(200);
    expect(body.code, failMsg(res)).toBe(RESPONSE.PARAMETER_NOT_ENOUGH.code);
    expect(body.data, failMsg(res)).toBeNull();
  });

  it('TC07 — Token sai định dạng', async () => {
    const res = await conversationAction.setReadMessageRaw('bad.token', {
      conversation_id: conversationId,
      last_read_message_id: firstMessageId,
    });
    const body = getBody<ErrorResponseBody>(res);

    expect(res.status, failMsg(res)).toBe(200);
    expect(body.code, failMsg(res)).toBe(RESPONSE.TOKEN_INVALID.code);
  });

  it('TC08 — Token đã hết hạn', async () => {
    const res = await conversationAction.setReadMessageRaw(EXPIRED_TOKEN, {
      conversation_id: conversationId,
      last_read_message_id: firstMessageId,
    });
    const body = getBody<ErrorResponseBody>(res);

    expect(res.status, failMsg(res)).toBe(200);
    expect(body.code, failMsg(res)).toBe(RESPONSE.TOKEN_INVALID.code);
  });
});

describe('Giá trị không hợp lệ', () => {
  it('TC09 — Message thuộc conversation khác bị từ chối', async () => {
    const res = await conversationAction.setReadMessageRaw(U1.token, {
      conversation_id: conversationId,
      last_read_message_id: otherConversationMessageId,
    });
    const body = getBody<ErrorResponseBody>(res);

    expect(res.status, failMsg(res)).toBe(200);
    expect(body.code, failMsg(res)).toBe(RESPONSE.PARAMETER_VALUE_INVALID.code);
    expect(body.data, failMsg(res)).toBeNull();
  });

  it('TC10 — User không thuộc conversation không thể cập nhật mốc đọc', async () => {
    const res = await conversationAction.setReadMessageRaw(U3.token, {
      conversation_id: conversationId,
      last_read_message_id: firstMessageId,
    });
    const body = getBody<ErrorResponseBody>(res);

    expect(res.status, failMsg(res)).toBe(200);
    expect(body.code, failMsg(res)).toBe(RESPONSE.PARAMETER_VALUE_INVALID.code);
    expect(body.data, failMsg(res)).toBeNull();
  });

  it('TC11 — last_read_message_id phải là chuỗi số dương', async () => {
    const res = await conversationAction.setReadMessageRaw(U1.token, {
      conversation_id: conversationId,
      last_read_message_id: 'not-a-message-id',
    });
    const body = getBody<ErrorResponseBody>(res);

    expect(res.status, failMsg(res)).toBe(200);
    expect(body.code, failMsg(res)).toBe(RESPONSE.PARAMETER_VALUE_INVALID.code);
    expect(body.data, failMsg(res)).toBeNull();
  });

  it('TC12 — conversation_id dạng number bị từ chối', async () => {
    const res = await conversationAction.setReadMessageRaw(U1.token, {
      conversation_id: Number(conversationId),
      last_read_message_id: firstMessageId,
    });
    const body = getBody<ErrorResponseBody>(res);

    expect(res.status, failMsg(res)).toBe(200);
    expect(body.code, failMsg(res)).toBe(RESPONSE.PARAMETER_TYPE_INVALID.code);
    expect(body.data, failMsg(res)).toBeNull();
  });
});
