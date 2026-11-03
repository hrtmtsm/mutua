-- yonder: 招待フロー(/auth/welcome)互換性修正マイグレーション
-- 即時通話機能(instant-call-migration.sql)とは完全に独立。これだけを先に、単独で適用できる。
--
-- 背景: 「招待ユーザーがパスワード未設定かどうか」を /auth/callback が名前文字列
-- (nameが空 or '@'を含む)から推測していたが、これは新しい最小サインアップ
-- (SetupModal)の導入でnameを書かなくなったことと衝突する。名前やメールからの
-- 推測をやめ、作成時に明示的に立てる専用フラグ profiles.needs_welcome で判定する。
--
-- アプリ側コード(src/app/auth/callback/page.tsx)は、この列が存在しない間は
-- 従来のヒューリスティックにフォールバックするよう既に実装済みなので、
-- 「コードだけ先にデプロイされてもDB未適用の間は壊れない」設計になっている
-- (未定義を「設定不要」として扱わない)。

-- ── 事前確認(読み取り専用。2026-10-31時点で本番に対して実行し、結果を確認済み)──
-- 対象: profiles 全229件中、
--   would_be_flagged_true  = 30件  (name is null or name like '%@%')
--   would_be_flagged_false = 199件
-- 適用前に同じクエリを再実行し、件数が大きく変動していないか確認することを推奨する:
select
  count(*) as total_profiles,
  count(*) filter (where name is null or name like '%@%') as would_be_flagged_true,
  count(*) filter (where name is not null and name not like '%@%') as would_be_flagged_false
from profiles;

-- ── ステップ1: 列追加(デフォルトfalse。この時点では既存行の判定は何も変わらない)──
alter table profiles add column if not exists needs_welcome boolean not null default false;

-- ── ステップ2: 既存データのバックフィル(列追加の直後に1回だけ実行) ──
--
-- 【限界・不確実性の報告】
-- この判定は旧来のヒューリスティック(name無し、またはメール形式のname)を
-- そのまま流用しており、「そのユーザーが実際にSupabase Authでパスワードを
-- 設定済みかどうか」を確実に判定するものではない。profilesテーブルにはパス
-- ワード設定状態を示す列がなく、auth.users側にもクライアントから安全に読める
-- 形の「パスワード設定済みフラグ」は存在しないため、確実な判定は不可能。
-- 具体的に起こりうる誤分類:
--   - 本来は招待済み未設定(パスワード未設定)なのに、何らかの理由で既にnameが
--     設定されていて'@'を含まない → false のまま残り、/auth/welcomeに送られない
--   - 既にパスワード設定済み(通常の/auth/welcomeやonboarding完了済み)なのに
--     name未設定のまま → true になり、次回ログイン時に不要な/auth/welcomeへ
--     送られる(実害は限定的:名前とパスワードの再入力を一度求められるだけで、
--     データ破壊は起きない)
-- これは今回のバックフィルが新たに生む不確実性ではなく、元の alreadySetUp
-- ヒューリスティック自体が最初から持っていた限界をそのまま引き継いだもの。
-- 移行後に新規作成される行(admin/run-matching・auto-matchのスタブ作成、または
-- 通常のonboarding/SetupModal)は、すべてこのバックフィルに頼らず明示的に
-- needs_welcome を設定するコードになっているため、今後はこの不確実性は生じない。
update profiles
set needs_welcome = true
where name is null or name like '%@%';

-- ── ステップ3: バックフィル結果の確認(読み取り専用) ──
select needs_welcome, count(*) from profiles group by needs_welcome;

-- ── 適用順序 ──
-- 1. このファイル(invite-flow-fix-migration.sql)を先に適用する。
-- 2. instant-call-migration.sql は独立しているため、このファイルの前でも後でも
--    どちらでもよいが、Phase 1(登録・ログイン)の完全性を優先するなら先にこちらを適用する。

-- ── 失敗時の復旧手順 ──
-- バックフィル結果が事前確認の件数と大きくズレている、あるいはステップ2実行後に
-- 招待フローの挙動がおかしいと分かった場合:
--
-- (a) バックフィルだけを取り消し、列はそのまま残して全件falseに戻す
--     (アプリ側は列の存在を検知して新ロジックを使うが、値は全てfalseになるため
--      実質的に「全員 /app へ」という状態になる。緊急避避として使える):
--       update profiles set needs_welcome = false;
--
-- (b) 列自体を取り消して完全に元の状態(名前ヒューリスティックのみ)に戻す
--     (アプリ側コードは列の不在を検知して自動的に旧ヒューリスティックへ
--      フォールバックするため、安全に実行できる):
--       alter table profiles drop column if exists needs_welcome;
