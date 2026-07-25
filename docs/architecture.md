Tournament Manager — Implementation Plan

1. Mục tiêu

Xây dựng một hệ thống nội bộ để quản lý giải đấu thể thao, trước mắt tập trung vào cầu lông nhưng kiến trúc phải đủ tổng quát để có thể mở rộng sang pickleball, tennis, bóng bàn hoặc các môn có mô hình thi đấu tương tự.

Hệ thống cần hỗ trợ toàn bộ vòng đời giải đấu:

Tournament Setup
→ Participants / Teams
→ Seeding
→ Draw
→ Group Stage
→ Match Scheduling
→ Score Entry
→ Standings
→ Qualification
→ Knockout Bracket
→ Finals
→ Tournament Completion

Tên hệ thống:

Tournament Manager

⸻

2. Tech Stack

Application

* Next.js
* TypeScript
* App Router
* shadcn/ui
* Tailwind CSS

Database

* SQLite
* Drizzle ORM

SQLite phù hợp vì hệ thống chạy nội bộ, quy mô nhỏ đến vừa và cần deployment đơn giản.

Database file:

/data/tournament-manager.db

Sau này có thể migrate PostgreSQL mà không thay đổi business layer.

Supporting libraries

* Zod — schema validation
* dnd-kit — drag & drop
* ExcelJS — import/export Excel
* date-fns — date/time handling
* React Hook Form — forms

Deployment

Docker-first.

docker compose up -d

Persistent volume:

/data
  tournament-manager.db

⸻

3. Kiến trúc hệ thống

Tách hệ thống thành các layer.

UI
│
├── Tournament Management
├── Draw UI
├── Scheduling UI
├── Score Entry
├── Standings
└── Bracket
        │
Application Services
        │
Tournament Engine
│
├── Draw Engine
├── Match Rule Engine
├── Qualification Engine
├── Standings Engine
├── Bracket Engine
└── Scheduling Engine
        │
Repository Layer
        │
SQLite / Drizzle

Business logic không được nằm trực tiếp trong React components.

Tournament Engine phải là module độc lập.

Mục tiêu:

UI có thể thay đổi
Database có thể thay đổi
Tournament Engine vẫn giữ nguyên

⸻

4. Core Domain Model

Tournament

Tournament
id
name
description
location
startDate
endDate
status
DRAFT
REGISTRATION
DRAW
IN_PROGRESS
COMPLETED
ARCHIVED
createdAt
updatedAt

Một Tournament có nhiều Event.

Ví dụ:

Giải Cầu Lông Công Ty 2026
├── Đơn Nam
├── Đơn Nữ
├── Đôi Nam
├── Đôi Nữ
└── Đôi Nam Nữ

⸻

5. Event / Competition Category

TournamentEvent
id
tournamentId
name
type:
SINGLES
DOUBLES
TEAM
genderCategory:
MALE
FEMALE
MIXED
OPEN
status
participantCount
groupCount
createdAt
updatedAt

Mỗi Event có:

* Participants
* Draw
* Stages
* Match Rules
* Matches
* Standings
* Bracket

⸻

6. Player

Player
id
name
displayName
gender
dateOfBirth
phone
email
clubId
ranking
metadata
createdAt
updatedAt

Không bắt buộc mọi field.

Chỉ name là required.

⸻

7. Club / Organization

Club
id
name
shortName
logo
createdAt
updatedAt

Dùng cho:

* phân nhóm
* tránh cùng CLB trong vòng bảng
* hiển thị
* seed rules

⸻

8. Entry / Participant

Không dùng Player trực tiếp trong Match.

Cần abstraction:

Entry

để hỗ trợ singles và doubles.

Entry
id
eventId
displayName
seed
ranking
clubId
createdAt
updatedAt

EntryMember:

EntryMember
entryId
playerId
position

Ví dụ singles:

Entry A
└── Nguyễn Văn A

Doubles:

Entry B
├── Nguyễn Văn A
└── Trần Văn B

⸻

9. Tournament Stage

Một Event có nhiều Stage.

Ví dụ:

GROUP
ROUND_OF_32
ROUND_OF_16
QUARTER_FINAL
SEMI_FINAL
FINAL
THIRD_PLACE

Data:

Stage
id
eventId
type
name
order
format
GROUP
KNOCKOUT
status
PENDING
ACTIVE
COMPLETED
createdAt
updatedAt

Không hard-code sequence.

Admin có thể tạo:

GROUP
↓
ROUND_OF_16
↓
QUARTER_FINAL
↓
SEMI_FINAL
↓
FINAL

hoặc:

GROUP
↓
QUARTER_FINAL
↓
SEMI_FINAL
↓
FINAL

⸻

10. Match Rule Engine

Đây là module quan trọng nhất.

Rule phải configurable theo từng Stage.

Ví dụ giải:

GROUP
Best of 1
21 points
Win by 2
Max 30
ROUND_OF_16 → SEMI_FINAL
Best of 3
15 points
Win by 2
Max 21
FINAL
Best of 3
21 points
Win by 2
Max 30

Schema:

MatchRule
id
eventId
name
bestOfSets
pointsToWin
winBy
maxPoints
deuceEnabled
decidingSetPoints
decidingSetWinBy
decidingSetMaxPoints
changeEndsEnabled
changeEndsAt
createdAt
updatedAt

Stage Rule assignment:

StageRule
stageId
matchRuleId

⸻

11. Rule Resolution

Rule resolution priority:

Match override
    ↓
Stage Rule
    ↓
Event Default Rule

Pseudo:

resolveMatchRule(match)
match.ruleSnapshot
OR stage.rule
OR event.defaultRule

⸻

12. Rule Snapshot

Khi Match được tạo:

phải copy rule thành snapshot.

MatchRuleSnapshot

Ví dụ:

{
  "bestOfSets": 3,
  "pointsToWin": 15,
  "winBy": 2,
  "maxPoints": 21
}

Lý do:

Nếu admin thay rule Stage sau khi một số trận đã chơi thì các trận cũ không được thay đổi.

Match đã tạo phải giữ nguyên rule lịch sử.

⸻

13. Group Stage

Group:

Group
id
stageId
name
code
A
B
C
D
order

GroupEntry:

GroupEntry
groupId
entryId
position
seedPosition

⸻

14. Draw Engine

Draw Engine chịu trách nhiệm phân Entry vào Group.

Input:

Entries
Group Count
Group Size
Seeds
Draw Constraints
Random Seed

Output:

Group A
Group B
Group C
...

⸻

15. Draw Rules

Configurable:

DrawConfiguration
groupCount
maxEntriesPerGroup
seedDistribution
avoidSameClub
avoidSameTeam
avoidSameRegion
randomSeed

Các rule ban đầu:

Seed Distribution

Ví dụ 8 seed / 8 bảng.

Seed 1 → Group A
Seed 2 → Group B
...
Seed 8 → Group H

Có thể dùng serpentine distribution nếu seed > group count.

Ví dụ:

A B C D
8 7 6 5
9 10 11 12

⸻

16. Constraint-based Draw

Draw Engine nên chạy theo:

Hard Constraints
↓
Soft Constraints
↓
Randomization

Hard:

Entry chỉ xuất hiện một lần
Không vượt số lượng mỗi bảng
Seed distribution

Soft:

Tránh cùng CLB
Tránh cùng đơn vị
Tránh seed mạnh cùng bảng

Nếu không thể thỏa mọi soft constraint:

hệ thống vẫn tạo draw và trả warning.

Ví dụ:

Warning:
Group C contains 2 entries from Club ABC
because no valid alternative allocation exists.

⸻

17. Random Seed

Mỗi Draw phải lưu:

randomSeed

Ví dụ:

DRAW-2026-ABC123

Cho phép:

Replay Draw
Audit Draw

⸻

18. Draw History

DrawSession
id
eventId
randomSeed
configurationSnapshot
status
DRAFT
CONFIRMED
createdBy
createdAt

DrawResult:

drawSessionId
groupId
entryId
position

Admin có thể:

Generate
↓
Preview
↓
Re-draw
↓
Manual Adjust
↓
Confirm
↓
Lock

⸻

19. Manual Draw Adjustment

Sau khi random:

cho phép drag & drop Entry giữa các Group.

System phải validate:

Group capacity
Duplicate Entry
Seed conflicts
Club conflicts

Conflict không nhất thiết block.

Có thể warning.

⸻

20. Group Match Generation

Với 4 Entry:

A1 vs A2
A3 vs A4
A1 vs A3
A2 vs A4
A1 vs A4
A2 vs A3

Sử dụng Round Robin Circle Algorithm.

Không hard-code 4 người.

Phải support:

3
4
5
6+

Nếu số Entry lẻ:

tự tạo BYE trong schedule generator.

⸻

21. Match Model

Match
id
eventId
stageId
groupId nullable
roundNumber
entryAId
entryBId
winnerEntryId
status
PENDING
SCHEDULED
IN_PROGRESS
COMPLETED
WALKOVER
CANCELLED
ruleSnapshot
courtId
scheduledAt
startedAt
completedAt
createdAt
updatedAt

⸻

22. Match Score

MatchSet
id
matchId
setNumber
scoreA
scoreB
winnerEntryId

Example:

Set 1: 15-11
Set 2: 13-15
Set 3: 15-9

⸻

23. Score Validation

Score Engine phải validate theo rule snapshot.

Ví dụ:

pointsToWin = 21
winBy = 2
maxPoints = 30

Valid:

21-15
22-20
25-23
30-29

Invalid:

21-20
31-29

Nếu:

deuceEnabled = false

thì:

21-20

có thể hợp lệ.

⸻

24. Match Winner Logic

Ví dụ:

bestOfSets = 3

Winner cần:

ceil(3 / 2)
= 2 sets

Sau khi Entry thắng đủ 2 set:

không cho nhập set tiếp theo.

⸻

25. Walkover

Support:

WALKOVER
RETIREMENT
DISQUALIFIED
NO_SHOW

MatchResolution:

NORMAL
WALKOVER
RETIREMENT
DISQUALIFICATION

Standings Engine phải biết cách xử lý.

⸻

26. Group Standings Engine

Statistics:

Played
Wins
Losses
Sets Won
Sets Lost
Set Difference
Points Won
Points Lost
Point Difference
Ranking

⸻

27. Tie-break Configuration

Không hard-code rule xếp hạng.

StandingRule

Default:

1. Match Wins
2. Head-to-head
3. Set Difference
4. Point Difference
5. Points Won
6. Draw

Admin có thể cấu hình thứ tự.

Ví dụ:

MATCH_WINS
HEAD_TO_HEAD
SET_DIFFERENCE
POINT_DIFFERENCE

⸻

28. Multi-way Tie

Phải xử lý trường hợp 3 Entry bằng số trận thắng.

Không chỉ head-to-head 2 đội.

Ví dụ:

A thắng B
B thắng C
C thắng A

Khi đó:

Mini table
→ Set difference
→ Point difference

Standings Engine phải có test riêng cho case này.

⸻

29. Qualification Engine

Rule:

QualificationRule
topPerGroup
bestAdditionalEntries
rankingCriteria

Ví dụ:

8 groups
Top 2 each
→ 16 entries

Hoặc:

6 groups
Top 2
+
4 best third place
→ 16 entries

⸻

30. Best Third-place Ranking

Nếu dùng best third:

hệ thống tạo virtual ranking giữa các Group.

Có configurable normalization nếu Group size khác nhau.

V1 có thể yêu cầu:

Tất cả group có cùng số Entry

để tránh complexity.

⸻

31. Knockout Bracket Engine

Input:

Qualified Entries
Seeding Rule
Avoid Same Group Rule
Bracket Size

Output:

ROUND_OF_16
QUARTER_FINAL
SEMI_FINAL
FINAL

⸻

32. Knockout Placement Rules

Ví dụ:

A1 vs B2
C1 vs D2
B1 vs A2
D1 vs C2

Goals:

Group winner vs group runner-up
Không gặp lại cùng bảng ngay
Seed mạnh nằm khác nhánh

⸻

33. BYE Support

Ví dụ:

12 qualified entries
16-slot bracket

Có:

4 BYE

BYE phải được phân bố theo seed.

Entry nhận BYE tự advance.

⸻

34. Bracket Progression

Khi Match completed:

Winner
↓
Next Match Slot

Ví dụ:

Match QF1 winner
→ SF1 Entry A

Cần model:

nextMatchId
nextMatchSlot
A
B

⸻

35. Third-place Match

Configurable:

thirdPlaceMatchEnabled

Nếu true:

SF1 loser
vs
SF2 loser

⸻

36. Court Management

Court
id
tournamentId
name
code
active

Ví dụ:

Court 1
Court 2
Court 3

⸻

37. Match Scheduling

Một Match có:

court
scheduledAt
estimatedDuration

Scheduler View:

TIME     COURT 1       COURT 2       COURT 3
08:00    A1-A2         B1-B2         C1-C2
08:30    A3-A4         B3-B4         C3-C4

⸻

38. Scheduling Constraints

Scheduler phải detect:

Court conflict
Player conflict
Entry conflict
Insufficient rest

Ví dụ:

Entry A
08:00 Court 1
08:30 Court 2

Nếu minimum rest:

30 minutes

thì warning.

⸻

39. Scheduling Rule

ScheduleRule
defaultMatchDuration
minimumRestMinutes
courtChangeBuffer

Có thể override theo Stage.

Ví dụ:

Group
20 minutes
Final
45 minutes

⸻

40. Drag & Drop Schedule

Admin có thể:

Drag Match
↓
Court khác
↓
Time khác

System revalidate ngay.

Conflict hiển thị warning.

⸻

41. Tournament Dashboard

Dashboard cần hiển thị:

Tournament Status
Entries
Matches
Completed Matches
Pending Matches
Current Stage
Courts Active
Upcoming Matches

⸻

42. Main Navigation

Dashboard
Tournament
├── Overview
├── Events
├── Players
├── Entries
Competition
├── Draw
├── Groups
├── Schedule
├── Scores
├── Standings
└── Bracket
Settings
├── Match Rules
├── Ranking Rules
├── Draw Rules
├── Scheduling Rules
└── Courts

⸻

43. Tournament Creation Wizard

Step 1:

Tournament Information

Step 2:

Events

Step 3:

Courts

Step 4:

Default Rules

Finish:

Tournament Dashboard

⸻

44. Event Setup Wizard

Event Information
↓
Participants
↓
Competition Format
↓
Match Rules
↓
Draw Rules
↓
Qualification Rules
↓
Create

⸻

45. Competition Format Builder

Example UI:

GROUP STAGE
8 Groups
4 Entries / Group
Top 2 qualify
↓
ROUND OF 16
↓
QUARTER FINAL
↓
SEMI FINAL
↓
FINAL

Cho phép cấu hình Stage pipeline.

⸻

46. Match Rule UI

Example:

Vòng bảng
Best of Sets
[1]
Points to Win
[21]
Win By
[2]
Maximum Points
[30]
Round 16 → Semi Final
Best of
[3]
Points
[15]
Win By
[2]
Max
[21]
Final
Best of
[3]
Points
[21]
Win By
[2]
Max
[30]

⸻

47. Draw UI

Flow:

Participants
32 Entries
8 Seeds
8 Groups
↓
Configure Draw
↓
Start Draw
↓
Animated Draw
↓
Result
↓
Manual Adjust
↓
Validate
↓
Confirm & Lock

⸻

48. Draw Animation

Không cần complex ở V1.

Có thể:

Entry card
↓
Random animation
↓
Move into Group

Nên hỗ trợ chế độ:

Instant Draw
Animated Draw

⸻

49. Score Entry UI

Mobile-first vì trọng tài hoặc BTC có thể nhập bằng điện thoại.

Example:

COURT 2
Nguyễn A / Trần B
vs
Lê C / Phạm D
SET 1
[-] 15 [+]
[-] 11 [+]
Set Winner: Team A
SET 2
...

Buttons lớn.

⸻

50. Match Control

Actions:

Start Match
Enter Score
Finish Match
Walkover
Retirement
Cancel

Sau khi complete:

Standings recalculated
Bracket updated
Next match updated

⸻

51. Live Tournament Board

Read-only screen.

NOW PLAYING
Court 1
A vs B
15-12
Court 2
C vs D
8-10

Upcoming:

NEXT MATCHES

Có thể dùng TV/projector.

⸻

52. Public Read-only View

Không cần auth.

Route:

/t/{slug}

Views:

Schedule
Results
Groups
Standings
Bracket

Có QR Code để mở.

⸻

53. Authentication

V1:

simple local authentication.

Roles:

ADMIN
OPERATOR
SCOREKEEPER
VIEWER

Admin:

full access.

Operator:

draw, scheduling, results.

Scorekeeper:

score entry only.

Viewer:

read-only.

⸻

54. Audit Log

Các action quan trọng phải log:

Draw generated
Draw confirmed
Manual draw adjustment
Score edited
Match reset
Rule changed
Bracket regenerated

Schema:

AuditLog
id
userId
action
entityType
entityId
before
after
createdAt

⸻

55. Import Excel

V1 support:

Player Name
Club
Seed

Doubles:

Player 1
Player 2
Club
Seed

Import flow:

Upload
↓
Preview
↓
Validate
↓
Show Errors
↓
Confirm Import

⸻

56. Export

Support:

Participants.xlsx
GroupDraw.xlsx
Schedule.xlsx
Results.xlsx
Standings.xlsx

PDF có thể làm sau.

⸻

57. Data Integrity

Không được cho xóa Entry nếu:

Draw confirmed
OR
Match exists

Thay vào đó:

Withdraw

⸻

58. Withdraw Participant

Status:

ACTIVE
WITHDRAWN
DISQUALIFIED

Nếu withdraw trước draw:

remove bình thường.

Sau draw:

system phải xử lý matches theo tournament policy.

⸻

59. State Machine

Tournament:

DRAFT
↓
REGISTRATION
↓
DRAW
↓
IN_PROGRESS
↓
COMPLETED
↓
ARCHIVED

Event:

SETUP
↓
DRAW_READY
↓
DRAW_CONFIRMED
↓
IN_PROGRESS
↓
COMPLETED

Stage:

PENDING
ACTIVE
COMPLETED

Không cho phép action sai state.

Ví dụ:

Generate knockout

chỉ khi Group Stage completed.

⸻

60. Project Structure

Suggested:

src/
app/
components/
features/
  tournaments/
  players/
  entries/
  draw/
  matches/
  standings/
  bracket/
  scheduling/
core/
  tournament-engine/
    draw/
    match-rules/
    scoring/
    standings/
    qualification/
    bracket/
    scheduling/
db/
  schema/
  repositories/
services/
lib/

⸻

61. Tournament Engine API

Example:

TournamentEngine.draw.generate()
TournamentEngine.roundRobin.generate()
TournamentEngine.score.validate()
TournamentEngine.standings.calculate()
TournamentEngine.qualification.resolve()
TournamentEngine.bracket.generate()
TournamentEngine.bracket.advanceWinner()
TournamentEngine.schedule.validate()

Engine functions nên:

pure
deterministic
testable

khi có cùng input + randomSeed.

⸻

62. Testing Strategy

Bắt buộc unit test Tournament Engine.

Đặc biệt:

Draw constraints
Round robin generation
21-point scoring
15-point scoring
Deuce
Max point
Best-of-1
Best-of-3
2-way ties
3-way ties
Qualification
Bracket BYE
Winner progression
Schedule conflicts

UI tests có thể ưu tiên sau.

⸻

63. Critical Test Cases

Scoring

Rule:

21
win by 2
max 30

Expected:

21-19 valid
21-20 invalid
22-20 valid
29-27 valid
30-29 valid
31-29 invalid

⸻

Best of 3

21-15
18-21
21-17

Winner:

Entry A 2-1

⸻

Group Tie

A beats B
B beats C
C beats A

System:

calculate mini-table
↓
set difference
↓
point difference

⸻

64. MVP Scope

Phase 1 — Foundation

Build:

Project setup
SQLite
Drizzle
Authentication
Tournament CRUD
Event CRUD
Player
Club
Entry
Match Rules
Stage configuration

Acceptance:

Admin có thể tạo Tournament hoàn chỉnh và khai báo thể thức.

⸻

65. Phase 2 — Draw

Build:

Seed management
Group creation
Draw configuration
Random Draw Engine
Same-club constraints
Random seed
Draw preview
Manual adjustment
Draw confirmation

Acceptance:

Có thể:

32 teams
→ 8 groups
→ seed distribution
→ avoid same club
→ confirm draw

⸻

66. Phase 3 — Group Stage

Build:

Round Robin Generator
Match generation
Score Entry
Match Rule Engine
Score validation
Group Standings

Acceptance:

Có thể chạy hoàn chỉnh vòng bảng.

⸻

67. Phase 4 — Qualification & Knockout

Build:

Qualification Engine
Top N per group
Bracket Generator
Round of 16
Quarter Final
Semi Final
Final
Third-place option
Winner progression

Acceptance:

Kết thúc vòng bảng:

standings
→ qualifiers
→ bracket

tự động.

⸻

68. Phase 5 — Scheduling

Build:

Courts
Timeline
Match scheduling
Drag & drop
Conflict detection
Minimum rest rule

Acceptance:

Admin có thể bố trí toàn bộ trận lên nhiều sân.

⸻

69. Phase 6 — Operations UI

Build:

Mobile score entry
Court dashboard
Upcoming matches
Live match display
Tournament dashboard

⸻

70. Phase 7 — Import / Export

Build:

Excel import
Excel export
QR Public View

⸻

71. V1 Definition of Done

Tournament Manager V1 được xem là hoàn thành khi có thể tổ chức giải theo kịch bản:

Create Tournament
↓
Create Event:
Đôi Nam
↓
Import 32 teams
↓
Assign 8 seeds
↓
Create format:
8 groups × 4 teams
↓
Configure:
Group
1 set × 21
Round 16 → Semi
3 sets × 15
Final
3 sets × 21
↓
Draw
↓
Generate Round Robin
↓
Schedule Courts
↓
Enter Results
↓
Calculate Standings
↓
Top 2 qualify
↓
Generate Round of 16
↓
Play knockout
↓
Final
↓
Tournament Completed

Toàn bộ luồng này phải chạy mà không cần chỉnh database thủ công.

⸻

72. Explicit Non-goals for V1

Không làm ngay:

Payment
Registration portal
Membership management
Federation integration
Advanced ranking system
Multi-tenant SaaS
Native mobile app
Real-time WebSocket scoring
Official BWF integration
Automatic referee assignment
Complex double elimination

Giữ V1 tập trung vào vận hành giải nội bộ.

⸻

73. Future Architecture

Các extension có thể thêm:

Sport Templates
Badminton
Pickleball
Tennis
Table Tennis

Mỗi sport chỉ định:

Default Rules
Terminology
Scoring Presets

Tournament Core vẫn dùng chung.

⸻

74. Rule Presets

Có thể thêm preset:

Badminton Standard 21
Best of 3
21 points
30 max
Fast Group Stage
Best of 1
21 points
Fast Knockout
Best of 3
15 points

Admin chọn preset rồi chỉnh lại.

⸻

75. Development Priority

Codex nên triển khai theo đúng thứ tự:

1 Domain Model
2 Database Schema
3 Match Rule Engine
4 Score Validation Engine
5 Tournament / Event CRUD
6 Participants / Entries
7 Draw Engine
8 Round Robin
9 Score Entry
10 Standings Engine
11 Qualification
12 Bracket Engine
13 Scheduling
14 Operational UI
15 Import / Export

Không bắt đầu từ UI bracket hoặc animation trước khi Tournament Engine ổn định.

⸻

76. Engineering Principles

Không hard-code badminton rules

Sai:

if final:
  points = 21

Đúng:

rule = resolveMatchRule(match)

⸻

Không hard-code tournament structure

Sai:

Group
→ Quarter Final
→ Semi
→ Final

Đúng:

Stage pipeline configurable.

⸻

Không dùng Player trực tiếp trong Match

Luôn dùng:

Entry

để support:

Singles
Doubles
Team

⸻

Business logic không nằm trong UI

Tournament Engine phải reusable.

⸻

Match phải giữ rule snapshot

Không phụ thuộc mutable Stage Rule sau khi Match được tạo.

⸻

77. First Codex Task

Bắt đầu project bằng task:

TASK 001 — Tournament Manager Foundation

Deliverables:

Next.js project
SQLite + Drizzle
Docker setup
Core database schema
Tournament
TournamentEvent
Stage
Player
Club
Entry
EntryMember
MatchRule
Seed data
Basic admin layout

Không implement Draw Engine trong task đầu.

⸻

78. Second Codex Task

TASK 002 — Match Rule & Scoring Engine

Implement:

MatchRule resolver
Rule snapshot
Score validator
Set winner calculator
Match winner calculator

Unit tests bắt buộc.

⸻

79. Third Codex Task

TASK 003 — Draw Engine

Implement:

Group generation
Seed distribution
Random seed
Same-club avoidance
Constraint warnings
Draw history
Manual adjustment validation

⸻

80. Fourth Codex Task

TASK 004 — Group Competition Engine

Implement:

Round Robin generation
Match generation
Score entry
Standings
Tie-break

⸻

81. Fifth Codex Task

TASK 005 — Qualification & Knockout

Implement:

Qualification
Bracket generation
BYE
Winner progression
Final
Third-place optional

⸻

82. Sixth Codex Task

TASK 006 — Scheduling

Implement:

Courts
Timeline
Assignment
Rest rules
Conflict detection
Drag & drop

⸻

83. Definition of Architecture Success

Architecture đạt yêu cầu nếu có thể cấu hình giải:

GROUP
1 × 21
↓
ROUND OF 16
3 × 15
↓
QUARTER FINAL
3 × 15
↓
SEMI FINAL
3 × 15
↓
FINAL
3 × 21

mà không cần:

thay code
deploy lại
modify database manually

Chỉ cần thay cấu hình Tournament Manager.

⸻

84. Core Product Principle

Tournament Manager phải được xây dựng theo nguyên tắc:

Tournament structure is data, not code.

Match rules are configuration, not hard-coded logic.

Tournament Engine is independent from UI.

Điều này là nền tảng để hệ thống có thể phát triển lâu dài từ một tool nội bộ thành một Tournament Management Platform hoàn chỉnh.