# リリース監査 — 対応状況報告(2026-11-03)

作業ブランチ: `release-audit-fixes`。本番DB(`jrdnhjzvmyuslziodhpm`)への**書き込み・デプロイは一切行っていません**。全ての修正・検証はステージング(`yuponpfvhclhfqtihuok`、本番から複製されたSupabaseブランチ)に対して、実際のSupabase Auth・RLS・RPCを使って行いました。本番は追加で許可を得て**読み取り専用**の確認のみ実施済み(詳細は1-①・1-④末尾)。

## 1. 最優先項目の対応状況

### ① 履歴のアクセス制御 — 修正・実サービスで検証済み

**確認した不具合(ステージングで再現)**:
- `matches`: RLSが完全に無効(`rowsecurity=false`)。anonロールにSELECT/INSERT/UPDATE/DELETE/TRUNCATEが全付与。
- `session_logs`: RLSは有効だが、SELECT/INSERTポリシーの条件が実質`true`(無条件許可)。
- `exchanges`/`history`/`partners`/`session`の各ページは`supabase.auth.getSession()`等を一度も呼んでおらず、クライアント側の`.eq('user_id', sid)`フィルタのみに依存。DevTools等で誰でも無視できる状態でした。

**本番でも同一の不具合を確認済み**(読み取り専用、2026-11-03): `matches`は`rowsecurity=false`、`session_logs`のSELECT/INSERTポリシーは`qual`/`with_check`とも文字どおり`true`。ステージングの状態は本番の推測ではなく、本番そのものの確認結果です。

**根本原因の特定**: `matches`/`session_logs`は`auth.uid()`ではなく`localStorage`の`mutua_session_id`で本人管理していますが、旧`/onboarding`の最終ステップも新フローと同じく`supabase.auth.signUp()`を呼んでおり、`profiles.email`経由で実際のSupabase Auth JWTと紐付け可能でした(既存の`live_own_profile_read`ポリシーと同じ方式)。

**本番の`profiles`⟷`auth.users`対応状況を確認しました**(読み取り専用、集計のみ・個人情報は取得していません):
```
total_profiles:              229
distinct_emails:              229
profiles_with_auth_user:     229
profiles_without_auth_user:    0
```
**本番の`profiles`全229件が、例外なく`auth.users`と対応していました。** つまりRLS修正後も、今まで一度でもサインアップ済みの既存ユーザーは**コード変更なし・再登録不要**でそのまま自分の履歴を読めます。「未確認の既存ユーザー経路」として前回報告した懸念は解消されました。

**修正内容**(`legacy-history-rls-migration.sql`):
- `matches`にRLSを有効化。参加者(`profiles.email = auth.jwt()->>'email'`経由で本人確認)のみSELECT/INSERT/UPDATE可能なポリシーを追加。
- `session_logs`の無条件ポリシーを削除し、本人(`user_id`の所有者)のみSELECT/INSERTできるポリシーに置き換え。
- 両テーブルの`anon`ロールへの直接権限を剥奪(多層防御)。
- 既存の全書き込み経路(cron/admin/auto-match/rematch/schedule-match/set-availability等、17箇所超のクライアント直接アクセスを含む)を精査し、**マッチ作成・更新系は全てサーバーAPIがSERVICE_ROLE_KEYで行っており影響なし**。クライアントから直接書き込むのは`find-match`(新規マッチ作成)と`session`(終了時のarchive)の2箇所のみで、どちらも「自分が参加者である」範囲に収まることを確認済み。

**実サービスでの検証**(`scripts/test-legacy-history-rls.mjs`、実アカウント4件・実JWTで14項目):
```
PASS matches: 参加者A/Bは読める、無関係のC・匿名は読めない
PASS matches: 参加者は自分のマッチを更新できる、無関係者は更新できない(0件)
PASS matches: 参加者は自分を含むマッチを作成できる、無関係者は他人同士のマッチを偽造できない
PASS session_logs: 本人は読める、通話相手(本人ではない)・無関係者・匿名は読めない
PASS session_logs: 無関係者は他人名義のログを偽造できない、本人は自分のログを挿入できる
14/14 passed
```
「本人専用の振り返りチャットは通話相手にも公開しない」も満たしています(`session_logs`は`partner_id`ではなく`user_id`本人のみ閲覧可)。

### ② 言語条件の反映 — 修正済み(本日先に対応)

LP(`?start=text&native=...&learning=...`)経由の自動join処理が、React stateの更新を待たずに`join()`を呼んでいたため、保存前の古いプロフィール言語でマッチングしていました。`startWith(native, learning)`に統一し、URLから来た値を直接引数で渡すことで、「保存→保存完了を待つ→join」の順序を通常の開始ボタンと一致させました。`npx tsc --noEmit`クリーン。

### ③ 通話APIの本番拒否ガード — 調査完了・未変更(判断が必要)

`src/app/api/live-exchange/route.ts:14-18`のガードは2つの役割を持ちます:
1. `LIVE_EXCHANGE_PROJECT_REF`が未設定なら503(接続先プロジェクトが分からない状態で動かさない)。
2. **`ref === 'jrdnhjzvmyuslziodhpm'`(本番ref)の場合は無条件で503** — これはこのセッション中の開発作業が誤って本番に書き込まないための、コード上のハードブロックです。

本番で有効化するには:
- **設定**(値は秘匿、項目名のみ): Vercel本番環境に`LIVE_EXCHANGE_PROJECT_REF=jrdnhjzvmyuslziodhpm`を追加し、`NEXT_PUBLIC_SUPABASE_URL`が本番URLと一致していることを確認。
- **コード変更が別途必要**: 上記1行目の`ref === 'jrdnhjzvmyuslziodhpm'`という本番ref決め打ちのブロックを外さない限り、設定だけでは本番で動きません。これは「準備ができたら外す」意図のガードなので、**今回は外していません**(AI通話・文字起こし・ログ閲覧が未実装の段階で本番有効化すべきでないため)。外すかどうかはリリース判断そのものなので、ご確認のうえ指示してください。

### ④ 通話履歴 — 実装・実動作検証済み

**問題**: `live_exchange`(現行の主要通話システム)は会話・通話の状態を更新するだけで、どこにも永続履歴を残していませんでした。`/exchanges`等が読む`session_logs`はこのシステムと無関係です。

**実装内容**(`call-history-migration.sql`):
- `practice_sessions`テーブルを新設(`conversation_id`に`unique`制約 — これが重複記録防止の要)。相手種別(`partner_type`、現状は`human`固定、将来のAI通話に向けて予約済み)、参加者、言語ペア(スナップショット)、開始・終了時刻、会話全体の時間、**通話(音声)の実接続時間**(`call_connected_secs`)、終了理由、メッセージ数を保持。
- `live_calls`に`connected_at`/`ended_at`を追加(今までは招待時刻しか無く、実通話時間を算出できませんでした)。
- `live_exchange()`関数内の**全ての会話終了経路**(明示的end、キャンセル競合、片側切断による自動クリーンアップ)の直後に、`on conflict (conversation_id) do nothing`付きで履歴を記録。重複終了イベントが来ても2重記録されません。

**検証**(ローカル分離Postgresで実施):
```
通常終了:        2秒待機後end → duration_secs=2, call_connected_secs=2, ended_reason='user_left' ✓
重複end:         同じ会話に2回目のend → エラーは正しく返るが、履歴は1件のまま(重複なし) ✓
片側切断:        19秒ハートビート途絶 → 自動クリーンアップが ended_reason='peer_left' で記録 ✓
参加者読み取り:  本人は読める(RLS) ✓
```
さらに、既存の回帰テストスイート`npm run test:live`(実サービス・実JWT、18項目)が**全てPASS**のままであることを確認済み — 今回の変更が既存のマッチング・通話・チャット機能を壊していないことの裏付けです。`npm run test:audio`(2件)、`npx tsc --noEmit`もクリーン。

ステージングへの適用・実検証も完了しています。

**本番確認(読み取り専用)**: `live_%`で始まるテーブルは本番に**1つも存在しません**。`instant-call-migration.sql`相当(`live_conversations`/`live_calls`等の基盤)がまだ本番に未適用ということです。つまり④を本番に反映するには、今回の`call-history-migration.sql`単体ではなく、**土台となる既存マイグレーション(`supabase-local/supabase/migrations/20261101052000_live_exchange.sql`等)から順に適用する必要があります**(下記「本番反映手順」に反映済み)。

## 2. 次フェーズ(AI通話・文字起こし・ログ質問チャット)— 未着手

今回は手をつけていません。理由:
- `OPENAI_API_KEY`は`.env.local`・`.env.staging.local`のいずれにも未設定(値は要求していません。設定箇所: Vercelの環境変数、またはステージング用`.env.staging.local`)。
- これらは「接続できていないものをモックで完成扱いにしない」という指示に反するため、外部サービス接続が無い状態で実装だけ進めることはしませんでした。
- 添付いただいたもう一つのLLMによる監査報告の結論(今日出すなら人同士のテキスト＋通話に限定したβが妥当、AI・ログ・振り返りを備えたリリースとは別)にも合致します。

着手する場合に必要な判断・設定は、その監査報告の「3. 振り返りを実現する最小変更案」に詳細があります(テーブル設計・引用ID方式・認可方針など、私も目を通し妥当と判断しています)。

## 3. 既存ユーザーへの影響(必須確認事項)

- **影響を受けるデータ**: `matches`・`session_logs`の全行(本番で`profiles`は229件、全件`auth.users`と対応確認済み — `matches`/`session_logs`自体の行数は未集計ですが、RLS修正はどの行数でも同じロジックで安全に動作します)。
- **確認済みの認証方式**: `/onboarding`・新規instant-exchange共にSupabase Auth(`signUp`/`signInWithPassword`)。本番`profiles`全229件が`auth.users`と対応しているため、過去に一度でもサインアップ済みの既存ユーザーは、セッションが有効な限り**コード変更なしでそのまま動作します**(同じ`supabase`クライアントインスタンスが自動でJWTを添付するため)。
- **既存ユーザー経路の確認結果**: 本番で確認済み。`profiles`全229件・distinct_emails229件・`auth.users`対応229件・非対応0件。取りこぼしはありません。ブラウザのセッションが切れている人だけは`/login`等で再ログインが必要になりますが(データは消えません、表示されないだけです)、これは「再登録」ではなく「ログイン」であり要件に反しません。
- **ロールバック時のデータの扱い**: 両migrationファイル末尾にロールバックSQLを記載済み。`matches`/`session_logs`のRLSを元の状態(無条件許可)に戻すことは可能ですが、脆弱性が復活するため非推奨です。`practice_sessions`はDROP TABLEで消せますが、記録済みの通話履歴も失われます。

## 4. 残るリリース阻害要因

1. ③の本番ガードのコード変更判断(いつ、誰が、本番ref決め打ちブロックを外すか)。
2. ~~本番の`profiles`⟷`auth.users`対応状況~~ → **確認済み、問題なし**(全229件対応)。
3. AI通話・文字起こし・ログ質問チャットは未実装(上記2節)。
4. 実機(別端末・別回線)での聞き取り・エコー・TURN relay確認は、ブラウザサンドボックスでは実施不可。

## 5. 本番反映手順(案、未実施)

1. ~~本番の`profiles`⟷`auth.users`対応を事前確認~~ → 完了(全229件対応、問題なし)。
2. `legacy-history-rls-migration.sql`を本番に適用 → `matches`/`session_logs`の読み取りがRLS経由になることを、実アカウントで再確認。
3. ④を反映する場合、`call-history-migration.sql`単体ではなく、まだ本番未適用の`supabase-local/supabase/migrations/20261101052000_live_exchange.sql`・`20261101052100_profile_rls.sql`を先に適用し、その上で`call-history-migration.sql`を適用(本番には`live_*`テーブルが1つも無いことを確認済み)。適用直後に`npm run test:live`相当を本番向けに実行して確認。
4. ③のコードガードを外す(本番ref決め打ちブロックの削除)はこの時点では**含めない** — 通話機能自体は別途③の判断を待つ。
