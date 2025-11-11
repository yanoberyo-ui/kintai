/**
 * FDGroup勤怠管理システム - スプレッドシート自動出力
 *
 * 毎日11:00 AMに実行されるトリガー設定が必要
 *
 * セットアップ:
 * 1. Google Apps Scriptプロジェクトを作成
 * 2. このコードをコピー
 * 3. スクリプトプロパティに以下を設定:
 *    - SUPABASE_URL: SupabaseプロジェクトURL
 *    - SUPABASE_ANON_KEY: Supabase匿名キー
 *    - SPREADSHEET_ID: 出力先スプレッドシートID
 * 4. トリガーを設定（毎日11:00 AM）
 */

// スプレッドシートIDを取得（スクリプトプロパティから）
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const SUPABASE_URL = PropertiesService.getScriptProperties().getProperty('SUPABASE_URL');
const SUPABASE_ANON_KEY = PropertiesService.getScriptProperties().getProperty('SUPABASE_ANON_KEY');

/**
 * メイン関数 - トリガーから実行される
 */
function exportDailyAttendance() {
  try {
    Logger.log('勤怠データの自動出力を開始します');

    // 前日の日付を取得
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = Utilities.formatDate(yesterday, 'Asia/Tokyo', 'yyyy-MM-dd');

    Logger.log('対象日: ' + dateString);

    // Supabaseから全ユーザーの勤怠データを取得
    const attendances = fetchAttendanceData(dateString);

    if (!attendances || attendances.length === 0) {
      Logger.log('出力対象のデータがありません');
      return;
    }

    Logger.log(attendances.length + '件のデータを取得しました');

    // 各ユーザーのスプレッドシートに書き込み
    attendances.forEach(attendance => {
      try {
        writeToUserSheet(attendance);
      } catch (error) {
        Logger.log('ユーザー ' + attendance.user_name + ' のデータ書き込みに失敗: ' + error.message);
      }
    });

    Logger.log('勤怠データの自動出力が完了しました');

    // Slack通知（オプション）
    // sendSlackNotification('勤怠データの自動出力が完了しました (' + attendances.length + '件)');

  } catch (error) {
    Logger.log('エラーが発生しました: ' + error.message);
    // エラー通知をSlackに送信することも可能
  }
}

/**
 * Supabaseから勤怠データを取得
 */
function fetchAttendanceData(date) {
  const url = `${SUPABASE_URL}/rest/v1/attendances?date=eq.${date}&status=eq.completed&select=*,users(*)`;

  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    throw new Error('Supabaseからのデータ取得に失敗: ' + statusCode);
  }

  const data = JSON.parse(response.getContentText());

  // データの整形
  return data.map(record => {
    const user = record.users;
    return {
      user_id: record.user_id,
      user_name: user.name,
      employee_id: user.employee_id,
      date: record.date,
      clock_in: record.clock_in,
      clock_out: record.clock_out,
      break_minutes: record.break_minutes_used || 0,
      work_minutes: record.total_work_minutes || 0,
      notes: record.notes || ''
    };
  });
}

/**
 * ユーザーのシートに書き込み
 */
function writeToUserSheet(attendance) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

  // ユーザー名のシートを取得または作成
  let sheet = spreadsheet.getSheetByName(attendance.user_name);

  if (!sheet) {
    // シートが存在しない場合は新規作成
    sheet = spreadsheet.insertSheet(attendance.user_name);
    createSheetHeader(sheet, attendance.user_name, attendance.employee_id);
  }

  // データ行を追加
  const lastRow = sheet.getLastRow();
  const newRow = lastRow + 1;

  // 日付のフォーマット
  const date = new Date(attendance.date);
  const dateFormatted = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd');

  // 時刻のフォーマット
  const clockInTime = formatTimeOnly(attendance.clock_in);
  const clockOutTime = formatTimeOnly(attendance.clock_out);

  // 休憩時間と実働時間のフォーマット
  const breakHours = Math.floor(attendance.break_minutes / 60);
  const breakMins = attendance.break_minutes % 60;
  const breakFormatted = `${breakHours}:${breakMins.toString().padStart(2, '0')}`;

  const workHours = Math.floor(attendance.work_minutes / 60);
  const workMins = attendance.work_minutes % 60;
  const workFormatted = `${workHours}:${workMins.toString().padStart(2, '0')}`;

  // データを書き込み
  sheet.getRange(newRow, 1, 1, 6).setValues([[
    dateFormatted,
    clockInTime,
    clockOutTime,
    breakFormatted,
    workFormatted,
    attendance.notes
  ]]);

  // 月次集計を更新
  updateMonthlySummary(sheet);
}

/**
 * シートのヘッダーを作成
 */
function createSheetHeader(sheet, userName, employeeId) {
  // タイトル行
  sheet.getRange(1, 1).setValue(userName + ' (' + employeeId + ')');
  sheet.getRange(1, 1).setFontSize(14).setFontWeight('bold');

  // ヘッダー行
  const headers = ['日付', '出勤時刻', '退勤時刻', '休憩時間', '実働時間', '備考'];
  sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(3, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  // 列幅の設定
  sheet.setColumnWidth(1, 100); // 日付
  sheet.setColumnWidth(2, 80);  // 出勤時刻
  sheet.setColumnWidth(3, 80);  // 退勤時刻
  sheet.setColumnWidth(4, 80);  // 休憩時間
  sheet.setColumnWidth(5, 80);  // 実働時間
  sheet.setColumnWidth(6, 200); // 備考

  // 固定行
  sheet.setFrozenRows(3);
}

/**
 * 月次集計を更新
 */
function updateMonthlySummary(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 3) return; // データがない場合

  // データ範囲（4行目から最終行まで）
  const dataRange = sheet.getRange(4, 1, lastRow - 3, 6);
  const values = dataRange.getValues();

  // 月ごとの集計
  const monthlySummary = {};

  values.forEach(row => {
    if (!row[0]) return; // 空行はスキップ

    const date = new Date(row[0]);
    const month = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM');

    if (!monthlySummary[month]) {
      monthlySummary[month] = {
        days: 0,
        totalMinutes: 0
      };
    }

    monthlySummary[month].days++;

    // 実働時間を分に変換
    const workTime = row[4]; // "8:30" 形式
    if (workTime) {
      const parts = workTime.split(':');
      const minutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      monthlySummary[month].totalMinutes += minutes;
    }
  });

  // 集計行を追加
  let summaryRow = lastRow + 2;

  Object.keys(monthlySummary).sort().forEach(month => {
    const summary = monthlySummary[month];
    const hours = Math.floor(summary.totalMinutes / 60);
    const minutes = summary.totalMinutes % 60;

    sheet.getRange(summaryRow, 1).setValue(month + ' 合計');
    sheet.getRange(summaryRow, 2).setValue(summary.days + '日');
    sheet.getRange(summaryRow, 3).setValue(`${hours}時間${minutes}分`);

    sheet.getRange(summaryRow, 1, 1, 3)
      .setFontWeight('bold')
      .setBackground('#f3f3f3');

    summaryRow++;
  });
}

/**
 * 時刻のみをフォーマット
 */
function formatTimeOnly(timestamp) {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  return Utilities.formatDate(date, 'Asia/Tokyo', 'HH:mm');
}

/**
 * Slack通知（オプション）
 */
function sendSlackNotification(message) {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL');

  if (!webhookUrl) return;

  const payload = {
    text: message
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  UrlFetchApp.fetch(webhookUrl, options);
}

/**
 * テスト実行用関数
 */
function testExport() {
  exportDailyAttendance();
}
