# Chiến lược Source-Available

> Trạng thái: repository đã áp dụng PolyForm Noncommercial 1.0.0; lộ trình tách
> core và sport plugin vẫn là đề xuất triển khai sau MVP.

## Cập nhật nền tảng đã triển khai

Ứng dụng hiện tại đã chuẩn hóa một phần mô hình cần thiết trước khi tách package:

- Danh mục sport hệ thống gồm badminton và pickleball.
- Mỗi tournament thuộc một sport và một owner.
- VĐV có thể thuộc nhiều sport; ranking và CLB được lưu riêng theo sport.
- Tournament được chia sẻ theo từng user với role riêng cho từng giải.
- `SUPER_ADMIN` quản lý tài khoản ở cấp nền tảng; `ADMIN` tiếp tục là vai trò
  quản trị trong phạm vi từng giải.
- Rule preset và tournament template được gắn sport, lọc và kiểm tra ở server.
- Sports và preset vẫn là dữ liệu hệ thống; custom preset chưa nằm trong phạm vi.

Các thay đổi này được triển khai trong monolith trước. Việc chuyển code sang
`packages/core`, `packages/plugin-badminton` và `packages/plugin-pickleball`
vẫn thực hiện theo các phase bên dưới.

## 1. Mục tiêu

Xây dựng Tournament Manager thành một nền tảng quản lý giải đấu có lõi độc lập
với từng môn thể thao. Lõi cung cấp các engine và hợp đồng plugin ổn định; luật,
preset và validation đặc thù được đóng gói theo từng môn.

Mục tiêu chính:

- Cho phép cộng đồng sử dụng và mở rộng engine.
- Hỗ trợ badminton trước, sau đó mở rộng sang pickleball và các môn tương tự.
- Giữ business logic độc lập với Next.js, React, database và hạ tầng triển khai.
- Cho phép chủ sở hữu xây sản phẩm thương mại dựa trên hosting, tích hợp và
  dịch vụ; bên thứ ba cần giấy phép thương mại riêng.

## 2. Giấy phép

Repository hiện được phát hành theo **PolyForm Noncommercial 1.0.0**. Khi tách
package, tiếp tục sử dụng giấy phép này thống nhất cho toàn bộ phần
source-available:

- Core engine.
- Plugin môn thể thao chính thức.
- UI cơ bản.
- API contracts và API cơ bản.
- Tài liệu và ví dụ tích hợp.

Giấy phép cho phép sử dụng cá nhân và các mục đích phi thương mại, đồng thời cho
phép sửa đổi và phân phối lại trong phạm vi phi thương mại. Mọi sử dụng thương
mại cần một thỏa thuận giấy phép riêng với chủ sở hữu.

PolyForm Noncommercial là giấy phép **source-available**, không phải giấy phép
open source được OSI phê duyệt.

Tham khảo:

- [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)
- [SPDX identifier: PolyForm-Noncommercial-1.0.0](https://spdx.org/licenses/PolyForm-Noncommercial-1.0.0.html)

Đây là định hướng sản phẩm, không thay thế tư vấn pháp lý trước khi phát hành.

## 3. Cấu trúc monorepo mục tiêu

```text
apps/
  web/                         # Next.js admin và public UI
  docs/                        # Documentation website

packages/
  core/                        # Hoàn toàn độc lập môn thể thao
    tournament-engine/
    rule-engine/
    draw-engine/
    bracket-engine/
    schedule-engine/
    scoring-engine/
    plugin-contract/
    domain/

  plugin-badminton/
    rules/
    presets/
    validators/
    translations/
    index.ts

  plugin-pickleball/
    rules/
    presets/
    validators/
    translations/
    index.ts

  api-contracts/               # DTO, Zod schema và OpenAPI
  ui/                          # Component dùng chung, không chứa business rule
  testing/                     # Fixtures và engine conformance tests
```

MVP đầu tiên chỉ bắt buộc có:

```text
packages/core
packages/plugin-badminton
packages/plugin-pickleball
```

Web app hiện tại có thể tiếp tục nằm ở root trong giai đoạn đầu. Chỉ chuyển sang
`apps/web` sau khi ranh giới giữa core, plugin và application đã ổn định.

## 4. Quy tắc phụ thuộc

```text
UI -> API/Application -> Core
                     -> Sport plugins -> Core
```

Các nguyên tắc bắt buộc:

- `core` không import Next.js, React, Drizzle ORM hoặc repository cụ thể.
- `core` không import plugin badminton hoặc pickleball.
- Plugin chỉ phụ thuộc `core` và hợp đồng plugin công khai.
- UI không tự tính điểm, bốc thăm, xếp hạng hoặc cập nhật bracket.
- Application service chịu trách nhiệm authorization, transaction, audit và
  phối hợp engine.
- Persistence được kết nối qua port/adapter.

## 5. Phạm vi của Core

`@tournament/core` chịu trách nhiệm:

- Vòng đời tournament, event, stage và match.
- Rule Engine và Scoring Engine tổng quát.
- Bốc thăm và phân bổ seed tổng quát.
- Round robin, knockout và third-place match.
- Tạo, cập nhật và kiểm tra bracket.
- Xếp lịch và phát hiện xung đột sân/người chơi.
- State machine của trận đấu.
- Hợp đồng plugin.
- Validation, warning, audit trace và kết quả deterministic.

Core không biết:

- Badminton đánh 21 điểm.
- Pickleball có kitchen/non-volley zone.
- Tên hiển thị và bản dịch của từng môn.
- Tournament preset cụ thể của một môn.

## 6. Phạm vi của Sport Plugin

Mỗi plugin môn thể thao chịu trách nhiệm:

- Cách tính điểm và xác định người thắng.
- Số set/game, điểm thắng, `winBy` và technical cap.
- Timeout, đổi sân, retirement, walkover và no-show.
- Tie-break standings đặc thù.
- Loại nội dung singles, doubles, mixed hoặc team.
- Validation cấu hình event.
- Preset và metadata hiển thị.
- Bản dịch dành riêng cho môn thể thao.

Hợp đồng tối thiểu dự kiến:

```ts
export interface SportPlugin {
  id: string;
  version: string;
  coreApiVersion: string;

  scoringRules: ScoringRuleDefinition[];
  tournamentPresets: TournamentPreset[];

  validateEvent(input: EventDefinition): ValidationResult;
  calculateMatch(input: MatchScoreInput): MatchResult;
  rankStandings(input: StandingsInput): StandingsResult;
}
```

Plugin cần khai báo `coreApiVersion` để hệ thống phát hiện không tương thích
trước khi chạy.

## 7. Thiết kế Preset

Preset phải được chia thành hai tầng.

### 7.1. Scoring Rule Preset

Chỉ mô tả cách đánh một trận:

- Badminton BO3 × 21, win by 2, cap 30.
- Badminton Fast 1 × 21.
- Badminton Fast BO3 × 15.
- Pickleball 1 × 15.
- Pickleball BO3 × 11.

### 7.2. Tournament Template

Mô tả toàn bộ cách tổ chức giải:

```ts
{
  id: "badminton.company-tournament",
  sport: "badminton",
  schemaVersion: 1,
  format: {
    groupSize: 4,
    qualifiersPerGroup: 2,
    knockout: "single-elimination",
    thirdPlaceMatch: true
  },
  scoring: {
    group: "badminton.fast-1x21",
    knockout: "badminton.standard-3x21"
  },
  scheduling: {
    matchDurationMinutes: 25,
    restMinutes: 15
  }
}
```

### 7.3. Preset badminton ban đầu

| Preset | Cấu hình đề xuất |
|---|---|
| BWF Standard | BO3 × 21 cho mọi vòng, win by 2, cap 30 |
| Fast Tournament | Vòng bảng 1 × 21, knockout BO3 × 15 |
| Company Tournament | Bảng 4, top 2, knockout, thời lượng ngắn |
| University Tournament | Nhiều bảng, seed theo trường/khoa, tránh cùng đơn vị |
| Knockout Only | Single elimination, tùy chọn tranh hạng ba |
| Round Robin League | Một hoặc nhiều bảng, xếp hạng đầy đủ |

Mỗi preset cần có:

- `schemaVersion`.
- Phiên bản plugin tạo preset.
- Nguồn luật tham chiếu.
- Ngày hiệu lực.
- Migration hoặc thông báo khi luật thay đổi.

Nếu sử dụng tên `BWF`, cần ghi rõ đây là cấu hình tương thích quy tắc và không
hàm ý được BWF chứng nhận. Giấy phép phần mềm không cấp quyền sử dụng nhãn hiệu.

## 8. Lộ trình migration từ repo hiện tại

Repo hiện đã có engine thuần TypeScript tại `src/core/tournament-engine`, vì vậy
không viết lại từ đầu.

### Phase 1 — Chuẩn hóa ranh giới

- Ghi nhận public API hiện tại của engine.
- Bổ sung characterization tests cho scoring, draw, bracket, standings và
  scheduling.
- Loại bỏ import framework/database còn sót trong core nếu có.
- Định nghĩa `SportPlugin` và compatibility policy.

### Phase 2 — Extract Core

- Chuyển engine hiện tại vào `packages/core`.
- Dùng package exports rõ ràng.
- Giữ adapter/import alias tạm thời để application chưa bị vỡ.
- Công bố API thử nghiệm dưới phiên bản `0.x`.

### Phase 3 — Badminton Plugin

- Di chuyển scoring rules, preset và validation badminton khỏi seed/application.
- Thêm các preset BWF Standard, Fast, Company và University.
- Chạy conformance tests trên toàn bộ plugin.

### Phase 4 — Pickleball Plugin

- Chuẩn hóa logic pickleball hiện có trong demo seed thành plugin thật.
- Tách rule group/playoff và medal match.
- Chạy cùng bộ conformance tests như badminton.

### Phase 5 — Tournament Templates

- Thay preset hard-code trong UI bằng registry do plugin cung cấp.
- Cho phép admin chọn template rồi tùy chỉnh.
- Lưu snapshot cấu hình vào tournament/event để thay đổi plugin sau này không
  làm đổi giải đang chạy.

### Phase 6 — API và UI Separation

- Chuyển DTO, Zod schema và OpenAPI sang `api-contracts`.
- UI chỉ render schema/preset và gọi application API.
- Tách component dùng chung sang `packages/ui` khi có ít nhất hai consumer.

### Phase 7 — Public Release

- Thêm `LICENSE`, `NOTICE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` và
  `SECURITY.md`.
- Công bố compatibility matrix cho core và plugins.
- Thiết lập semantic versioning, changelog và release automation.
- Viết hướng dẫn tạo plugin bên thứ ba.

## 9. Nguyên tắc versioning

- Core và mỗi plugin có version độc lập.
- Public API tuân theo semantic versioning.
- Plugin khai báo khoảng version core tương thích.
- Preset có schema version riêng, không phụ thuộc hoàn toàn package version.
- Tournament đã bắt đầu phải sử dụng rule snapshot bất biến.
- Breaking change cần migration guide và tối thiểu một chu kỳ deprecation.

## 10. Mô hình thương mại

Phần source-available phải đủ dùng cho một giải đấu thực tế. Doanh thu nên đến
từ giấy phép thương mại và các dịch vụ:

- Hosted Tournament Cloud.
- Multi-tenant và custom domain.
- SSO/SAML và phân quyền nâng cao.
- Audit, backup, monitoring và SLA.
- Live streaming và scoreboard hardware.
- Advanced scheduling/optimization.
- White-label.
- Plugin riêng cho liên đoàn hoặc doanh nghiệp.
- Hỗ trợ triển khai và vận hành.

Lợi thế thương mại nằm ở vận hành, tích hợp, độ tin cậy và dịch vụ, không nằm
ở việc khóa những chức năng engine cốt lõi.

## 11. Điều kiện bắt đầu triển khai

Chỉ bắt đầu migration khi:

- MVP hiện tại ổn định và các flow chính có test bảo vệ.
- Public API mong muốn của core đã được thống nhất.
- Chủ sở hữu dự án đã xác nhận giấy phép.
- Có ít nhất một plugin thứ hai để kiểm chứng abstraction không bị
  badminton-specific.
- Có kế hoạch migration import path và database snapshot mà không làm gián đoạn
  sản phẩm hiện tại.
