# Đánh giá database schema — Sàn thương mại điện tử thời chiến

## Thông tin bản đánh giá

- Ngày kiểm tra: 2026-09-06
- Schema được kiểm tra: `docs/database_schema.dbml`
- SHA-256 tại thời điểm kiểm tra: `AACDF29645267A6DCC56E6C1AEF9809E3301CDA84DD886AC48F4AC3FD3468F03`
- Phạm vi đối chiếu: DBML và các TypeORM entity/service hiện có trong `src/`
- File DBML gốc: không thay đổi

## Nhận xét tổng quan

Schema đã bao phủ được các nhóm chức năng chính:

1. Tài khoản, theo dõi, chặn, thông báo và chat.
2. Ví điểm, giao dịch điểm và đơn hàng.
3. Sản phẩm, biến thể, danh mục, giỏ hàng và đánh giá.
4. Video/hình ảnh chiến tích, luật thưởng, kết quả AI và khiếu nại.

Điểm cần ưu tiên là phân biệt rõ **điểm thưởng**, **tiền**, **số dư khả dụng** và **số dư tạm giữ**. Vì toàn bộ giao dịch dùng điểm, nên nên dùng một đơn vị điểm nguyên thống nhất thay vì `decimal` không có precision/scale.

## Các vấn đề nghiêm trọng cần xử lý trước

### 1. DBML và TypeORM entity đang không đồng bộ

- `reward_rules` trong DBML có nhiều cột như `achievement_type`, `achievement_name`, `min_ai_score`, `max_reward_per_day`, `is_active`, nhưng entity hiện tại chỉ có `battle_type` và `reward_coin`.
- `proof_achievements` và `ai_evaluation_logs` có trong DBML nhưng chưa thấy entity được đăng ký trong `data-source.ts`.
- DBML có `reward_proofs.ai_model_version`, `ai_evaluated_at`, `rejection_reason`, `reviewed_by`, `reviewed_at`; entity `RewardProof` hiện chưa có các cột này.
- DBML có `transactions.proof_id`, `transactions.order_id`; entity `Transaction` hiện chưa khai báo hai cột này.
- DBML có `rates` nhưng thiếu toàn bộ foreign key; entity `Rate` cũng chưa khai báo quan hệ đến user, product và order.

Nếu chạy migration theo một phiên bản trong khi application sử dụng phiên bản kia, lỗi sẽ xuất hiện ở runtime hoặc dữ liệu sẽ bị bỏ sót. Cần chọn một nguồn sự thật duy nhất: migration/schema thực tế, sau đó sinh hoặc cập nhật DBML theo nguồn đó.

### 2. Luồng chấm thưởng chưa đủ khả năng audit và chống cộng điểm trùng

Hiện cần lưu riêng các trạng thái sau:

`submitted → processing → ai_completed → pending_review/approved/rejected → credited`

Một bản ghi chiến tích nên có:

- mã yêu cầu/idempotency key;
- hash hoặc checksum của file;
- loại media, thời lượng, kích thước và thời điểm upload;
- phiên bản model, lần chạy model, thời gian xử lý, lỗi xử lý;
- kết quả phát hiện chi tiết theo từng loại mục tiêu;
- người duyệt và lý do thay đổi kết quả;
- thời điểm cộng điểm và mã giao dịch ledger tương ứng.

Không nên chỉ cập nhật trực tiếp `wallets.balance` khi AI trả kết quả. Việc cộng điểm phải đi qua một ledger transaction duy nhất, có unique key theo `proof_id`/quyết định thưởng để retry job không cộng điểm hai lần.

### 3. Kết quả AI cần tách khỏi quyết định thưởng

`ai_score` và `reward_coin` hiện được đặt trực tiếp trong `reward_proofs`. Nên tách ba khái niệm:

- **AI evaluation**: model nhận diện gì, confidence bao nhiêu, model/version nào.
- **Human/moderation decision**: kết quả có được chấp nhận, sửa hay từ chối không.
- **Reward transaction**: cuối cùng hệ thống cộng bao nhiêu điểm vào ví.

Tách như vậy giúp chạy lại model mới mà không làm mất kết quả cũ, đồng thời giữ được lịch sử khiếu nại và quyết định của người duyệt.

### 4. Thiếu ràng buộc chống dữ liệu trùng và dữ liệu mồ côi

Nên bổ sung unique/index/foreign key cho các nhóm sau:

- `user_follows(follower_id, followee_id)` và `user_blocks(blocker_id, blocked_id)`;
- `likes(product_id, user_id)`;
- `wallets.user_id`, `push_settings.user_id`;
- `cart_items(user_id, product_id, variant_id)`;
- `conversations_users_users(conversationsId, usersId)`;
- `proof_achievements(proof_id, rule_id)` nếu mỗi luật chỉ xuất hiện một lần trong một proof;
- `dev_tokens.devtoken`;
- foreign key cho `saved_searches.user_id`, `rates.*`, `brands.category_id`, `categories.parent_id`, `shipping.shipper_id` và `notifications.product_id` nếu các quan hệ này là bắt buộc.

Các foreign key cũng nên xác định rõ `ON DELETE`/`ON UPDATE`. Ví dụ, xóa user không nên làm mất ledger, đơn hàng hoặc bằng chứng chiến tích; các bản ghi này cần giữ lại để audit.

## Nhận xét theo phân hệ

### Người dùng và bảo mật

- `username`, `email`, `phonenumber`, `uuid` chưa thể hiện unique index và chuẩn hóa dữ liệu.
- `role` và `status` dạng `varchar` dễ tạo giá trị không hợp lệ; nên dùng bảng quyền/enum hoặc bảng trạng thái có kiểm soát.
- `user_codes` nên có `purpose`, `consumed_at`, số lần thử và giới hạn tần suất; không nên lưu OTP lâu hơn cần thiết.
- Thông tin định danh, vị trí và video chiến tích là dữ liệu nhạy cảm. Nên có phân quyền truy cập, audit log, mã hóa khi lưu/truyền và chính sách thời hạn lưu trữ.

### Ví điểm và sổ cái

- Nên đổi `balance`, `pending_balance`, `amount` thành `BIGINT` nếu một điểm là đơn vị nhỏ nhất.
- Bổ sung `balance_before`, `balance_after`, `reference_type`, `reference_id`, `idempotency_key` và `created_by`/`actor` cho ledger.
- Cần quy định rõ `amount` dương/âm hay tách `credit`/`debit`; không nên để mỗi service tự diễn giải.
- Với hoàn tiền, hủy đơn, giữ điểm cho seller và giải phóng điểm, nên có trạng thái ledger riêng thay vì sửa số dư trực tiếp.

### Sản phẩm và tồn kho

- `image_urls` và `videos` dạng text/JSON phù hợp prototype nhưng khó tìm kiếm, versioning và moderation; về lâu dài nên có `product_media`.
- `price`/`price_discount` cần precision/scale, currency hoặc quy ước rõ là điểm.
- `product_variants` nên có SKU, giá riêng nếu cần, và cơ chế reservation/lock tồn kho để tránh bán vượt stock.
- `categories.parent_id` nên có self-reference; `has_child` là dữ liệu suy ra nên không nhất thiết lưu.
- `brands.category_id` chỉ phù hợp nếu một brand thuộc đúng một category. Nếu brand có nhiều ngành hàng, nên dùng bảng nối.
- `products.ship_from_id` đang trỏ tới `addresses`; nên cân nhắc trỏ tới `warehouses` hoặc một địa điểm logistics độc lập với sổ địa chỉ cá nhân.

### Đơn hàng và giao nhận

- `orders` đang có đồng thời `status_id`, `status`, bảng `Status` và `order_timelines`; đây là bốn cách biểu diễn trạng thái. Nên giữ một trạng thái hiện tại và một bảng lịch sử chuyển trạng thái.
- `leatime` có vẻ là lỗi chính tả của `lead_time` hoặc `delivery_time`.
- `order_items` cần lưu snapshot của tên sản phẩm, biến thể và đơn giá tại thời điểm mua; không nên phụ thuộc hoàn toàn vào sản phẩm hiện tại.
- Địa chỉ của đơn hàng nên là snapshot bất biến. Nếu chỉ trỏ tới `addresses`, người dùng sửa địa chỉ sau này có thể làm sai lịch sử đơn.
- Cần quyết định giỏ hàng có cho phép nhiều seller hay không. Nếu có, nên có `checkout/order_group` và các seller order/shipment con; schema hiện tại đang nghiêng về một seller cho mỗi order.
- `shipping.shipper_id` cần foreign key tới user hoặc bảng carrier/shipper riêng; nên bổ sung carrier, picked-up/shipped/delivered timestamps và tracking events.

### Chat, thông báo và nội dung

- `created_at` đang dùng `int` ở một số bảng và `datetime` ở bảng khác; nên thống nhất.
- `conversations.time_last_seen` không phù hợp nếu phòng chat có nhiều thành viên; thời điểm đã xem nên nằm ở bảng thành viên hoặc `message_reads`.
- `last_messasge_id` bị sai chính tả và chưa có foreign key.
- `messages.receiver_id` bị dư thừa trong group chat; nếu vẫn giữ, cần quy định rõ dùng cho direct message hay không.
- `reports` và `reward_appeals` nên có `created_at`, `resolved_at`, `resolved_by`, `resolution_note` để phục vụ moderation.

## Đề xuất cấu trúc phân hệ chiến tích

Có thể giữ các bảng hiện tại nhưng chuẩn hóa thành luồng sau:

```text
reward_rules
    ↓
reward_proofs ──< ai_evaluations ──< proof_detections
    ↓                    ↓
reward_decisions ──< reward_appeals
    ↓
wallet_ledger_entries
```

Trong đó:

- `reward_proofs` là file và metadata do người dùng gửi.
- `ai_evaluations` là mỗi lần chạy một model/version.
- `proof_detections` là từng loại mục tiêu và số lượng/confidence.
- `reward_decisions` là kết quả được chấp thuận cuối cùng, có thể do AI hoặc người duyệt.
- `wallet_ledger_entries` là nguồn sự thật cho việc cộng/trừ điểm.

`proof_achievements` hiện có thể đóng vai trò `proof_detections`, còn `ai_evaluation_logs` có thể mở rộng thành `ai_evaluations`; nên thống nhất tên trước khi viết migration.

## Thứ tự ưu tiên triển khai

1. Chốt mô hình nghiệp vụ: đơn vị điểm, seller trong order, luồng duyệt chiến tích và chính sách hoàn/hủy.
2. Đồng bộ DBML với TypeORM entities/migrations; loại bỏ cột và bảng chỉ tồn tại ở một phía.
3. Chuẩn hóa ledger điểm và cơ chế idempotency.
4. Tách AI evaluation, detection, decision và payout.
5. Thêm foreign key, unique constraint, check constraint và index.
6. Bổ sung snapshot đơn hàng, inventory reservation và audit/security.

## Các điểm cần bạn xác nhận

1. Điểm có phải số nguyên tuyệt đối không? Người dùng có được nạp điểm bằng tiền thật hay chỉ nhận điểm từ chiến tích và dùng điểm để mua hàng?
2. Một giỏ hàng/checkout có thể chứa sản phẩm của nhiều seller không?
3. Một chiến tích được phép gửi cả video và ảnh, hay chỉ một trong hai? AI sẽ nhận diện tự động số lượng từng loại mục tiêu hay người dùng vẫn nhập mô tả để AI kiểm tra?
4. Mọi kết quả AI có cần người duyệt trước khi cộng điểm không? Có giới hạn điểm/ngày theo user, theo loại chiến tích hay theo đơn vị quân đội không?
5. Nếu model chạy lại hoặc job bị retry, quy tắc nào bảo đảm không cộng điểm trùng?
6. `ship_from_id` có nghĩa là địa chỉ cá nhân của seller hay kho hàng? Một seller có thể có nhiều kho không?
7. Video chiến tích sẽ được ai xem, lưu trong bao lâu và có yêu cầu che mờ khuôn mặt/vị trí/thông tin quân sự trước khi lưu hoặc hiển thị không?

