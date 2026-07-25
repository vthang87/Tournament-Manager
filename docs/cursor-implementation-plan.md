# Tournament Manager — Kế hoạch triển khai chi tiết trên Cursor

> Nguồn yêu cầu: [`docs/architecture.md`](./architecture.md)  
> Mục đích: chuyển tài liệu kiến trúc thành kế hoạch thực thi tuần tự, đủ chi tiết để Cursor có thể triển khai từng task độc lập, kiểm thử được và hạn chế làm lệch phạm vi V1.

---

## 1. Cách sử dụng tài liệu này trong Cursor

Không yêu cầu Cursor triển khai toàn bộ hệ thống trong một phiên. Mỗi phiên chỉ thực hiện **một task** trong phần 10, theo đúng thứ tự phụ thuộc.

Quy trình cho mỗi task:

1. Tạo branch mới từ branch mặc định.
2. Đọc:
   - `docs/architecture.md`;
   - file kế hoạch này;
   - code và test liên quan đã có.
3. Xác nhận phạm vi task, các dependency đã hoàn thành và các giả định.
4. Viết hoặc cập nhật test trước/đồng thời với business logic.
5. Chỉ triển khai đúng phạm vi task; không làm trước các task phụ thuộc phía sau.
6. Chạy đầy đủ quality gates được nêu trong task.
7. Báo cáo:
   - file đã thay đổi;
   - quyết định kỹ thuật đáng chú ý;
   - test đã chạy và kết quả;
   - phần còn lại hoặc rủi ro;
   - điều kiện để bắt đầu task tiếp theo.
8. Chỉ commit/push/mở PR khi người dùng yêu cầu rõ ràng.

### Quy tắc làm việc bắt buộc cho Cursor

- Không đặt business logic trong React component, Server Action hoặc route handler.
- Không hard-code luật cầu lông, thứ tự stage hoặc kích thước bracket.
- Match luôn tham chiếu `Entry`, không tham chiếu `Player` trực tiếp.
- Match đã tạo phải có `ruleSnapshot` bất biến.
- Hàm trong Tournament Engine ưu tiên pure, deterministic và testable.
- Mọi thao tác ghi nhiều bảng phải chạy trong transaction.
- Mọi mutation phải validate input bằng Zod ở boundary.
- Không tin dữ liệu từ client; authorization và state transition phải được kiểm tra phía server.
- Không dùng SQLite/Drizzle trực tiếp bên trong Tournament Engine.
- Không chỉnh migration cũ đã được áp dụng; tạo migration mới.
- Không tự mở rộng sang các non-goal của V1.

---

## 2. Phạm vi V1

V1 phải chạy trọn luồng sau mà không sửa database thủ công:

1. Tạo tournament và event Đôi Nam.
2. Import 32 đội, gán 8 seed.
3. Cấu hình 8 bảng × 4 đội.
4. Cấu hình luật:
   - vòng bảng: best-of-1, 21 điểm;
   - vòng 16 đến bán kết: best-of-3, 15 điểm;
   - chung kết: best-of-3, 21 điểm.
5. Bốc thăm, điều chỉnh thủ công, xác nhận và khóa kết quả.
6. Sinh round-robin cho vòng bảng.
7. Xếp lịch trên nhiều sân.
8. Nhập và xác nhận tỷ số.
9. Tính bảng xếp hạng, chọn top 2 mỗi bảng.
10. Sinh bracket vòng 16 đội và tự động đẩy người thắng.
11. Hoàn thành chung kết và tournament.
12. Xuất dữ liệu vận hành cơ bản và cung cấp public read-only view.

### Ngoài phạm vi V1

- Payment, cổng đăng ký công khai, membership.
- Multi-tenant SaaS.
- Native mobile app.
- WebSocket scoring thời gian thực.
- BWF/federation integration.
- Double elimination.
- Phân công trọng tài tự động.
- Ranking nâng cao xuyên nhiều tournament.

---

## 3. Quyết định kỹ thuật nền tảng

| Hạng mục | Quyết định V1 |
|---|---|
| Runtime | Node.js LTS, pin phiên bản trong `.nvmrc` hoặc `package.json#engines` |
| Package manager | `pnpm`, lockfile phải được commit |
| Web framework | Next.js, TypeScript, App Router |
| UI | Tailwind CSS + shadcn/ui |
| Database | SQLite tại `/data/tournament-manager.db` |
| ORM | Drizzle ORM + migration bằng drizzle-kit |
| Validation | Zod |
| Forms | React Hook Form |
| Drag & drop | dnd-kit |
| Date/time | date-fns; lưu timestamp theo UTC, hiển thị theo timezone tournament |
| Excel | ExcelJS |
| Unit/integration test | Vitest |
| UI/E2E | Playwright, chỉ bắt buộc cho critical flow sau khi UI ổn định |
| Lint/format | ESLint và formatter đã được project cấu hình |
| Deployment | Docker-first, volume `/data` |

Không pin số phiên bản thư viện trong tài liệu này. Khi bootstrap, dùng phiên bản stable tương thích tại thời điểm triển khai, khóa bằng `pnpm-lock.yaml`, sau đó không nâng version ngoài phạm vi task.

### Quy ước ID, thời gian và JSON

- Dùng UUID/CUID dạng text nhất quán cho primary key.
- `createdAt`, `updatedAt`, các thời điểm trận đấu lưu UTC.
- Tournament có `timezone` dạng IANA, ví dụ `Asia/Ho_Chi_Minh`.
- JSON snapshot phải được validate bằng Zod cả khi ghi và đọc.
- Enum ở application layer là union/schema tập trung; database có constraint phù hợp khi khả thi.

---

## 4. Kiến trúc triển khai

```text
UI (App Router / React Components)
        │
        ▼
Application Services / Use Cases
        │
        ├── authorization
        ├── transaction boundary
        ├── state transition
        └── audit logging
        │
        ▼
Tournament Engine (pure TypeScript)
        │
        ├── match-rules
        ├── scoring
        ├── draw
        ├── round-robin
        ├── standings
        ├── qualification
        ├── bracket
        └── scheduling
        │
        ▼
Repository Interfaces
        │
        ▼
Drizzle Repositories → SQLite
```

### Luật phụ thuộc

- `core/tournament-engine` không import `next`, `react`, `drizzle-orm` hoặc repository cụ thể.
- UI chỉ gọi application service/use case; không query database trực tiếp.
- Repository implementation phụ thuộc schema Drizzle; repository interface không phụ thuộc Drizzle.
- Application service chịu trách nhiệm transaction, authorization, audit và phối hợp nhiều engine.
- Engine trả về typed result/warning/error; không tự ghi database.

---

## 5. Cấu trúc thư mục mục tiêu

```text
src/
├── app/
│   ├── (auth)/
│   ├── (admin)/
│   │   └── tournaments/[tournamentId]/
│   ├── t/[slug]/
│   └── api/
├── components/
│   ├── ui/
│   └── shared/
├── features/
│   ├── tournaments/
│   ├── events/
│   ├── players/
│   ├── entries/
│   ├── rules/
│   ├── draw/
│   ├── matches/
│   ├── standings/
│   ├── qualification/
│   ├── bracket/
│   ├── scheduling/
│   ├── import-export/
│   └── public-board/
├── core/
│   ├── domain/
│   └── tournament-engine/
│       ├── match-rules/
│       ├── scoring/
│       ├── draw/
│       ├── round-robin/
│       ├── standings/
│       ├── qualification/
│       ├── bracket/
│       └── scheduling/
├── application/
│   ├── services/
│   ├── ports/
│   └── errors/
├── db/
│   ├── schema/
│   ├── repositories/
│   ├── migrations/
│   ├── client.ts
│   └── seed.ts
├── lib/
│   ├── auth/
│   ├── validation/
│   ├── date-time/
│   └── audit/
└── test/
    ├── factories/
    ├── fixtures/
    └── helpers/

e2e/
docs/
data/                 # local only, database không commit
```

Mỗi engine module nên có tối thiểu:

```text
module/
├── types.ts
├── schemas.ts
├── errors.ts
├── index.ts
├── <use-case>.ts
└── <use-case>.test.ts
```

---

## 6. Database schema mục tiêu

Tên cột thực tế dùng `snake_case`; TypeScript dùng `camelCase` thông qua mapping của Drizzle.

### 6.1. Identity và audit

#### `users`

- `id`, `username`, `password_hash`, `display_name`.
- `role`: `ADMIN | OPERATOR | SCOREKEEPER | VIEWER`.
- `active`, `created_at`, `updated_at`.
- Unique: `username`.

#### `audit_logs`

- `id`, `user_id` nullable cho system action.
- `action`, `entity_type`, `entity_id`.
- `before_json`, `after_json`, `metadata_json`.
- `created_at`.
- Index: `(entity_type, entity_id)`, `created_at`, `user_id`.

### 6.2. Tournament setup

#### `tournaments`

- `id`, `name`, `slug`, `description`, `location`, `timezone`.
- `start_date`, `end_date`.
- `status`: `DRAFT | REGISTRATION | DRAW | IN_PROGRESS | COMPLETED | ARCHIVED`.
- `created_at`, `updated_at`.
- Unique: `slug`.
- Check: `end_date >= start_date` khi cả hai có giá trị.

#### `tournament_events`

- `id`, `tournament_id`, `name`.
- `type`: `SINGLES | DOUBLES | TEAM`.
- `gender_category`: `MALE | FEMALE | MIXED | OPEN`.
- `status`: `SETUP | DRAW_READY | DRAW_CONFIRMED | IN_PROGRESS | COMPLETED`.
- `default_match_rule_id` nullable.
- `third_place_match_enabled`, `created_at`, `updated_at`.
- Không lưu `participant_count` như source of truth; tính bằng query hoặc projection.

#### `clubs`

- `id`, `name`, `short_name`, `logo_url`, `created_at`, `updated_at`.
- Unique phù hợp trên normalized name nếu nghiệp vụ yêu cầu.

#### `players`

- `id`, `name`, `display_name`, `gender`, `date_of_birth`.
- `phone`, `email`, `club_id`, `ranking`, `metadata_json`.
- `created_at`, `updated_at`.

#### `entries`

- `id`, `event_id`, `display_name`, `seed`, `ranking`, `club_id`.
- `status`: `ACTIVE | WITHDRAWN | DISQUALIFIED`.
- `created_at`, `updated_at`.
- Unique partial/logic: một `seed` không được lặp trong cùng event khi khác null.

#### `entry_members`

- `entry_id`, `player_id`, `position`.
- Composite primary key: `(entry_id, player_id)`.
- Unique: `(entry_id, position)`.
- Application validation:
  - singles có đúng 1 member;
  - doubles có đúng 2 member;
  - cùng player không xuất hiện trong nhiều entry active của cùng event.

### 6.3. Stage và rule

#### `stages`

- `id`, `event_id`, `type`, `name`, `order_index`.
- `format`: `GROUP | KNOCKOUT`.
- `status`: `PENDING | ACTIVE | COMPLETED`.
- `created_at`, `updated_at`.
- Unique: `(event_id, order_index)`.
- `type` là mã có thể mở rộng; không dùng nó để suy diễn cố định stage kế tiếp.

#### `match_rules`

- `id`, `event_id`, `name`.
- `best_of_sets`, `points_to_win`, `win_by`, `max_points`.
- `deuce_enabled`.
- `deciding_set_points`, `deciding_set_win_by`, `deciding_set_max_points` nullable.
- `change_ends_enabled`, `change_ends_at` nullable.
- `created_at`, `updated_at`.

#### `stage_rules`

- `stage_id`, `match_rule_id`.
- Primary key: `stage_id`.

#### `standing_rules`

- `id`, `event_id`, `name`, `criteria_json`, `created_at`, `updated_at`.
- `criteria_json` là ordered list được Zod validate.

#### `qualification_rules`

- `id`, `source_stage_id`, `target_stage_id`.
- `top_per_group`, `best_additional_entries`.
- `ranking_criteria_json`, `created_at`, `updated_at`.

### 6.4. Draw và group

#### `draw_sessions`

- `id`, `event_id`, `stage_id`, `random_seed`.
- `configuration_snapshot_json`.
- `status`: `DRAFT | CONFIRMED | LOCKED`.
- `created_by`, `created_at`, `confirmed_at` nullable.

#### `groups`

- `id`, `stage_id`, `name`, `code`, `order_index`.
- Unique: `(stage_id, code)` và `(stage_id, order_index)`.

#### `draw_results`

- `draw_session_id`, `group_id`, `entry_id`, `position`.
- Unique: `(draw_session_id, entry_id)` và `(draw_session_id, group_id, position)`.

`draw_results` lưu lịch sử phiên bốc thăm. Khi confirm, application service đồng bộ snapshot được chọn sang `group_entries`.

#### `group_entries`

- `group_id`, `entry_id`, `position`, `seed_position` nullable.
- Unique: `entry_id` trong phạm vi stage phải được enforce bằng service/transaction.

### 6.5. Match và score

#### `matches`

- `id`, `event_id`, `stage_id`, `group_id` nullable.
- `round_number`, `bracket_position` nullable.
- `entry_a_id`, `entry_b_id` nullable để hỗ trợ slot chưa xác định/BYE.
- `winner_entry_id` nullable.
- `status`: `PENDING | SCHEDULED | IN_PROGRESS | COMPLETED | WALKOVER | CANCELLED`.
- `resolution`: `NORMAL | WALKOVER | RETIREMENT | DISQUALIFICATION | NO_SHOW` nullable.
- `rule_snapshot_json` bắt buộc khi match có thể thi đấu.
- `court_id`, `scheduled_at`, `estimated_duration_minutes` nullable.
- `started_at`, `completed_at`, `created_at`, `updated_at`.
- `next_match_id`, `next_match_slot` (`A | B`) nullable.
- `loser_next_match_id`, `loser_next_match_slot` nullable cho trận tranh hạng ba.

#### `match_sets`

- `id`, `match_id`, `set_number`, `score_a`, `score_b`, `winner_entry_id`.
- Unique: `(match_id, set_number)`.

Không coi score phía client là hợp lệ cho tới khi Score Engine validate toàn bộ match.

### 6.6. Scheduling

#### `courts`

- `id`, `tournament_id`, `name`, `code`, `active`.
- Unique: `(tournament_id, code)`.

#### `schedule_rules`

- `id`, `event_id`, `stage_id` nullable.
- `default_match_duration_minutes`, `minimum_rest_minutes`, `court_change_buffer_minutes`.
- Rule gắn stage có ưu tiên cao hơn rule mặc định event.

### 6.7. Integrity và delete policy

- Bật SQLite foreign keys.
- Dùng `restrict` cho dữ liệu đã tham gia draw/match; không cascade xóa lịch sử thi đấu.
- Chỉ cascade cho child thuần sở hữu khi parent còn ở trạng thái draft và use case cho phép.
- Entry sau khi draw confirmed hoặc có match chỉ được withdraw/disqualify, không hard delete.
- Score edit sau khi match hoàn tất phải có quyền phù hợp, lý do và audit log.
- Rule snapshot của match không được cập nhật khi sửa rule gốc.

---

## 7. Hợp đồng Tournament Engine

Engine nhận plain TypeScript data và trả typed result. Mẫu chung:

```ts
type EngineWarning = {
  code: string;
  message: string;
  entityIds?: string[];
};

type EngineResult<T> = {
  data: T;
  warnings: EngineWarning[];
};
```

### 7.1. Match rule và scoring

```ts
resolveMatchRule(input): MatchRuleSnapshot
validateSetScore(input): ValidationResult
calculateSetWinner(input): EntryId | null
calculateMatchWinner(input): MatchOutcome
```

Yêu cầu:

- Match override/snapshot → stage rule → event default rule.
- `setsToWin = ceil(bestOfSets / 2)`.
- Set quyết định có thể dùng bộ điểm riêng.
- Không cho thêm set sau khi đã có match winner.
- Validate deuce, `winBy`, `maxPoints`, điểm âm và tỷ số hòa.

### 7.2. Draw

```ts
generateDraw({ entries, groups, configuration, randomSeed }): DrawResult
validateManualDraw({ allocation, configuration }): DrawValidation
```

Yêu cầu:

- Cùng input + random seed phải cho cùng output.
- Hard constraint không bao giờ bị phá.
- Soft constraint trả warning khi không thể thỏa.
- Phân seed theo cấu hình, hỗ trợ serpentine.
- Engine không tự tạo/lưu `DrawSession`.

### 7.3. Round robin

```ts
generateRoundRobin({ entryIds }): RoundRobinRound[]
```

Yêu cầu:

- Hỗ trợ 3, 4, 5, 6+ entries.
- Mỗi cặp gặp đúng một lần.
- Không entry nào thi đấu hai trận trong cùng round.
- Số lẻ dùng BYE nội bộ; không tạo match thi đấu với BYE.

### 7.4. Standings

```ts
calculateStandings({ entries, matches, rule }): StandingRow[]
```

Yêu cầu:

- Tính played, wins, losses, sets/points won/lost/difference.
- Tách tie group trước khi áp dụng head-to-head.
- Hai đội hòa: đối đầu trực tiếp nếu criterion yêu cầu.
- Ba đội trở lên: mini-table, sau đó áp dụng criterion tiếp theo.
- Kết quả phải giải thích được: mỗi row có tie-break trace hoặc engine có debug result.
- Policy walkover/retirement phải được truyền bằng configuration, không hard-code ngầm.

### 7.5. Qualification

```ts
resolveQualification({ standingsByGroup, rule }): QualificationResult
```

Yêu cầu:

- Top N mỗi bảng.
- Best additional entries.
- V1 chỉ cho best-third khi các bảng cùng kích thước; trả domain error nếu không.
- Output có source group/rank để Bracket Engine sử dụng.

### 7.6. Bracket

```ts
generateBracket({ qualifiers, bracketSize, placementRule }): Bracket
advanceWinner({ bracket, completedMatch }): BracketUpdate
```

Yêu cầu:

- Bracket size là lũy thừa của 2 và đủ chứa qualifier.
- BYE ưu tiên theo seed/ranking cấu hình.
- Tránh tái đấu cùng bảng ở vòng đầu khi có nghiệm.
- Người thắng vào đúng `nextMatchSlot`.
- Khi bật tranh hạng ba, loser bán kết vào đúng loser slot.
- Advance phải idempotent; không nhân đôi hoặc ghi sai slot khi retry.

### 7.7. Scheduling

```ts
validateSchedule({ matches, assignments, courts, rule }): ScheduleConflict[]
```

Phát hiện tối thiểu:

- cùng sân trùng thời gian;
- cùng entry trùng thời gian;
- cùng player trùng thời gian giữa các entry/event;
- không đủ thời gian nghỉ;
- sân inactive;
- match duration vượt khung khả dụng nếu UI có khai báo khung giờ.

---

## 8. State machine và quyền

### 8.1. Tournament transition

```text
DRAFT → REGISTRATION → DRAW → IN_PROGRESS → COMPLETED → ARCHIVED
```

Không cho đi lùi trong flow thường. Các thao tác reset đặc biệt phải là use case riêng, có quyền admin và audit.

### 8.2. Event transition

```text
SETUP → DRAW_READY → DRAW_CONFIRMED → IN_PROGRESS → COMPLETED
```

Điều kiện tối thiểu:

- `SETUP → DRAW_READY`: có entry hợp lệ, stage pipeline và default/stage rules hợp lệ.
- `DRAW_READY → DRAW_CONFIRMED`: draw đã validate và được confirm.
- `DRAW_CONFIRMED → IN_PROGRESS`: match vòng đầu đã sinh.
- `IN_PROGRESS → COMPLETED`: tất cả match bắt buộc đã có kết quả hợp lệ.

### 8.3. Stage transition

```text
PENDING → ACTIVE → COMPLETED
```

- Chỉ một stage chính được active tại một thời điểm trong event, trừ khi nghiệp vụ sau này cho phép rõ ràng.
- Knockout chỉ được generate khi source stage completed và qualification đã resolve.

### 8.4. Permission matrix

| Action | Admin | Operator | Scorekeeper | Viewer/Public |
|---|---:|---:|---:|---:|
| Setup tournament/event/rule | ✓ | — | — | — |
| Import và quản lý entry | ✓ | ✓ | — | — |
| Generate/confirm draw | ✓ | ✓ | — | — |
| Schedule match | ✓ | ✓ | — | — |
| Start/enter score | ✓ | ✓ | ✓ | — |
| Sửa kết quả đã hoàn tất | ✓ | theo policy | — | — |
| Xem dữ liệu | ✓ | ✓ | ✓ | ✓ read-only |
| Archive/reset/regenerate | ✓ | — | — | — |

---

## 9. Quality gates chung

Mỗi task chỉ được coi là hoàn thành khi các gate liên quan đều pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Khi đã có E2E:

```bash
pnpm test:e2e
```

Ngoài ra:

- Migration chạy thành công trên database rỗng.
- Seed chạy lặp lại an toàn hoặc có hướng dẫn reset rõ ràng cho local/dev.
- Không có TypeScript `any` không giải thích trong domain/engine.
- Không log password hash, session, token hoặc PII không cần thiết.
- UI có loading, empty, error và disabled state phù hợp.
- Mutation quan trọng có audit log.
- Test engine không phụ thuộc thứ tự thực thi hoặc database thật.

---

## 10. Kế hoạch task chi tiết

### TASK 001 — Foundation và project skeleton

**Mục tiêu:** tạo ứng dụng chạy được bằng local và Docker, có schema nền tảng, seed data và admin shell.

**Phụ thuộc:** không có.

**Thực hiện:**

1. Bootstrap Next.js TypeScript App Router với `pnpm`.
2. Cấu hình Tailwind, shadcn/ui, alias import và strict TypeScript.
3. Thêm scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:generate`, `db:migrate`, `db:seed`.
4. Cấu hình Vitest và test setup.
5. Tạo Drizzle SQLite client, schema module và migration đầu tiên cho:
   - tournaments;
   - tournament_events;
   - stages;
   - players;
   - clubs;
   - entries;
   - entry_members;
   - match_rules;
   - stage_rules;
   - courts;
   - users;
   - audit_logs.
6. Bật foreign key enforcement và SQLite WAL mode phù hợp.
7. Tạo repository interfaces và Drizzle implementations cơ bản cho tournament/event.
8. Tạo seed idempotent gồm admin local, một tournament mẫu, event, courts và rule preset.
9. Tạo admin layout responsive, sidebar navigation và trang dashboard placeholder có dữ liệu thật tối thiểu.
10. Tạo `Dockerfile`, `compose.yaml`, healthcheck, volume `/data` và `.dockerignore`.
11. Tạo `.env.example`; tuyệt đối không commit `.env` thật hoặc database local.
12. Viết README hướng dẫn chạy local, migration, seed và Docker.

**Không làm:** Draw Engine, scoring engine, bracket UI.

**Test bắt buộc:**

- Migration chạy trên database rỗng.
- Repository tạo/đọc tournament và event.
- Foreign key/restrict quan trọng hoạt động.
- Docker image build được và app đọc database từ `/data`.

**Acceptance:**

- `pnpm dev` chạy được.
- `docker compose up -d` khởi động app và giữ dữ liệu sau restart container.
- Admin nhìn thấy tournament seed trong shell.
- Tất cả quality gates pass.

---

### TASK 002 — Authentication, authorization và audit nền tảng

**Mục tiêu:** bảo vệ admin routes và chuẩn hóa kiểm tra quyền/audit trước khi thêm mutations.

**Phụ thuộc:** TASK 001.

**Thực hiện:**

1. Chọn giải pháp session local đơn giản, cookie `httpOnly`, `secure` ở production, `sameSite` phù hợp.
2. Hash password bằng thuật toán được thư viện uy tín hỗ trợ; không tự viết crypto.
3. Tạo login/logout, session lookup và middleware/guard cho admin routes.
4. Tạo `requireRole`/policy helper dùng phía server.
5. Tạo audit service ghi before/after JSON trong cùng transaction với mutation.
6. Thêm màn hình unauthorized và session expiry handling.
7. Không hiển thị navigation/action mà role không được phép dùng; server vẫn phải chặn độc lập.

**Test bắt buộc:**

- Login đúng/sai, inactive user, logout.
- Route guard và role matrix.
- Audit log được rollback nếu mutation rollback.
- Cookie không lộ password/session secret.

**Acceptance:** admin routes không truy cập được khi chưa login; role bị chặn đúng ở server.

---

### TASK 003 — Match Rule và Scoring Engine

**Mục tiêu:** hoàn thiện engine quan trọng nhất trước khi xây score UI.

**Phụ thuộc:** TASK 001.

**Thực hiện:**

1. Định nghĩa Zod schemas và immutable types cho rule/snapshot/set/match outcome.
2. Implement rule validation:
   - số set lẻ và dương;
   - `pointsToWin > 0`;
   - `winBy > 0`;
   - `maxPoints >= pointsToWin`;
   - deciding-set fields nhất quán.
3. Implement `resolveMatchRule` theo priority.
4. Implement snapshot creation; snapshot không giữ database reference mutable.
5. Implement set validation và set winner.
6. Implement match winner, early finish và deciding set.
7. Tạo domain error code ổn định để UI map thông báo.
8. Tạo preset seed: Badminton Standard 21, Fast Group Stage, Fast Knockout.

**Test bắt buộc:**

- 21–19 valid, 21–20 invalid, 22–20 valid.
- 29–27 valid, 30–29 valid, 31–29 invalid.
- `deuceEnabled=false` cho phép kết thúc đúng policy.
- Best-of-1 và best-of-3.
- Match 21–15, 18–21, 21–17 cho A thắng 2–1.
- Deciding set dùng điểm riêng.
- Không cho set thừa sau khi có winner.
- Rule snapshot không đổi khi rule gốc đổi.
- Invalid rule/input trả domain error dự kiến.

**Acceptance:** engine thuần TypeScript, không import framework/database và coverage đầy đủ các nhánh luật quan trọng.

---

### TASK 004 — Tournament/Event CRUD và Format Builder

**Mục tiêu:** admin tạo được tournament hoàn chỉnh và cấu hình stage pipeline bằng dữ liệu.

**Phụ thuộc:** TASK 002, TASK 003.

**Thực hiện:**

1. Tournament list/create/detail/edit/archive.
2. Event create/edit với type, gender category và default match rule.
3. Court CRUD trong tournament.
4. Stage pipeline builder:
   - thêm/xóa/reorder stage khi event còn setup;
   - format GROUP/KNOCKOUT;
   - gán match rule theo stage;
   - bật/tắt third-place.
5. Validate pipeline: order duy nhất, stage bắt buộc, rule resolvable.
6. Tournament creation wizard: information → events → courts → default rules → review.
7. Event setup wizard theo kiến trúc.
8. Enforce state machine cho mutation.
9. Audit thay đổi rule, stage và trạng thái.

**Test bắt buộc:** CRUD, invalid transition, reorder, rule fallback và authorization.

**Acceptance:** admin cấu hình được GROUP → R16 → QF → SF → FINAL mà không sửa code/database.

---

### TASK 005 — Player, Club, Entry và import preview nền tảng

**Mục tiêu:** quản lý participant abstraction đúng cho singles/doubles/team.

**Phụ thuộc:** TASK 004.

**Thực hiện:**

1. Club và Player CRUD/search.
2. Entry CRUD theo event; editor member theo event type.
3. Seed/ranking assignment và validate seed duy nhất.
4. Enforce member cardinality cho singles/doubles.
5. Prevent cùng player trong nhiều entry active của một event.
6. Withdraw/disqualify flow; không hard delete khi draw/match đã tồn tại.
7. Event participant list với filter, seed indicator và validation summary.
8. Tạo parser/validation model chung cho import; chưa cần export đầy đủ.

**Test bắt buộc:** cardinality, duplicate membership, duplicate seed, withdraw/delete policy, permission.

**Acceptance:** tạo thủ công được 32 đội đôi hợp lệ và gán 8 seed.

---

### TASK 006 — Draw Engine và Draw History

**Mục tiêu:** sinh draw deterministic, ưu tiên constraint và có audit/replay.

**Phụ thuộc:** TASK 005.

**Thực hiện:**

1. Bổ sung migration `draw_sessions`, `groups`, `draw_results`, `group_entries`.
2. Implement seeded PRNG adapter; không dùng `Math.random()` trực tiếp trong algorithm.
3. Implement group capacity và balanced allocation.
4. Implement seed distribution thường và serpentine.
5. Implement hard constraints.
6. Implement soft same-club avoidance bằng strategy có deterministic tie resolution.
7. Trả structured warning khi không thể thỏa soft constraint.
8. Application service: generate → lưu DRAFT snapshot → preview/replay/redraw.
9. Confirm draw trong transaction; copy result sang group entries.
10. Lock draw và enforce state transition/audit.

**Test bắt buộc:**

- 32 entries → 8 groups × 4.
- Entry xuất hiện đúng một lần, không group vượt capacity.
- 8 seeds được phân đúng.
- Seed > group count chạy serpentine.
- Cùng seed cho cùng output.
- Khác seed có thể tạo output khác nhưng vẫn valid.
- Same-club được tránh khi có nghiệm.
- Impossible constraint trả warning thay vì loop/fail mơ hồ.
- Replay từ snapshot tái tạo đúng kết quả.

**Acceptance:** engine và persistence hoàn chỉnh; chưa cần animation phức tạp.

---

### TASK 007 — Draw UI và Manual Adjustment

**Mục tiêu:** operator thao tác được toàn bộ flow bốc thăm.

**Phụ thuộc:** TASK 006.

**Thực hiện:**

1. Màn hình cấu hình số bảng, capacity, seed strategy, same-club và random seed.
2. Preview group dạng cards, hiển thị seed/club/warning.
3. Instant draw; animated draw chỉ là progressive reveal nhẹ nếu đủ thời gian.
4. Drag & drop entry giữa bảng bằng dnd-kit.
5. Validate sau mỗi move: capacity, duplicate, seed/club conflict.
6. Hard violation block save; soft violation cho save với warning rõ ràng.
7. Confirm modal hiển thị hậu quả khóa draw.
8. Hiển thị draw history và replay read-only.
9. Responsive cho tablet/desktop; mobile cho phép thao tác thay thế không phụ thuộc drag-only.

**E2E bắt buộc:** generate → manual move → validate → confirm → refresh vẫn giữ kết quả.

**Acceptance:** operator hoàn tất draw 32 đội/8 bảng không can thiệp database.

---

### TASK 008 — Round Robin và Match Generation

**Mục tiêu:** từ draw confirmed sinh lịch cặp đấu vòng bảng đúng và idempotent.

**Phụ thuộc:** TASK 003, TASK 006.

**Thực hiện:**

1. Bổ sung migration `matches`, `match_sets` và index cần thiết.
2. Implement circle algorithm thuần TypeScript.
3. Sinh rounds cho mọi group và bỏ internal BYE khỏi match thật.
4. Khi tạo match, resolve và copy rule snapshot.
5. Application service tạo match trong transaction.
6. Dùng generation key/check để retry không sinh duplicate.
7. Chặn regenerate nếu đã có score; reset/regenerate phải là admin use case riêng và audit.

**Test bắt buộc:**

- Nhóm 3/4/5/6 entries.
- Mỗi cặp đúng một lần.
- Không entry trùng trong một round.
- Tổng match = `n(n-1)/2`.
- Rule snapshot đúng.
- Retry không duplicate.

**Acceptance:** draw confirmed có thể sinh đầy đủ match vòng bảng.

---

### TASK 009 — Match Operations và Mobile Score Entry

**Mục tiêu:** vận hành trận đấu và nhập tỷ số an toàn trên điện thoại.

**Phụ thuộc:** TASK 002, TASK 003, TASK 008.

**Thực hiện:**

1. Match detail và action: start, enter score, finish, walkover, retirement, cancel.
2. Mobile-first score controls với tap target lớn và nhập trực tiếp khi cần.
3. Validate mỗi set ở client để phản hồi nhanh và validate lại ở server.
4. Server tính winner; client không gửi winner như source of truth.
5. Save tất cả sets + match outcome trong transaction.
6. Chặn set thừa và sửa score trái state.
7. Score correction cho admin/operator theo policy, yêu cầu reason và audit before/after.
8. Xử lý resolution `WALKOVER`, `RETIREMENT`, `DISQUALIFICATION`, `NO_SHOW` theo configuration.

**Test bắt buộc:** state transition, authorization, concurrent/stale update, normal score và special resolution.

**E2E:** scorekeeper login → mở match → start → nhập best-of-3 → finish → reload thấy kết quả.

**Acceptance:** scorekeeper hoàn tất trận trên mobile mà không thể tạo score không hợp lệ.

---

### TASK 010 — Standings Engine và Groups UI

**Mục tiêu:** tính standings giải thích được, gồm tie hai đội và multi-way tie.

**Phụ thuộc:** TASK 009.

**Thực hiện:**

1. Định nghĩa standing criteria schema và default order.
2. Aggregate normal/special match theo explicit policy.
3. Implement tie grouping và head-to-head hai đội.
4. Implement mini-table cho ba đội trở lên.
5. Áp dụng set/point difference và criterion tiếp theo theo cấu hình.
6. Có deterministic final fallback hoặc trạng thái `DRAW_REQUIRED`; không random ngầm.
7. Tính on demand từ match source of truth; chỉ cache/materialize khi có lý do đo được.
8. Groups UI: fixtures, results, standings, tie-break explanation.

**Test bắt buộc:**

- Không có match, partial matches, completed group.
- 2-way tie dùng head-to-head.
- A thắng B, B thắng C, C thắng A dùng mini-table.
- Tie vẫn còn sau set diff chuyển sang point diff.
- Walkover/retirement theo policy.
- Thứ tự input khác nhau vẫn cho kết quả giống nhau.

**Acceptance:** kết quả standings ổn định, có trace đủ để operator giải thích thứ hạng.

---

### TASK 011 — Qualification và Knockout Engine

**Mục tiêu:** chọn qualifier và tạo bracket tổng quát, hỗ trợ BYE/progression/tranh hạng ba.

**Phụ thuộc:** TASK 010.

**Thực hiện:**

1. Hoàn thiện persistence cho qualification rule và bracket linkage.
2. Implement top N per group.
3. Implement best additional entries với V1 same-group-size guard.
4. Implement bracket sizing và placement.
5. Tránh same-group rematch vòng đầu khi có nghiệm; warning nếu bất khả thi.
6. Phân BYE theo seed/ranking configuration.
7. Tạo match/slot/next-match links với rule snapshot đúng stage.
8. Auto-advance BYE idempotently.
9. Khi match complete, advance winner trong transaction.
10. Khi bật third-place, route loser bán kết đúng slot.
11. Chặn bracket regeneration sau khi knockout bắt đầu, trừ admin reset use case có audit.

**Test bắt buộc:** 16 qualifiers, 12 vào bracket 16 có 4 BYE, same-group avoidance, winner progression, retry, final và third-place.

**Acceptance:** hoàn tất group stage có thể tạo R16 và thi đấu tới final tự động.

---

### TASK 012 — Bracket UI

**Mục tiêu:** hiển thị và vận hành bracket responsive dựa hoàn toàn trên dữ liệu engine.

**Phụ thuộc:** TASK 011.

**Thực hiện:**

1. Render arbitrary power-of-two bracket; không hard-code R16/QF/SF/Final.
2. Hiển thị qualifier source, seed, group, BYE, score và match status.
3. Desktop dùng columns/connectors; mobile dùng round tabs hoặc horizontal scroll có kiểm soát.
4. Click match mở detail/score action theo role.
5. Generate confirmation hiển thị warnings và placement preview.
6. Empty/loading/error state và print-friendly tối thiểu.

**E2E:** generate bracket → complete match → winner xuất hiện đúng next slot.

**Acceptance:** bracket phản ánh đúng state persistence sau reload.

---

### TASK 013 — Scheduling Engine và Timeline UI

**Mục tiêu:** xếp trận lên sân/thời gian, phát hiện conflict và hỗ trợ drag & drop.

**Phụ thuộc:** TASK 008; tích hợp knockout từ TASK 011.

**Thực hiện:**

1. Hoàn thiện schedule rule CRUD và stage override.
2. Implement interval overlap cho court/entry/player.
3. Implement minimum rest và court-change buffer.
4. Resolve player membership để phát hiện player thi đấu ở nhiều event.
5. Timeline grid theo court/time; timezone tournament.
6. Drag/drop hoặc keyboard/manual assignment.
7. Revalidate tức thời và server-side khi save.
8. Hard conflict block; soft rest warning theo policy.
9. Bulk assign cơ bản có thể theo thứ tự match; không cần optimizer phức tạp trong V1.
10. Upcoming matches view.

**Test bắt buộc:** court overlap, entry/player overlap, boundary không overlap, minimum rest, inactive court, stage override, timezone conversion.

**E2E:** kéo trận sang court/time → warning/block phù hợp → save → reload giữ lịch.

**Acceptance:** admin bố trí được toàn bộ group/knockout matches trên nhiều sân.

---

### TASK 014 — Dashboard, Live Board và Public View

**Mục tiêu:** cung cấp màn hình vận hành và read-only cho khán giả.

**Phụ thuộc:** TASK 009–013.

**Thực hiện:**

1. Tournament dashboard: entries, matches, completed/pending, current stage, courts, upcoming.
2. Court dashboard: now playing, next matches và trạng thái.
3. Live board tối ưu TV/projector; polling định kỳ là đủ cho V1.
4. Public route `/t/[slug]`: schedule, results, groups, standings, bracket.
5. Public DTO chỉ chứa dữ liệu cần công khai; không lộ phone/email/audit/user.
6. QR code tới public URL.
7. Cache/revalidation phù hợp nhưng dữ liệu score không được stale quá mức vận hành đã chọn.
8. Accessibility cơ bản: semantic headings/table, contrast, keyboard, reduced motion.

**E2E:** public user không auth xem được dữ liệu nhưng không gọi mutation hoặc đọc PII.

**Acceptance:** màn hình điều hành và public read-only phản ánh đúng trạng thái giải.

---

### TASK 015 — Excel Import/Export, hardening và V1 release

**Mục tiêu:** hoàn thiện I/O dữ liệu và kiểm chứng end-to-end definition of done.

**Phụ thuộc:** TASK 005 và toàn bộ flow vận hành.

**Thực hiện:**

1. Import singles template: Player Name, Club, Seed.
2. Import doubles template: Player 1, Player 2, Club, Seed.
3. Flow upload → parse → preview → row validation → error report → confirm transaction.
4. Không ghi partial khi confirm có blocking error.
5. Export `Participants.xlsx`, `GroupDraw.xlsx`, `Schedule.xlsx`, `Results.xlsx`, `Standings.xlsx`.
6. Escape/sanitize Excel formula injection cho text do người dùng nhập.
7. Giới hạn file size/row count hợp lý và thông báo lỗi rõ ràng.
8. Chạy full E2E V1 với 32 đội/8 bảng.
9. Kiểm tra backup/restore SQLite volume và document quy trình.
10. Kiểm tra production Docker build, healthcheck, migration startup strategy và rollback guide.
11. Performance smoke test trên dataset đại diện.
12. Hoàn thiện README/operator guide và known limitations.

**Test bắt buộc:** valid/invalid workbook, duplicate rows/seeds, formula injection, Unicode Vietnamese, transaction rollback và export content.

**Acceptance:** toàn bộ V1 Definition of Done chạy mà không sửa database thủ công.

---

## 11. Dependency map và checkpoint

```text
TASK 001 Foundation
├── TASK 002 Auth/Audit
├── TASK 003 Rules/Scoring Engine
└── TASK 004 Tournament/Event/Format
    └── TASK 005 Players/Entries
        └── TASK 006 Draw Engine
            └── TASK 007 Draw UI
            └── TASK 008 Round Robin/Matches
                ├── TASK 009 Score Operations
                │   └── TASK 010 Standings
                │       └── TASK 011 Qualification/Bracket Engine
                │           └── TASK 012 Bracket UI
                └── TASK 013 Scheduling

TASK 009–013 ──> TASK 014 Dashboard/Public
TASK 005 + full flow ──> TASK 015 Import/Export/Release
```

### Checkpoint A — Setup usable

Sau TASK 005:

- login và role hoạt động;
- tạo tournament/event/stage/rule/court;
- tạo entry singles/doubles hợp lệ.

### Checkpoint B — Group stage usable

Sau TASK 010:

- draw 32 đội/8 bảng;
- sinh round robin;
- nhập score;
- standings và multi-way tie chính xác.

### Checkpoint C — Full competition usable

Sau TASK 013:

- qualification và bracket;
- winner progression;
- schedule trên nhiều sân;
- thi đấu tới final.

### Checkpoint D — V1 releasable

Sau TASK 015:

- public/operations UI;
- Excel I/O;
- Docker, backup/restore và full E2E pass.

---

## 12. Test matrix tối thiểu

| Module | Unit | Integration | E2E |
|---|---:|---:|---:|
| Rule resolution/scoring | Bắt buộc | Snapshot persistence | Score flow |
| Draw | Bắt buộc, seeded | Session/confirm transaction | Manual adjust/confirm |
| Round robin | Bắt buộc | Match generation/idempotency | Group fixtures visible |
| Standings | Bắt buộc, multi-way | Read completed matches | Result updates table |
| Qualification | Bắt buộc | Persist qualifier source | Generate bracket |
| Bracket | Bắt buộc, BYE | Advance transaction | Winner moves forward |
| Scheduling | Bắt buộc | Save conflict validation | Drag/save/reload |
| Auth/audit | Policy unit | Session + transaction | Role-restricted flow |
| Import/export | Parser unit | Transaction/file content | Happy-path import |

### Fixture chuẩn dùng xuyên suốt

Tạo test factory thay vì copy object tùy ý:

- 1 tournament tại `Asia/Ho_Chi_Minh`.
- 1 doubles event.
- 32 entries thuộc 12 clubs, 8 seeds.
- 8 groups × 4 entries.
- Group rule best-of-1 × 21; knockout rule best-of-3 × 15; final best-of-3 × 21.
- 4 courts.

Fixture phải cho phép override field để test edge case mà không tạo coupling vào database.

---

## 13. Quy tắc transaction và idempotency

Các use case sau bắt buộc transaction:

- confirm draw và materialize group entries;
- generate group matches;
- finish/correct match và ghi sets/audit;
- generate bracket và liên kết next slots;
- advance winner/loser;
- confirm Excel import;
- reset/regenerate có ảnh hưởng dữ liệu dẫn xuất.

Các operation dễ retry phải idempotent:

- seed dev data;
- generate match từ draw đã confirm;
- auto-advance BYE;
- advance winner sau match completion;
- migration/deployment startup.

Nếu mutation dựa trên dữ liệu người dùng đang xem, dùng optimistic concurrency (`updatedAt` hoặc version) để phát hiện stale update thay vì silently overwrite.

---

## 14. Error handling và observability

Phân loại error:

| Loại | Ví dụ | Cách xử lý UI |
|---|---|---|
| Validation | score sai, seed trùng | Hiển thị tại field/row |
| Domain state | generate bracket quá sớm | Giải thích precondition bị thiếu |
| Authorization | role không đủ | 403/unauthorized page |
| Conflict | stale update, court conflict | Giữ input và yêu cầu resolve/reload |
| Infrastructure | SQLite unavailable | Generic message + server log có context |

Log server nên có request/use-case context và entity IDs, nhưng không ghi password, session token hay PII không cần thiết. Engine warning phải có stable code để UI, audit và test cùng sử dụng.

---

## 15. Definition of Done cho mỗi task

Một task chỉ được đánh dấu `DONE` khi:

- Phạm vi và acceptance criteria đều hoàn thành.
- Không phá nguyên tắc kiến trúc trong `docs/architecture.md`.
- Migration/schema/documentation liên quan đã cập nhật.
- Unit/integration/E2E phù hợp đã có và pass.
- `lint`, `typecheck`, `test`, `build` pass.
- Empty/loading/error/permission states của UI đã xử lý.
- Mutation quan trọng có transaction/audit.
- Không để TODO mơ hồ; TODO còn lại phải có task ID và lý do.
- Không có secret, database local hoặc artifact rác trong thay đổi.
- Cursor cung cấp handoff note cho task tiếp theo.

---

## 16. Mẫu prompt dùng cho từng task trong Cursor

Sao chép mẫu này và thay `<TASK_ID>`:

```text
Hãy triển khai <TASK_ID> trong docs/cursor-implementation-plan.md.

Trước khi sửa code:
1. Đọc toàn bộ docs/architecture.md và phần quy tắc chung, dependency,
   acceptance criteria của task trong docs/cursor-implementation-plan.md.
2. Đọc AGENTS.md/CLAUDE.md và kiểm tra trạng thái Git.
3. Tạo branch feat/... hoặc fix/... phù hợp nếu đang ở branch mặc định.
4. Kiểm tra dependency của task đã tồn tại trong code; nếu chưa, dừng và báo blocker.

Khi triển khai:
- Chỉ làm đúng phạm vi task; không làm trước task tiếp theo.
- Business logic phải ở core/application, không nằm trong React component.
- Thêm test cho happy path, edge case và failure path được liệt kê.
- Mọi mutation nhiều bảng dùng transaction; input boundary dùng Zod.
- Không commit, push hoặc mở PR nếu tôi chưa yêu cầu.

Trước khi kết thúc:
- Chạy lint, typecheck, test và build.
- Nếu có migration, xác minh trên database SQLite rỗng.
- Tự review diff để tìm regression, dữ liệu nhạy cảm và code ngoài phạm vi.
- Báo cáo file thay đổi, test/kết quả, quyết định kỹ thuật, rủi ro còn lại
  và điều kiện bắt đầu task tiếp theo.
```

### Prompt review sau mỗi checkpoint

```text
Hãy review implementation hiện tại theo checkpoint tương ứng trong
docs/cursor-implementation-plan.md. Không sửa code trước.

Kiểm tra:
- sai lệch so với docs/architecture.md;
- business logic lọt vào UI/database layer;
- state transition hoặc authorization bị thiếu;
- transaction/idempotency/data integrity;
- edge case engine và test coverage;
- migration từ database rỗng;
- regression trong flow đã hoàn thành.

Báo cáo finding theo mức độ nghiêm trọng, dẫn file/dòng cụ thể và đề xuất fix.
Chỉ triển khai fix sau khi tôi xác nhận.
```

---

## 17. Rủi ro cần kiểm soát sớm

1. **Multi-way tie sai nhưng khó nhận biết:** bắt buộc fixture vòng tròn A>B, B>C, C>A và tie-break trace.
2. **Rule mutable làm đổi lịch sử:** snapshot bắt buộc khi tạo match; test sửa rule sau đó.
3. **Draw không deterministic:** inject seeded PRNG; snapshot input/configuration.
4. **Duplicate do retry:** generation/advance phải idempotent và có unique constraint hỗ trợ.
5. **Bracket hard-code:** render và generate từ stage/bracket graph, không dựa vào tên vòng.
6. **SQLite concurrent writes:** transaction ngắn, WAL, busy timeout phù hợp; không giữ transaction qua network/UI wait.
7. **Player conflict xuyên event:** scheduler phải resolve qua `entry_members`, không chỉ so `entryId`.
8. **Score correction làm sai standings/bracket:** correction phải validate downstream impact; khi knockout winner đã advance, cần policy reset rõ ràng và audit.
9. **Public data leak:** dùng public DTO/queries riêng, không serialize entity đầy đủ.
10. **Scope creep UI:** ưu tiên engine correctness và operational flow; animation chỉ sau acceptance cốt lõi.

---

## 18. Tiêu chí chấp nhận cuối V1

Release candidate chỉ đạt khi tất cả điều sau đúng:

- Chạy được bằng Docker với SQLite persistent volume.
- User role hoạt động và mutation được authorize phía server.
- Cấu trúc tournament/stage/rule hoàn toàn bằng dữ liệu.
- Import 32 đội đôi và gán 8 seed thành công.
- Draw 8 bảng deterministic, có warning và manual adjustment.
- Round robin không thiếu/trùng trận.
- Score engine xử lý đúng deuce/max/best-of/deciding set.
- Standings xử lý đúng 2-way và 3-way tie.
- Qualification top 2 tạo đúng 16 qualifiers.
- Bracket R16 → QF → SF → Final tự advance đúng; third-place hoạt động khi bật.
- Scheduler chặn conflict sân/entry/player và cảnh báo rest.
- Score entry sử dụng tốt trên mobile.
- Public view không lộ dữ liệu nhạy cảm.
- Excel import/export đúng dữ liệu và an toàn với formula injection.
- Audit log có cho draw, rule, score correction, reset và bracket regeneration.
- Full critical-path E2E pass trên database mới.
- Backup/restore database và deployment procedure được tài liệu hóa.

Khi các tiêu chí trên hoàn tất, Tournament Manager V1 đáp ứng nguyên tắc cốt lõi:

> Tournament structure is data, not code.  
> Match rules are configuration, not hard-coded logic.  
> Tournament Engine is independent from UI.
