/**
 * 日付取得ユーティリティ（Supabase Functions用）
 * 日付の切り替えは3:00amに行われる
 */

/**
 * 3:00amに日付が切り替わる「今日」の日付文字列を取得
 * @returns {string} YYYY-MM-DD形式の日付文字列
 */
export function getTodayDate(): string {
  const now = new Date();
  // 日本時間に変換（UTC + 9時間）
  const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  // 3時間を引いてから日付を判定（3:00amに日付が切り替わる）
  const adjustedDate = new Date(jstDate.getTime() - (3 * 60 * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
}

