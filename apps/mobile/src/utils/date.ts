/**
 * 日付取得ユーティリティ
 * 日付の切り替えは3:00amに行われる
 */

/**
 * 3:00amに日付が切り替わる「今日」の日付文字列を取得
 */
export function getTodayDate(): string {
  const now = new Date();
  // 日本時間に変換（UTC + 9時間）
  const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  // 3時間を引いてから日付を判定（3:00amに日付が切り替わる）
  const adjustedDate = new Date(jstDate.getTime() - (3 * 60 * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
}

/**
 * 指定されたDateオブジェクトから、3:00amに日付が切り替わる日付文字列を取得
 */
export function getDateString(date: Date): string {
  // 日本時間に変換（UTC + 9時間）
  const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  // 3時間を引いてから日付を判定（3:00amに日付が切り替わる）
  const adjustedDate = new Date(jstDate.getTime() - (3 * 60 * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
}

/**
 * 昨日の日付文字列を取得（3:00amに日付が切り替わる基準）
 */
export function getYesterdayDate(): string {
  const now = new Date();
  // 日本時間に変換（UTC + 9時間）
  const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  // 3時間を引いてから日付を判定
  const adjustedDate = new Date(jstDate.getTime() - (3 * 60 * 60 * 1000));
  // 1日前にする
  adjustedDate.setDate(adjustedDate.getDate() - 1);
  return adjustedDate.toISOString().split('T')[0];
}
