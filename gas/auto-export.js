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
const SUPABASE_SERVICE_KEY = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_ROLE_KEY');

/**
 * 3:00amに日付が切り替わる「昨日」の日付を取得
 */
function getYesterdayDate() {
  const now = new Date();
  // 日本時間に変換（UTC + 9時間）
  const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  // 3時間を引いてから日付を判定（3:00amに日付が切り替わる）
  const adjustedDate = new Date(jstDate.getTime() - (3 * 60 * 60 * 1000));
  // 1日前にする
  adjustedDate.setDate(adjustedDate.getDate() - 1);
  return Utilities.formatDate(adjustedDate, 'Asia/Tokyo', 'yyyy-MM-dd');
}

/**
 * 3:00amに日付が切り替わる「今日」の日付を取得
 */
function getTodayDate() {
  const now = new Date();
  // 日本時間に変換（UTC + 9時間）
  const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  // 3時間を引いてから日付を判定（3:00amに日付が切り替わる）
  const adjustedDate = new Date(jstDate.getTime() - (3 * 60 * 60 * 1000));
  return Utilities.formatDate(adjustedDate, 'Asia/Tokyo', 'yyyy-MM-dd');
}

/**
 * メイン関数 - トリガーから実行される
 */
function exportDailyAttendance() {
  try {
    Logger.log('勤怠データの自動出力を開始します');

    // 3:00amに日付が切り替わる「昨日」の日付を取得
    const dateString = getYesterdayDate();

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

    // ダッシュボードシートを更新
    updateDashboard();

    // TODO達成率シートを更新
    updateTodoAchievementSheet(dateString);

    // ユニット達成率を同期
    syncUnitAchievementRates();

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
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('スクリプトプロパティが設定されていません。SUPABASE_URLとSUPABASE_SERVICE_ROLE_KEYを設定してください。');
  }

  const url = `${SUPABASE_URL}/rest/v1/attendances?date=eq.${date}&status=eq.completed&select=*,users(*)`;

  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
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
    
    // 勤務時間を取得（データベースの値をそのまま使用）
    let workMinutes = record.total_work_minutes || 0;
    
    return {
      user_id: record.user_id,
      user_name: user.name,
      employee_id: user.employee_id,
      date: record.date,
      clock_in: record.clock_in,
      clock_out: record.clock_out,
      break_sessions: record.break_sessions || [],
      break_minutes: record.break_minutes_used || 0,
      work_minutes: workMinutes,
      work_type: record.work_type || '',
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
  } else {
    // 既存シートのヘッダーを確認して更新（「中抜け」列が存在しない場合）
    const headerRange = sheet.getRange(3, 1, 1, 9);
    const headers = headerRange.getValues()[0];
    const expectedHeaders = ['月', '日', '出勤', '退勤', '中抜け', '休憩', '実働', '勤務タイプ', '備考'];
    
    // ヘッダーが古い形式（8列）または「中抜け」列が存在しない場合は更新
    if (headers.length < 9 || headers[4] !== '中抜け') {
      headerRange.setValues([expectedHeaders]);
      headerRange.setFontWeight('bold')
        .setBackground('#4285f4')
        .setFontColor('#ffffff');
      
      // 列幅も更新
      sheet.setColumnWidth(5, 120); // 中抜け
      sheet.setColumnWidth(6, 50);  // 休憩
      sheet.setColumnWidth(7, 60);  // 実働
      sheet.setColumnWidth(8, 100); // 勤務タイプ
      sheet.setColumnWidth(9, 150); // 備考
    }
  }

  // 既存の集計行を削除（「合計」を含む行を探して削除）
  clearSummaryRows(sheet);

  // 日付のフォーマット
  const date = new Date(attendance.date);
  
  // 3:00am基準で今月かどうかを判定
  const todayDateStr = getTodayDate(); // 3:00am基準の今日の日付文字列（YYYY-MM-DD）
  const todayDate = new Date(todayDateStr + 'T00:00:00+09:00');
  const currentYearStr = Utilities.formatDate(todayDate, 'Asia/Tokyo', 'yyyy');
  const currentMonthStr = Utilities.formatDate(todayDate, 'Asia/Tokyo', 'MM');
  const currentYear = parseInt(currentYearStr);
  const currentMonth = parseInt(currentMonthStr);
  
  const recordDate = new Date(attendance.date + 'T00:00:00+09:00');
  const recordYearStr = Utilities.formatDate(recordDate, 'Asia/Tokyo', 'yyyy');
  const recordMonthStr = Utilities.formatDate(recordDate, 'Asia/Tokyo', 'MM');
  const recordYear = parseInt(recordYearStr);
  const recordMonth = parseInt(recordMonthStr);
  
  const isCurrentMonth = (recordYear === currentYear && recordMonth === currentMonth);
  
  // データ行を追加（今月のデータは今月セクションに、過去のデータは過去セクションに）
  let lastRow;
  const PAST_DATA_START_ROW = 33; // 過去のデータ開始行
  
  if (isCurrentMonth) {
    // 今月のデータ: 今月セクション（4行目〜32行目）の最終行を探す
    lastRow = findLastDataRowInCurrentMonthSection(sheet, PAST_DATA_START_ROW);
  } else {
    // 過去のデータ: 過去セクション（33行目以降）の最終行を探す
    lastRow = findLastDataRowInPastSection(sheet, PAST_DATA_START_ROW);
  }
  
  const newRow = lastRow + 1;
  const dateFormatted = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd');

  // 時刻のフォーマット
  const clockInTime = formatTimeOnly(attendance.clock_in);
  const clockOutTime = formatTimeOnly(attendance.clock_out);

  // 中抜け情報のフォーマット
  let breakSessionsFormatted = '-';
  if (attendance.break_sessions && attendance.break_sessions.length > 0) {
    const sessions = attendance.break_sessions
      .filter(session => session.start) // 開始時刻があるもののみ
      .map(session => {
        const startTime = formatTimeOnly(session.start);
        const endTime = session.end ? formatTimeOnly(session.end) : '中抜け中';
        return `${startTime}-${endTime}`;
      });
    
    if (sessions.length > 0) {
      breakSessionsFormatted = sessions.join(' / ');
    }
  }

  // 休憩時間と実働時間のフォーマット
  const breakHours = Math.floor(attendance.break_minutes / 60);
  const breakMins = attendance.break_minutes % 60;
  const breakFormatted = `${breakHours}:${breakMins.toString().padStart(2, '0')}`;

  const workHours = Math.floor(attendance.work_minutes / 60);
  const workMins = attendance.work_minutes % 60;
  const workFormatted = `${workHours}:${workMins.toString().padStart(2, '0')}`;

  // 勤務タイプのフォーマット
  let workTypeFormatted = '';
  if (attendance.work_type === 'remote') {
    workTypeFormatted = '🏠 リモート';
  } else if (attendance.work_type === 'office') {
    workTypeFormatted = '🏢 出社';
  }

  // 月と日を分離
  const monthFormatted = (date.getMonth() + 1) + '月';
  const dayFormatted = date.getDate() + '日';

  // 前の行と同じ月かチェック（同じ月なら月列は空白）
  let displayMonth = monthFormatted;
  if (newRow > 4) {
    const prevMonth = sheet.getRange(newRow - 1, 1).getValue();
    if (prevMonth === monthFormatted) {
      displayMonth = '';
    }
  }

  // データを書き込み（月と日を分離）
  sheet.getRange(newRow, 1, 1, 9).setValues([[
    displayMonth,
    dayFormatted,
    clockInTime,
    clockOutTime,
    breakSessionsFormatted,
    breakFormatted,
    workFormatted,
    workTypeFormatted,
    attendance.notes
  ]]);

  // 勤務タイプに応じて背景色を設定
  if (attendance.work_type === 'remote') {
    sheet.getRange(newRow, 8).setBackground('#e3f2fd'); // 薄い青
  } else if (attendance.work_type === 'office') {
    sheet.getRange(newRow, 8).setBackground('#e8f5e9'); // 薄い緑
  }

  // 月が変わった行は背景色を設定
  if (displayMonth !== '') {
    sheet.getRange(newRow, 1).setFontWeight('bold').setBackground('#fff3e0');
  }

  // 月次集計を更新（固定セルに）
  updateMonthlySummaryFixed(sheet);
}

/**
 * シートのヘッダーを作成
 */
function createSheetHeader(sheet, userName, employeeId) {
  // タイトル行
  var title = employeeId ? userName + ' (' + employeeId + ')' : userName;
  sheet.getRange(1, 1).setValue(title);
  sheet.getRange(1, 1).setFontSize(14).setFontWeight('bold');

  // 今月合計セクション（固定位置: J列）
  sheet.getRange(1, 10).setValue('📊 今月合計');
  sheet.getRange(1, 10).setFontWeight('bold').setBackground('#e8f0fe');
  sheet.getRange(1, 11).setValue('0:00');
  sheet.getRange(1, 11).setFontWeight('bold').setFontSize(12);
  
  sheet.getRange(2, 10).setValue('出勤日数');
  sheet.getRange(2, 10).setFontWeight('bold').setBackground('#e8f0fe');
  sheet.getRange(2, 11).setValue('0日');

  sheet.getRange(1, 12).setValue('🏠 リモート');
  sheet.getRange(1, 12).setFontWeight('bold').setBackground('#e3f2fd');
  sheet.getRange(1, 13).setValue('0日');
  
  sheet.getRange(2, 12).setValue('🏢 出社');
  sheet.getRange(2, 12).setFontWeight('bold').setBackground('#e8f5e9');
  sheet.getRange(2, 13).setValue('0日');

  // 先月合計セクション（固定位置: O列）
  sheet.getRange(1, 15).setValue('📅 先月合計');
  sheet.getRange(1, 15).setFontWeight('bold').setBackground('#fff3e0');
  sheet.getRange(1, 16).setValue('0:00');
  sheet.getRange(1, 16).setFontWeight('bold').setFontSize(12);
  
  sheet.getRange(2, 15).setValue('出勤日数');
  sheet.getRange(2, 15).setFontWeight('bold').setBackground('#fff3e0');
  sheet.getRange(2, 16).setValue('0日');

  sheet.getRange(1, 17).setValue('🏠 リモート');
  sheet.getRange(1, 17).setFontWeight('bold').setBackground('#e3f2fd');
  sheet.getRange(1, 18).setValue('0日');
  
  sheet.getRange(2, 17).setValue('🏢 出社');
  sheet.getRange(2, 17).setFontWeight('bold').setBackground('#e8f5e9');
  sheet.getRange(2, 18).setValue('0日');

  // ヘッダー行（月と日を分離）
  const headers = ['月', '日', '出勤', '退勤', '中抜け', '休憩', '実働', '勤務タイプ', '備考'];
  sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(3, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  // 列幅の設定
  sheet.setColumnWidth(1, 60);  // 月
  sheet.setColumnWidth(2, 50);  // 日
  sheet.setColumnWidth(3, 60);  // 出勤
  sheet.setColumnWidth(4, 60);  // 退勤
  sheet.setColumnWidth(5, 120); // 中抜け
  sheet.setColumnWidth(6, 50);  // 休憩
  sheet.setColumnWidth(7, 60);  // 実働
  sheet.setColumnWidth(8, 100); // 勤務タイプ
  sheet.setColumnWidth(9, 150); // 備考
  sheet.setColumnWidth(10, 100); // 今月合計ラベル
  sheet.setColumnWidth(11, 80); // 今月合計値
  sheet.setColumnWidth(12, 100); // 今月リモート/出社ラベル
  sheet.setColumnWidth(13, 60); // 今月リモート/出社値
  sheet.setColumnWidth(14, 20); // 区切り
  sheet.setColumnWidth(15, 100); // 先月合計ラベル
  sheet.setColumnWidth(16, 80); // 先月合計値
  sheet.setColumnWidth(17, 100); // 先月リモート/出社ラベル
  sheet.setColumnWidth(18, 60); // 先月リモート/出社値

  // 固定行
  sheet.setFrozenRows(3);
}

/**
 * 集計行を削除（「合計」を含む行を探して削除）
 */
function clearSummaryRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 3) return;

  // 下から上に向かって集計行を探して削除
  for (let row = lastRow; row >= 4; row--) {
    const cellValueA = sheet.getRange(row, 1).getValue();
    const cellValueB = sheet.getRange(row, 2).getValue();
    if ((cellValueA && String(cellValueA).includes('合計')) || 
        (cellValueB && String(cellValueB).includes('合計'))) {
      sheet.deleteRow(row);
    }
  }
}

/**
 * データ行の最終行を見つける（集計行を除く）
 */
function findLastDataRow(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 3) return 3;

  // 下から上に向かってデータ行を探す
  for (let row = lastRow; row >= 4; row--) {
    const cellValueA = sheet.getRange(row, 1).getValue();
    const cellValueB = sheet.getRange(row, 2).getValue();
    // 「合計」を含まない行で、「月」か「日」のデータがある行を探す
    const isDataRow = (cellValueA && String(cellValueA).includes('月') && !String(cellValueA).includes('合計')) ||
                      (cellValueB && String(cellValueB).includes('日'));
    if (isDataRow) {
      return row;
    }
  }
  return 3;
}

/**
 * 今月セクション（4行目〜pastDataStartRow-1行目）の最終データ行を見つける
 */
function findLastDataRowInCurrentMonthSection(sheet, pastDataStartRow) {
  const lastRow = Math.min(sheet.getLastRow(), pastDataStartRow - 1);
  if (lastRow <= 3) return 3;

  // 下から上に向かってデータ行を探す（過去データセクションの前まで）
  for (let row = lastRow; row >= 4; row--) {
    const cellValueA = sheet.getRange(row, 1).getValue();
    const cellValueB = sheet.getRange(row, 2).getValue();
    // 「合計」を含まない行で、「月」か「日」のデータがある行を探す
    const isDataRow = (cellValueA && String(cellValueA).includes('月') && !String(cellValueA).includes('合計')) ||
                      (cellValueB && String(cellValueB).includes('日'));
    if (isDataRow) {
      return row;
    }
  }
  return 3;
}

/**
 * 過去セクション（pastDataStartRow行目以降）の最終データ行を見つける
 */
function findLastDataRowInPastSection(sheet, pastDataStartRow) {
  const lastRow = sheet.getLastRow();
  if (lastRow < pastDataStartRow) return pastDataStartRow - 1;

  // 下から上に向かってデータ行を探す（過去データセクションから）
  for (let row = lastRow; row >= pastDataStartRow; row--) {
    const cellValueA = sheet.getRange(row, 1).getValue();
    const cellValueB = sheet.getRange(row, 2).getValue();
    // 「合計」を含まない行で、「月」か「日」のデータがある行を探す
    const isDataRow = (cellValueA && String(cellValueA).includes('月') && !String(cellValueA).includes('合計')) ||
                      (cellValueB && String(cellValueB).includes('日'));
    if (isDataRow) {
      return row;
    }
  }
  return pastDataStartRow - 1;
}

/**
 * 月次集計を更新（従来版 - 互換性のため残す）
 */
function updateMonthlySummary(sheet) {
  updateMonthlySummaryFixed(sheet);
}

/**
 * 月次集計を固定セルに更新 + シート最下部に月別集計を追加
 */
function updateMonthlySummaryFixed(sheet) {
  // まず既存の集計行を削除
  clearSummaryRows(sheet);
  
  const PAST_DATA_START_ROW = 33; // 過去のデータ開始行
  
  // 今月セクション（4行目〜32行目）の最終データ行を取得
  const lastDataRowCurrentMonth = findLastDataRowInCurrentMonthSection(sheet, PAST_DATA_START_ROW);
  
  // 過去セクション（33行目以降）の最終データ行を取得（先月のデータが含まれる可能性がある）
  const lastDataRowPast = sheet.getLastRow();
  
  // 今月セクションのデータ範囲
  let currentMonthValues = [];
  if (lastDataRowCurrentMonth > 3) {
    const currentMonthRange = sheet.getRange(4, 1, lastDataRowCurrentMonth - 3, 9);
    currentMonthValues = currentMonthRange.getValues();
  }
  
  // 過去セクションのデータ範囲（先月のデータが含まれる可能性がある）
  let pastValues = [];
  if (lastDataRowPast >= PAST_DATA_START_ROW) {
    // 過去セクションの開始行を探す（「過去の勤怠データ」ヘッダーをスキップ）
    let pastDataStartRow = PAST_DATA_START_ROW;
    const headerCell = sheet.getRange(PAST_DATA_START_ROW, 1).getValue();
    if (headerCell && String(headerCell).includes('過去の勤怠データ')) {
      pastDataStartRow = PAST_DATA_START_ROW + 1; // ヘッダーの次の行から
    }
    
    if (lastDataRowPast >= pastDataStartRow) {
      const pastRange = sheet.getRange(pastDataStartRow, 1, lastDataRowPast - pastDataStartRow + 1, 9);
      pastValues = pastRange.getValues();
      Logger.log(`過去セクションのデータ行数: ${pastValues.length} (開始行: ${pastDataStartRow}, 終了行: ${lastDataRowPast})`);
    }
  }
  
  // 今月セクションと過去セクションのデータを結合
  const values = [...currentMonthValues, ...pastValues];
  Logger.log(`今月セクションのデータ行数: ${currentMonthValues.length}, 過去セクションのデータ行数: ${pastValues.length}, 合計: ${values.length}`);
  
  if (values.length === 0) {
    // データがない場合、0で初期化
    sheet.getRange(1, 11).setValue('0:00');
    sheet.getRange(1, 11).setFontWeight('bold').setFontSize(12);
    sheet.getRange(2, 11).setValue('0日');
    sheet.getRange(1, 13).setValue('0日');
    sheet.getRange(2, 13).setValue('0日');
    
    // 先月も0で初期化
    sheet.getRange(1, 16).setValue('0:00');
    sheet.getRange(1, 16).setFontWeight('bold').setFontSize(12);
    sheet.getRange(2, 16).setValue('0日');
    sheet.getRange(1, 18).setValue('0日');
    sheet.getRange(2, 18).setValue('0日');
    return;
  }

  // 3:00am基準で現在の年月を取得
  const todayDateStr = getTodayDate(); // 3:00am基準の今日の日付文字列（YYYY-MM-DD）
  const todayDate = new Date(todayDateStr + 'T00:00:00+09:00'); // 日本時間として解釈
  const currentYearStr = Utilities.formatDate(todayDate, 'Asia/Tokyo', 'yyyy');
  const currentMonthStr = Utilities.formatDate(todayDate, 'Asia/Tokyo', 'MM');
  const currentYear = parseInt(currentYearStr);
  const currentMonthNum = parseInt(currentMonthStr);
  const currentMonthKey = `${currentYear}/${String(currentMonthNum).padStart(2, '0')}`;
  
  // 月ごとに集計
  const monthlySummary = {};
  let lastSeenMonth = '';
  let processedRows = 0;
  let isPastSection = false; // 過去セクションかどうかのフラグ

  values.forEach((row, index) => {
    // 今月セクションと過去セクションの境界を検出
    if (index === currentMonthValues.length) {
      isPastSection = true;
      Logger.log(`過去セクションの開始を検出: 行${index + 4}`);
      // 過去セクションでは、月ヘッダー行から月を取得する必要がある
      lastSeenMonth = ''; // 過去セクションでは月ヘッダーを再検出
    }
    
    // 月列の値を取得
    let monthValue = row[0];
    const dayValue = row[1];
    
    // 月ヘッダー行の検出条件:
    // 1. 月列に「月」が含まれる
    // 2. 日列が空、または「X日」形式（過去セクションの月ヘッダーには合計日数が表示される）
    // 3. 出勤列（2列目）が空（データ行ではない）
    const isMonthHeader = monthValue && String(monthValue).includes('月') && 
                          (!dayValue || String(dayValue).trim() === '' || String(dayValue).includes('日')) &&
                          (!row[2] || String(row[2]).trim() === ''); // 出勤列が空
    
    if (isMonthHeader) {
      // 「11月」のような形式から月を取得
      lastSeenMonth = String(monthValue).replace('月', '');
      Logger.log(`行${index + 4}: 月ヘッダー行を検出: ${lastSeenMonth}月 (過去セクション: ${isPastSection}, 日列: "${dayValue}")`);
      return; // 月ヘッダー行はスキップ（集計には含めない）
    }
    
    // 「合計」を含む行はスキップ
    if (String(row[0] || '').includes('合計') || String(row[1] || '').includes('合計')) return;
    
    // 日列から日を取得（日列が空の行はスキップ）
    if (!dayValue || !String(dayValue).includes('日')) return;
    
    // 月と日から実際の月を特定
    const monthNum = lastSeenMonth ? parseInt(lastSeenMonth) : currentMonthNum;
    
    // 年の判定
    let year = currentYear;
    if (isPastSection) {
      // 過去セクションの場合、月ヘッダーから取得した月を使用
      // 11月のデータが12月に表示される場合、同じ年
      year = currentYear;
    } else {
      // 今月セクションの場合
      if (monthNum > currentMonthNum) {
        // 月が現在の月より大きい場合は前年（例: 1月が現在の12月より大きい）
        year = currentYear - 1;
      }
    }
    
    const monthKey = `${year}/${String(monthNum).padStart(2, '0')}`;
    
    if (isPastSection && lastSeenMonth) {
      Logger.log(`行${index + 4}: 過去セクションのデータ - 月${monthNum}月、キー: ${monthKey}`);
    }

    if (!monthlySummary[monthKey]) {
      monthlySummary[monthKey] = {
        monthLabel: monthNum + '月',
        days: 0,
        totalMinutes: 0,
        remoteDays: 0,
        officeDays: 0
      };
    }

    monthlySummary[monthKey].days++;
    processedRows++;

    // 実働時間を分に変換（7列目：実働、0ベースなのでrow[6]）
    // 列の順序: 0=月, 1=日, 2=出勤, 3=退勤, 4=中抜け, 5=休憩, 6=実働, 7=勤務タイプ, 8=備考
    const workTime = row[6];
    let minutes = 0;
    
    if (workTime) {
      // Googleスプレッドシートが時刻として解釈した場合、Date型になる
      // その場合は、時刻として扱う（例: 0.383333... = 9:12）
      if (workTime instanceof Date) {
        const hours = workTime.getHours();
        const mins = workTime.getMinutes();
        minutes = hours * 60 + mins;
        Logger.log(`行${index + 4}: 実働時間（Date）${hours}:${mins.toString().padStart(2, '0')} -> ${minutes}分`);
      } else if (typeof workTime === 'string') {
        // "9:13"のような形式をパース
        const trimmed = workTime.trim();
        if (trimmed && trimmed !== '-') {
          const parts = trimmed.split(':');
          const hoursPart = parseInt(parts[0] || 0);
          const minsPart = parseInt(parts[1] || 0);
          if (!isNaN(hoursPart) && !isNaN(minsPart)) {
            minutes = hoursPart * 60 + minsPart;
            Logger.log(`行${index + 4}: 実働時間（文字列）"${trimmed}" -> ${minutes}分`);
          }
        }
      } else if (typeof workTime === 'number') {
        // 数値の場合、時刻の小数値（例: 0.383333... = 9:12）の可能性がある
        // または、既に分単位の数値の可能性もある
        // 時刻の小数値の場合: 1日 = 1.0, 9時間12分 = 0.383333...
        if (workTime < 1 && workTime > 0) {
          // 時刻の小数値として扱う
          const totalMinutes = Math.round(workTime * 24 * 60);
          minutes = totalMinutes;
          Logger.log(`行${index + 4}: 実働時間（時刻小数値）${workTime} -> ${minutes}分`);
        } else {
          // 既に分単位の数値として扱う
          minutes = workTime;
          Logger.log(`行${index + 4}: 実働時間（分単位数値）-> ${minutes}分`);
        }
      }
    } else {
      Logger.log(`行${index + 4}: 実働時間が空です。行データ: [${row.map((v, i) => `${i}:${v}`).join(', ')}]`);
    }
    
    monthlySummary[monthKey].totalMinutes += minutes;

    // 勤務タイプを集計（8列目：勤務タイプ、0ベースなのでrow[7]）
    const workType = row[7];
    if (workType && String(workType).includes('リモート')) {
      monthlySummary[monthKey].remoteDays++;
    } else if (workType && String(workType).includes('出社')) {
      monthlySummary[monthKey].officeDays++;
    }
  });
  
  Logger.log(`処理したデータ行数: ${processedRows}`);
  Logger.log(`今月のキー: ${currentMonthKey}`);
  Logger.log(`集計結果: ${JSON.stringify(monthlySummary)}`);

  // 固定セルに今月の合計を書き込み（J列、K列）
  const currentSummary = monthlySummary[currentMonthKey] || { days: 0, totalMinutes: 0, remoteDays: 0, officeDays: 0 };
  const hours = Math.floor(currentSummary.totalMinutes / 60);
  const minutes = currentSummary.totalMinutes % 60;
  // 24時間を超える場合は「XX時間XX分」形式、それ以下は「XX:XX」形式
  const totalTimeFormatted = hours >= 24 
    ? `${hours}時間${minutes}分`
    : `${hours}:${minutes.toString().padStart(2, '0')}`;

  // 固定セルの値を更新（今月）
  sheet.getRange(1, 11).setValue(totalTimeFormatted);
  sheet.getRange(1, 11).setNumberFormat('@'); // プレーンテキストとして表示
  sheet.getRange(1, 11).setFontWeight('bold').setFontSize(12);
  sheet.getRange(2, 11).setValue(currentSummary.days + '日');
  sheet.getRange(1, 13).setValue(currentSummary.remoteDays + '日');
  sheet.getRange(2, 13).setValue(currentSummary.officeDays + '日');

  // 先月のキーを計算（3:00am基準）
  const lastMonthDate = new Date(todayDate);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthYear = lastMonthDate.getFullYear();
  const lastMonthNum = lastMonthDate.getMonth() + 1;
  const lastMonthKey = `${lastMonthYear}/${String(lastMonthNum).padStart(2, '0')}`;
  
  Logger.log(`先月のキー: ${lastMonthKey} (${lastMonthYear}年${lastMonthNum}月)`);

  // 先月のデータを集計（今月セクションと過去セクションの両方から）
  const lastSummary = monthlySummary[lastMonthKey] || { days: 0, totalMinutes: 0, remoteDays: 0, officeDays: 0 };
  Logger.log(`先月の集計結果: ${JSON.stringify(lastSummary)}`);
  const lastHours = Math.floor(lastSummary.totalMinutes / 60);
  const lastMinutes = lastSummary.totalMinutes % 60;
  // 24時間を超える場合は「XX時間XX分」形式、それ以下は「XX:XX」形式
  const lastTotalTimeFormatted = lastHours >= 24 
    ? `${lastHours}時間${lastMinutes}分`
    : `${lastHours}:${lastMinutes.toString().padStart(2, '0')}`;

  sheet.getRange(1, 16).setValue(lastTotalTimeFormatted);
  sheet.getRange(1, 16).setNumberFormat('@'); // プレーンテキストとして表示
  sheet.getRange(1, 16).setFontWeight('bold').setFontSize(12);
  sheet.getRange(2, 16).setValue(lastSummary.days + '日');
  sheet.getRange(1, 18).setValue(lastSummary.remoteDays + '日');
  sheet.getRange(2, 18).setValue(lastSummary.officeDays + '日');
  
  // 月別集計は下には追加しない（ヘッダーの今月/先月合計のみ）
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
 * ダッシュボードシートを更新
 */
function updateDashboard() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName('ダッシュボード');

  if (!sheet) {
    sheet = spreadsheet.insertSheet('ダッシュボード', 0); // 最初のシートとして作成
    createDashboardHeader(sheet);
  }

  // 最終更新日時を更新
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  sheet.getRange(2, 1).setValue('最終更新: ' + dateStr);

  // 既存データをクリア（ヘッダーは残す）
  const lastRow = sheet.getLastRow();
  if (lastRow > 3) {
    sheet.getRange(4, 1, lastRow - 3, 8).clearContent();
  }

  // 全ユーザーの今月のデータを取得
  const allAttendances = fetchMonthlyAttendanceData();
  
  // 今月のTODOデータを取得（3:00am基準の日付を使用）
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayStr = Utilities.formatDate(firstDay, 'Asia/Tokyo', 'yyyy-MM-dd');
  const todayStr = getTodayDate(); // 3:00am基準の今日の日付
  const allTodoData = fetchTodoDataRange(firstDayStr, todayStr);

  // ユーザーごとに集計
  const userSummary = {};

  allAttendances.forEach(record => {
    const userId = record.user_id;

    if (!userSummary[userId]) {
      userSummary[userId] = {
        name: record.user_name,
        department: record.department || '未設定',
        days: 0,
        totalMinutes: 0,
        lateCount: 0,
        remoteDays: 0,
        officeDays: 0,
        todoTotal: 0,
        todoCompleted: 0
      };
    }

    userSummary[userId].days++;
    // fetchMonthlyAttendanceData()はwork_minutesを返すので、それを使用
    userSummary[userId].totalMinutes += record.work_minutes || 0;

    // リモート/出社を集計
    if (record.work_type === 'remote') {
      userSummary[userId].remoteDays++;
    } else if (record.work_type === 'office') {
      userSummary[userId].officeDays++;
    }

    // 9:00以降の出勤を遅刻としてカウント
    if (record.clock_in) {
      const clockInTime = new Date(record.clock_in);
      const hour = clockInTime.getHours();
      const minute = clockInTime.getMinutes();
      if (hour > 9 || (hour === 9 && minute > 0)) {
        userSummary[userId].lateCount++;
      }
    }
  });
  
  // TODOデータを集計
  allTodoData.forEach(function(todo) {
    var userId = todo.user_id;
    if (userSummary[userId]) {
      userSummary[userId].todoTotal += todo.total_tasks;
      userSummary[userId].todoCompleted += todo.completed_tasks;
    }
  });

  // データを書き込み
  let row = 4;
  Object.values(userSummary).forEach(summary => {
    const hours = Math.floor(summary.totalMinutes / 60);
    const minutes = summary.totalMinutes % 60;
    const workTimeFormatted = `${hours}:${minutes.toString().padStart(2, '0')}`;
    const avgMinutes = summary.days > 0 ? Math.floor(summary.totalMinutes / summary.days) : 0;
    const avgHours = Math.floor(avgMinutes / 60);
    const avgMins = avgMinutes % 60;
    const avgFormatted = `${avgHours}:${avgMins.toString().padStart(2, '0')}`;
    
    // TODO達成率を計算
    var todoRate = 0;
    if (summary.todoTotal > 0) {
      todoRate = Math.round((summary.todoCompleted / summary.todoTotal) * 100);
    }
    var todoRateFormatted = summary.todoTotal > 0 ? todoRate + '%' : '-';

    sheet.getRange(row, 1, 1, 8).setValues([[
      summary.name,
      summary.department,
      summary.days,
      summary.remoteDays,
      summary.officeDays,
      workTimeFormatted,
      avgFormatted,
      todoRateFormatted
    ]]);

    // リモート/出社セルに背景色を設定
    sheet.getRange(row, 4).setBackground('#e3f2fd'); // リモート：薄い青
    sheet.getRange(row, 5).setBackground('#e8f5e9'); // 出社：薄い緑

    row++;
  });

  // 中央揃え
  if (row > 4) {
    const dataRange = sheet.getRange(4, 1, row - 4, 8);
    dataRange.setHorizontalAlignment('center');
  }
}

/**
 * ダッシュボードのヘッダーを作成
 */
function createDashboardHeader(sheet) {
  // タイトル
  sheet.getRange(1, 1).setValue('📊 勤怠ダッシュボード');
  sheet.getRange(1, 1).setFontSize(16).setFontWeight('bold');

  // 更新日時
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  sheet.getRange(2, 1).setValue('最終更新: ' + dateStr);

  // ヘッダー行（管理者ページと同じ）
  const headers = ['名前', 'ユニット', '出勤', '🏠リモート', '🏢出社', '合計', '平均', 'TODO'];
  sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(3, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // リモート/出社の列ヘッダーに背景色を設定
  sheet.getRange(3, 4).setBackground('#1976d2'); // リモート：青
  sheet.getRange(3, 5).setBackground('#388e3c'); // 出社：緑

  // 列幅の設定
  sheet.setColumnWidth(1, 120); // 名前
  sheet.setColumnWidth(2, 120); // ユニット
  sheet.setColumnWidth(3, 60);  // 出勤
  sheet.setColumnWidth(4, 80);  // リモート
  sheet.setColumnWidth(5, 80);  // 出社
  sheet.setColumnWidth(6, 80);  // 合計
  sheet.setColumnWidth(7, 80);  // 平均
  sheet.setColumnWidth(8, 80);  // TODO

  sheet.setFrozenRows(3);
}

/**
 * 今月の全勤怠データを取得
 */
function fetchMonthlyAttendanceData() {
  // 3:00am基準で今月の開始日を取得
  const todayDateStr = getTodayDate(); // 3:00am基準の今日の日付文字列（YYYY-MM-DD）
  const todayDate = new Date(todayDateStr + 'T00:00:00+09:00'); // 日本時間として解釈
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth();
  const firstDay = new Date(currentYear, currentMonth, 1);
  const firstDayStr = Utilities.formatDate(firstDay, 'Asia/Tokyo', 'yyyy-MM-dd');
  
  // 今月のデータのみ取得（clock_inが存在するデータ、管理者ダッシュボードと同じ条件）
  const url = `${SUPABASE_URL}/rest/v1/attendances?date=gte.${firstDayStr}&clock_in=not.is.null&select=*,users(name,department)`;

  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());

  return data.map(record => {
    const user = record.users;
    
    // 勤務時間を計算
    let workMinutes = record.total_work_minutes || 0;
    
    // 勤務中（まだ退勤していない）場合は、出勤時刻から現在までの時間を計算
    if (record.clock_in && !record.clock_out && record.status === 'working') {
      const clockIn = new Date(record.clock_in);
      const now = new Date();
      const diffMinutes = Math.floor((now - clockIn) / 60000);
      const breakMinutes = record.break_minutes_used || 0;
      workMinutes = Math.max(0, diffMinutes - breakMinutes);
    }
    
    return {
      user_id: record.user_id,
      user_name: user.name,
      department: user.department,
      date: record.date,
      clock_in: record.clock_in,
      clock_out: record.clock_out,
      work_minutes: workMinutes,
      work_type: record.work_type || ''
    };
  });
}

/**
 * 過去の勤怠データセクションから今月のデータだけを削除（誤って追加されたデータを削除）
 * 11月などの正しい過去データは残します
 */
function clearPastAttendanceData() {
  try {
    Logger.log('=== 過去の勤怠データセクションから今月のデータを削除開始 ===');
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const PAST_DATA_START_ROW = 33; // 過去のデータ開始行
    
    // 3:00am基準で現在の年月を取得
    const todayDateStr = getTodayDate(); // 3:00am基準の今日の日付文字列（YYYY-MM-DD）
    const todayDate = new Date(todayDateStr + 'T00:00:00+09:00'); // 日本時間として解釈
    const currentYearStr = Utilities.formatDate(todayDate, 'Asia/Tokyo', 'yyyy');
    const currentMonthStr = Utilities.formatDate(todayDate, 'Asia/Tokyo', 'MM');
    const currentYear = parseInt(currentYearStr);
    const currentMonth = parseInt(currentMonthStr);
    const currentMonthLabel = currentMonth + '月';
    
    Logger.log(`削除対象: ${currentYear}年${currentMonth}月のデータ`);
    
    // 全シートを取得
    const sheets = spreadsheet.getSheets();
    let clearedCount = 0;
    
    sheets.forEach(sheet => {
      try {
        const sheetName = sheet.getName();
        // システムシート（ダッシュボード、TODO達成率など）はスキップ
        if (sheetName === 'ダッシュボード' || sheetName === 'TODO達成率' || sheetName.indexOf('報告/') === 0) {
          return;
        }
        
        const lastRow = sheet.getLastRow();
        if (lastRow < PAST_DATA_START_ROW) {
          return; // 過去データセクションがない場合はスキップ
        }
        
        // 過去データセクション（33行目以降）から今月のデータを探して削除
        let rowsToDelete = [];
        
        // 下から上に向かって今月のデータを探す
        for (let row = lastRow; row >= PAST_DATA_START_ROW; row--) {
          const monthCell = sheet.getRange(row, 1).getValue();
          const dayCell = sheet.getRange(row, 2).getValue();
          
          // 月ヘッダー行（例: "12月"）をチェック
          if (monthCell && String(monthCell) === currentMonthLabel) {
            // この月グループ全体を削除するため、次の月ヘッダーまたはセクション終端までをマーク
            let groupEndRow = row;
            let groupStartRow = row;
            
            // この月グループの開始行を探す（上に向かって）
            for (let checkRow = row; checkRow >= PAST_DATA_START_ROW; checkRow--) {
              const checkMonthCell = sheet.getRange(checkRow, 1).getValue();
              if (checkMonthCell && String(checkMonthCell) === currentMonthLabel) {
                groupStartRow = checkRow;
              } else if (checkMonthCell && String(checkMonthCell).includes('月') && String(checkMonthCell) !== currentMonthLabel) {
                // 別の月が見つかったら終了
                break;
              }
            }
            
            // この月グループの終了行を探す（下に向かって）
            for (let checkRow = row + 1; checkRow <= lastRow; checkRow++) {
              const checkMonthCell = sheet.getRange(checkRow, 1).getValue();
              if (checkMonthCell && String(checkMonthCell).includes('月') && String(checkMonthCell) !== currentMonthLabel) {
                // 別の月が見つかったら終了
                groupEndRow = checkRow - 1;
                break;
              }
              if (checkRow === lastRow) {
                groupEndRow = lastRow;
              }
            }
            
            // 削除対象の行を記録（重複を避けるためSetを使用）
            for (let delRow = groupStartRow; delRow <= groupEndRow; delRow++) {
              if (!rowsToDelete.includes(delRow)) {
                rowsToDelete.push(delRow);
              }
            }
            
            // この月グループを処理したので、次のチェックはこのグループより上から
            row = groupStartRow - 1;
          }
          
          // データ行で今月の日付かチェック（月ヘッダーがない場合）
          if (dayCell && String(dayCell).includes('日')) {
            // 日付から月を判定するため、前の行の月ヘッダーを探す
            let foundMonth = null;
            for (let checkRow = row; checkRow >= PAST_DATA_START_ROW; checkRow--) {
              const checkMonthCell = sheet.getRange(checkRow, 1).getValue();
              if (checkMonthCell && String(checkMonthCell).includes('月')) {
                foundMonth = String(checkMonthCell);
                break;
              }
            }
            
            // 今月のデータ行の場合、削除対象に追加
            if (foundMonth === currentMonthLabel && !rowsToDelete.includes(row)) {
              rowsToDelete.push(row);
            }
          }
        }
        
        // 削除対象の行を降順でソート（下から削除しないと行番号がずれる）
        rowsToDelete.sort((a, b) => b - a);
        
        // 行を削除
        rowsToDelete.forEach(rowNum => {
          sheet.deleteRow(rowNum);
          clearedCount++;
        });
        
        if (rowsToDelete.length > 0) {
          Logger.log(`シート「${sheetName}」から${rowsToDelete.length}行の今月データを削除しました`);
        }
      } catch (error) {
        Logger.log(`シート「${sheet.getName()}」の処理でエラー: ${error.message}`);
      }
    });
    
    Logger.log(`=== 削除完了: 合計${clearedCount}行を削除しました ===`);
    Logger.log('次に rebuildAllSheets() を実行して、正しいデータを再構築してください');
    
  } catch (error) {
    Logger.log('エラーが発生しました: ' + error.message);
    throw error;
  }
}

/**
 * TODO達成率シートを更新（ユーザー×月でまとめた形式）
 */
function updateTodoAchievementSheet(date) {
  // 日次追加は行わず、rebuildTodoAchievementSheetで一括更新する
  // 日次実行時は何もしない（rebuildAllSheetsで更新される）
}

/**
 * TODO達成率シートを完全に再構築
 */
function rebuildTodoAchievementSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName('TODO達成率');

  if (!sheet) {
    sheet = spreadsheet.insertSheet('TODO達成率', 1);
  }
  
  // シートをクリア
  sheet.clear();
  
  // ヘッダーを作成
  createTodoAchievementHeader(sheet);

  // 今月のTODOデータを取得
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayStr = Utilities.formatDate(firstDay, 'Asia/Tokyo', 'yyyy-MM-dd');
  const todayStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');
  
  // 今月の全TODOデータを取得
  const url = `${SUPABASE_URL}/rest/v1/todo_lists?date=gte.${firstDayStr}&date=lte.${todayStr}&select=*,users(id,name,department),todo_items(is_completed)&order=date.desc`;
  
  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());

  if (!data || data.length === 0) {
    Logger.log('TODOデータがありません');
    return;
  }

  // ユーザーごとに集計
  const userSummary = {};
  const dailyData = [];

  data.forEach(list => {
    const items = list.todo_items || [];
    const totalTasks = items.length;
    const completedTasks = items.filter(item => item.is_completed).length;
    const achievementRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const userId = list.users.id;
    const userName = list.users.name;
    const department = list.users.department || '未設定';

    // 日別データ
    dailyData.push({
      date: list.date,
      user_name: userName,
      department: department,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      achievement_rate: achievementRate
    });

    // ユーザーサマリー
    if (!userSummary[userId]) {
      userSummary[userId] = {
        name: userName,
        department: department,
        totalTasks: 0,
        completedTasks: 0,
        days: 0
      };
    }
    userSummary[userId].totalTasks += totalTasks;
    userSummary[userId].completedTasks += completedTasks;
    userSummary[userId].days++;
  });

  // ユーザーサマリーを書き込み（上部に）
  let row = 4;
  
  // サマリーセクション
  sheet.getRange(row, 1).setValue('📊 今月のサマリー');
  sheet.getRange(row, 1, 1, 6).setFontWeight('bold').setBackground('#e8f5e9');
  row++;

  Object.values(userSummary)
    .sort((a, b) => {
      const rateA = a.totalTasks > 0 ? a.completedTasks / a.totalTasks : 0;
      const rateB = b.totalTasks > 0 ? b.completedTasks / b.totalTasks : 0;
      return rateB - rateA; // 達成率降順
    })
    .forEach(summary => {
      const rate = summary.totalTasks > 0 ? Math.round((summary.completedTasks / summary.totalTasks) * 100) : 0;
      
      sheet.getRange(row, 1, 1, 6).setValues([[
        summary.name,
        summary.department,
        summary.totalTasks,
        summary.completedTasks,
        rate + '%',
        rate >= 80 ? '🎉' : rate >= 50 ? '👍' : '📝'
      ]]);

      // 達成率に応じて背景色
      if (rate === 100) {
        sheet.getRange(row, 5).setBackground('#d4edda');
      } else if (rate >= 80) {
        sheet.getRange(row, 5).setBackground('#fff3cd');
      } else if (rate < 50) {
        sheet.getRange(row, 5).setBackground('#f8d7da');
      }
      row++;
    });

  // 区切り線
  row++;
  sheet.getRange(row, 1).setValue('📅 日別詳細');
  sheet.getRange(row, 1, 1, 6).setFontWeight('bold').setBackground('#e3f2fd');
  row++;

  // 日別データを書き込み（新しい日付が上）
  let lastDate = '';
  dailyData.forEach(data => {
    // 日付が変わったら区切り
    if (data.date !== lastDate) {
      const dateObj = new Date(data.date);
      const dateFormatted = Utilities.formatDate(dateObj, 'Asia/Tokyo', 'M/d (E)');
      sheet.getRange(row, 1).setValue(dateFormatted);
      sheet.getRange(row, 1).setFontWeight('bold').setBackground('#f5f5f5');
      lastDate = data.date;
    } else {
      sheet.getRange(row, 1).setValue('');
    }

    sheet.getRange(row, 2, 1, 5).setValues([[
      data.user_name,
      data.total_tasks,
      data.completed_tasks,
      data.achievement_rate + '%',
      data.achievement_rate >= 80 ? '🎉' : data.achievement_rate >= 50 ? '👍' : '📝'
    ]]);

    // 達成率に応じて背景色
    if (data.achievement_rate === 100) {
      sheet.getRange(row, 5).setBackground('#d4edda');
    } else if (data.achievement_rate >= 80) {
      sheet.getRange(row, 5).setBackground('#fff3cd');
    } else if (data.achievement_rate < 50) {
      sheet.getRange(row, 5).setBackground('#f8d7da');
    }
    row++;
  });
}

/**
 * TODO達成率シートのヘッダーを作成
 */
function createTodoAchievementHeader(sheet) {
  // タイトル
  sheet.getRange(1, 1).setValue('✅ TODO達成率');
  sheet.getRange(1, 1).setFontSize(16).setFontWeight('bold');

  // 最終更新日
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  sheet.getRange(2, 1).setValue('最終更新: ' + dateStr);

  // ヘッダー行
  const headers = ['日付/名前', '名前/部署', 'タスク総数', '完了数', '達成率', 'ステータス'];
  sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(3, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#34a853')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // 列幅の設定
  sheet.setColumnWidth(1, 100); // 日付/名前
  sheet.setColumnWidth(2, 120); // 名前/部署
  sheet.setColumnWidth(3, 80);  // タスク総数
  sheet.setColumnWidth(4, 80);  // 完了数
  sheet.setColumnWidth(5, 80);  // 達成率
  sheet.setColumnWidth(6, 80);  // ステータス

  sheet.setFrozenRows(3);
}

/**
 * 期間指定でTODOデータを取得
 */
function fetchTodoDataRange(startDate, endDate) {
  const url = `${SUPABASE_URL}/rest/v1/todo_lists?date=gte.${startDate}&date=lte.${endDate}&select=*,users(id,name),todo_items(is_completed)`;

  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());

  return data.map(list => {
    const items = list.todo_items || [];
    const totalTasks = items.length;
    const completedTasks = items.filter(item => item.is_completed).length;

    return {
      user_id: list.users.id,
      user_name: list.users.name,
      total_tasks: totalTasks,
      completed_tasks: completedTasks
    };
  });
}

/**
 * TODOデータを取得
 */
function fetchTodoData(date) {
  const url = `${SUPABASE_URL}/rest/v1/todo_lists?date=eq.${date}&select=*,users(name),todo_items(is_completed)`;

  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());

  return data.map(list => {
    const items = list.todo_items || [];
    const totalTasks = items.length;
    const completedTasks = items.filter(item => item.is_completed).length;
    const achievementRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      date: list.date,
      user_name: list.users.name,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      achievement_rate: achievementRate
    };
  });
}

/**
 * テスト実行用関数
 */
function testExport() {
  exportDailyAttendance();
}

/**
 * 全シートを一括更新（既存データをすべてクリーンアップして再構築）
 * ※ 手動実行用 - 全ユーザーの全期間のデータを再取得して書き直します
 * 
 * レイアウト:
 * - 行1-2: ヘッダー（名前、今月合計、先月合計）
 * - 行3: 列ヘッダー
 * - 行4-32: 今月のデータ（新しい日が上）
 * - 行33〜: 先月より前のデータ（グループ化して折りたたみ）
 */
function rebuildAllSheets() {
  try {
    Logger.log('=== 全シート一括更新を開始 ===');
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const PAST_DATA_START_ROW = 33; // 先月より前のデータ開始行
    
    // 全勤怠データを取得（期間指定なし、completedのみ）
    const allAttendances = fetchAllAttendanceData();
    
    if (!allAttendances || allAttendances.length === 0) {
      Logger.log('勤怠データがありません');
      return;
    }
    
    Logger.log('取得したデータ件数: ' + allAttendances.length);
    
    // 3:00am基準で現在の年月を取得
    const todayDateStr = getTodayDate(); // 3:00am基準の今日の日付文字列（YYYY-MM-DD）
    const todayDate = new Date(todayDateStr + 'T00:00:00+09:00'); // 日本時間として解釈
    const currentYearStr = Utilities.formatDate(todayDate, 'Asia/Tokyo', 'yyyy');
    const currentMonthStr = Utilities.formatDate(todayDate, 'Asia/Tokyo', 'MM');
    const currentYear = parseInt(currentYearStr);
    const currentMonth = parseInt(currentMonthStr);
    
    Logger.log(`3:00am基準の現在年月: ${currentYear}年${currentMonth}月`);
    
    // ユーザーごとにグループ化
    const userAttendances = {};
    allAttendances.forEach(record => {
      if (!userAttendances[record.user_name]) {
        userAttendances[record.user_name] = {
          employee_id: record.employee_id,
          currentMonthRecords: [],  // 今月のデータ
          pastRecords: []           // 先月より前のデータ
        };
      }
      
      // 日付から年月を取得（3:00am基準で判定）
      // record.dateは既に3:00am基準で保存されているので、そのまま使用
      const recordDate = new Date(record.date + 'T00:00:00+09:00'); // 日本時間として解釈
      const recordYearStr = Utilities.formatDate(recordDate, 'Asia/Tokyo', 'yyyy');
      const recordMonthStr = Utilities.formatDate(recordDate, 'Asia/Tokyo', 'MM');
      const recordYear = parseInt(recordYearStr);
      const recordMonth = parseInt(recordMonthStr);
      
      // 今月かどうかを判定（3:00am基準）
      if (recordYear === currentYear && recordMonth === currentMonth) {
        userAttendances[record.user_name].currentMonthRecords.push(record);
      } else {
        userAttendances[record.user_name].pastRecords.push(record);
      }
    });
    
    Logger.log('ユーザー数: ' + Object.keys(userAttendances).length);
    
    // 各ユーザーのシートを再構築
    Object.keys(userAttendances).forEach(userName => {
      try {
        Logger.log('処理中: ' + userName);
        
        const userData = userAttendances[userName];
        let sheet = spreadsheet.getSheetByName(userName);
        
        // シートを削除して再作成（グループ設定もクリアされる）
        if (sheet) {
          spreadsheet.deleteSheet(sheet);
        }
        sheet = spreadsheet.insertSheet(userName);
        createSheetHeader(sheet, userName, userData.employee_id);
        
        // === 今月のデータを書き込み（行4から、日付昇順：1日→2日→3日...） ===
        userData.currentMonthRecords.sort((a, b) => a.date.localeCompare(b.date)); // 昇順
        
        let row = 4;
        let prevMonth = '';
        
        // 今月ヘッダー（動的に月名を生成）
        if (userData.currentMonthRecords.length > 0) {
          const currentMonthLabel = currentMonth + '月'; // 動的に月名を生成
          sheet.getRange(row, 1).setValue(currentMonthLabel);
          sheet.getRange(row, 1).setFontWeight('bold').setBackground('#e8f5e9');
          row++;
        }
        
        userData.currentMonthRecords.forEach(record => {
          prevMonth = writeAttendanceRowSimple(sheet, row, record);
          row++;
        });
        
        // === 先月より前のデータを書き込み（行33から、月ごとにグループ化） ===
        if (userData.pastRecords.length > 0) {
          // 過去データを降順でソート（新しい月が上）
          userData.pastRecords.sort((a, b) => b.date.localeCompare(a.date));
          
          // 月ごとの集計を事前に計算
          const monthSummaries = {};
          userData.pastRecords.forEach(record => {
            const recordDate = new Date(record.date);
            const monthKey = (recordDate.getMonth() + 1) + '月';
            
            if (!monthSummaries[monthKey]) {
              monthSummaries[monthKey] = { days: 0, totalMinutes: 0, remoteDays: 0, officeDays: 0 };
            }
            monthSummaries[monthKey].days++;
            monthSummaries[monthKey].totalMinutes += record.work_minutes || 0;
            if (record.work_type === 'remote') monthSummaries[monthKey].remoteDays++;
            if (record.work_type === 'office') monthSummaries[monthKey].officeDays++;
          });
          
          row = PAST_DATA_START_ROW;
          
          // 過去データセクションのヘッダー
          sheet.getRange(row, 1).setValue('📁 過去の勤怠データ');
          sheet.getRange(row, 1, 1, 8).setFontWeight('bold').setBackground('#f5f5f5');
          row++;
          
          let currentGroupMonth = '';
          let groupStartRow = row;
          const monthGroups = [];
          
          userData.pastRecords.forEach(record => {
            const recordDate = new Date(record.date);
            const recordMonthLabel = (recordDate.getMonth() + 1) + '月';
            
            // 月が変わったら記録
            if (recordMonthLabel !== currentGroupMonth) {
              if (currentGroupMonth !== '') {
                monthGroups.push({ month: currentGroupMonth, startRow: groupStartRow, endRow: row - 1 });
              }
              currentGroupMonth = recordMonthLabel;
              groupStartRow = row;
              
              // 月ヘッダーに合計情報を表示
              const summary = monthSummaries[recordMonthLabel] || { days: 0, totalMinutes: 0, remoteDays: 0, officeDays: 0 };
              const h = Math.floor(summary.totalMinutes / 60);
              const m = summary.totalMinutes % 60;
              const timeStr = `${h}時間${m}分`;
              
              sheet.getRange(row, 1).setValue(recordMonthLabel);
              sheet.getRange(row, 2).setValue(summary.days + '日');
              sheet.getRange(row, 6).setValue(timeStr);
              sheet.getRange(row, 7).setValue(`🏠${summary.remoteDays} / 🏢${summary.officeDays}`);
              sheet.getRange(row, 1, 1, 8).setFontWeight('bold').setBackground('#fff3e0');
              row++;
            }
            
            writeAttendanceRowSimple(sheet, row, record);
            row++;
          });
          
          // 最後の月グループを追加
          if (currentGroupMonth !== '') {
            monthGroups.push({ month: currentGroupMonth, startRow: groupStartRow, endRow: row - 1 });
          }
          
          // 過去データをグループ化して折りたたむ
          monthGroups.forEach(group => {
            try {
              if (group.endRow > group.startRow) {
                const groupRange = sheet.getRange(group.startRow + 1, 1, group.endRow - group.startRow, 1);
                groupRange.shiftRowGroupDepth(1);
                
                // 折りたたむ
                const rowGroup = sheet.getRowGroup(group.startRow + 1, 1);
                if (rowGroup) {
                  rowGroup.collapse();
                }
              }
            } catch (e) {
              Logger.log('グループ化エラー: ' + e.message);
            }
          });
        }
        
        // 集計を更新（データベースから取得した値を直接使用）
        // 今月の集計
        let currentMonthTotalMinutes = 0;
        let currentMonthRemoteDays = 0;
        let currentMonthOfficeDays = 0;
        userData.currentMonthRecords.forEach(record => {
          // 勤務時間を計算（管理者ダッシュボードと同じロジック）
          let workMinutes = record.work_minutes || 0;
          
          // 勤務中（status === 'working' かつ clock_outがない）の場合のみ、現在時刻までの時間を計算
          if (record.clock_in && !record.clock_out && record.status === 'working') {
            const clockIn = new Date(record.clock_in);
            const now = new Date();
            const diffMinutes = Math.floor((now - clockIn) / 60000);
            const breakMinutes = record.break_minutes || 0;
            workMinutes = Math.max(0, diffMinutes - breakMinutes);
          }
          
          currentMonthTotalMinutes += workMinutes;
          if (record.work_type === 'remote') currentMonthRemoteDays++;
          if (record.work_type === 'office') currentMonthOfficeDays++;
        });
        
        // 先月の集計（先月のデータを過去レコードから取得）
        const lastMonthDate = new Date(todayDate);
        lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
        const lastMonthYear = lastMonthDate.getFullYear();
        const lastMonthNum = lastMonthDate.getMonth() + 1;
        
        let lastMonthTotalMinutes = 0;
        let lastMonthRemoteDays = 0;
        let lastMonthOfficeDays = 0;
        let lastMonthDays = 0;
        userData.pastRecords.forEach(record => {
          const recordDate = new Date(record.date);
          const recordYear = recordDate.getFullYear();
          const recordMonth = recordDate.getMonth() + 1;
          // 年と月の両方が一致する場合のみ集計
          if (recordYear === lastMonthYear && recordMonth === lastMonthNum) {
            // データベースの値をそのまま使用（管理者ダッシュボードと同じ）
            const workMinutes = record.work_minutes || 0;
            
            // デバッグ: 異常に大きな値がある場合はログ出力
            if (workMinutes > 1000) {
              Logger.log(`  警告: ${userName} ${record.date} work_minutes=${workMinutes}, status=${record.status}, clock_out=${record.clock_out}`);
            }
            
            lastMonthTotalMinutes += workMinutes;
            lastMonthDays++;
            if (record.work_type === 'remote') lastMonthRemoteDays++;
            if (record.work_type === 'office') lastMonthOfficeDays++;
          }
        });
        
        // デバッグログ
        Logger.log(`${userName}: 今月=${userData.currentMonthRecords.length}日(${currentMonthTotalMinutes}分), 先月(${lastMonthYear}/${lastMonthNum})=${lastMonthDays}日(${lastMonthTotalMinutes}分)`);
        
        // 今月の合計を書き込み
        const currentHours = Math.floor(currentMonthTotalMinutes / 60);
        const currentMinutes = currentMonthTotalMinutes % 60;
        const currentTimeStr = currentHours >= 24 
          ? `${currentHours}時間${currentMinutes}分`
          : `${currentHours}:${currentMinutes.toString().padStart(2, '0')}`;
        
        sheet.getRange(1, 11).setValue(currentTimeStr);
        sheet.getRange(1, 11).setNumberFormat('@');
        sheet.getRange(1, 11).setFontWeight('bold').setFontSize(12);
        sheet.getRange(2, 11).setValue(userData.currentMonthRecords.length + '日');
        sheet.getRange(1, 13).setValue(currentMonthRemoteDays + '日');
        sheet.getRange(2, 13).setValue(currentMonthOfficeDays + '日');
        
        // 先月の合計を書き込み
        const lastHours = Math.floor(lastMonthTotalMinutes / 60);
        const lastMinutes = lastMonthTotalMinutes % 60;
        const lastTimeStr = lastHours >= 24 
          ? `${lastHours}時間${lastMinutes}分`
          : `${lastHours}:${lastMinutes.toString().padStart(2, '0')}`;
        
        sheet.getRange(1, 16).setValue(lastTimeStr);
        sheet.getRange(1, 16).setNumberFormat('@');
        sheet.getRange(1, 16).setFontWeight('bold').setFontSize(12);
        sheet.getRange(2, 16).setValue(lastMonthDays + '日');
        sheet.getRange(1, 18).setValue(lastMonthRemoteDays + '日');
        sheet.getRange(2, 18).setValue(lastMonthOfficeDays + '日');
        
        Logger.log(userName + ': 今月' + userData.currentMonthRecords.length + '件(' + currentMonthTotalMinutes + '分), 過去' + userData.pastRecords.length + '件 完了');
        
      } catch (error) {
        Logger.log('エラー (' + userName + '): ' + error.message);
      }
    });
    
    // ダッシュボードを更新
    Logger.log('ダッシュボードを更新中...');
    
    // ダッシュボードシートをリセット
    let dashboardSheet = spreadsheet.getSheetByName('ダッシュボード');
    if (dashboardSheet) {
      const lastRow = dashboardSheet.getLastRow();
      if (lastRow > 3) {
        dashboardSheet.getRange(4, 1, lastRow - 3, 10).clearContent();
      }
    }
    
    updateDashboard();
    
    // TODO達成率シートを更新
    Logger.log('TODO達成率シートを更新中...');
    rebuildTodoAchievementSheet();
    
    Logger.log('=== 全シート一括更新が完了しました ===');
    
  } catch (error) {
    Logger.log('エラーが発生しました: ' + error.message);
    throw error;
  }
}

/**
 * 勤怠データを1行書き込む（シンプル版：月列なし、日のみ）
 */
function writeAttendanceRowSimple(sheet, row, attendance) {
  const date = new Date(attendance.date);
  const dayFormatted = date.getDate() + '日';
  
  const clockInTime = formatTimeOnly(attendance.clock_in);
  const clockOutTime = formatTimeOnly(attendance.clock_out);
  
  // 中抜け情報のフォーマット
  let breakSessionsFormatted = '-';
  if (attendance.break_sessions && attendance.break_sessions.length > 0) {
    const sessions = attendance.break_sessions
      .filter(session => session.start) // 開始時刻があるもののみ
      .map(session => {
        const startTime = formatTimeOnly(session.start);
        const endTime = session.end ? formatTimeOnly(session.end) : '中抜け中';
        return `${startTime}-${endTime}`;
      });
    
    if (sessions.length > 0) {
      breakSessionsFormatted = sessions.join(' / ');
    }
  }
  
  const breakHours = Math.floor(attendance.break_minutes / 60);
  const breakMins = attendance.break_minutes % 60;
  const breakFormatted = `${breakHours}:${breakMins.toString().padStart(2, '0')}`;
  
  const workHours = Math.floor(attendance.work_minutes / 60);
  const workMins = attendance.work_minutes % 60;
  const workFormatted = `${workHours}:${workMins.toString().padStart(2, '0')}`;
  
  let workTypeFormatted = '';
  if (attendance.work_type === 'remote') {
    workTypeFormatted = '🏠 リモート';
  } else if (attendance.work_type === 'office') {
    workTypeFormatted = '🏢 出社';
  }
  
  // 9列で書き込み（中抜け列を含む）
  sheet.getRange(row, 1, 1, 9).setValues([[
    '',  // 月列は空（ヘッダーで表示済み）
    dayFormatted,
    clockInTime,
    clockOutTime,
    breakSessionsFormatted,  // 中抜け列を追加
    breakFormatted,
    workFormatted,
    workTypeFormatted,
    attendance.notes
  ]]);
  
  if (attendance.work_type === 'remote') {
    sheet.getRange(row, 8).setBackground('#e3f2fd'); // 8列目（勤務タイプ）
  } else if (attendance.work_type === 'office') {
    sheet.getRange(row, 8).setBackground('#e8f5e9'); // 8列目（勤務タイプ）
  }
  
  return (date.getMonth() + 1) + '月';
}

/**
 * 全期間の勤怠データを取得
 */
function fetchAllAttendanceData() {
  // clock_inが存在するすべてのデータを取得（管理者ダッシュボードと同じ条件）
  const url = `${SUPABASE_URL}/rest/v1/attendances?clock_in=not.is.null&select=*,users(*)&order=date.asc`;
  
  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
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
  
  return data.map(record => {
    const user = record.users;
    return {
      user_id: record.user_id,
      user_name: user.name,
      employee_id: user.employee_id,
      date: record.date,
      clock_in: record.clock_in,
      clock_out: record.clock_out,
      status: record.status || '',
      break_minutes: record.break_minutes_used || 0,
      work_minutes: record.total_work_minutes || 0,
      work_type: record.work_type || '',
      notes: record.notes || ''
    };
  });
}

/**
 * シートのヘッダーを必要に応じて更新（新形式: 月と日を分離）
 */
function updateSheetHeaderIfNeeded(sheet, userName, employeeId) {
  // 新形式のヘッダーに更新
  const headers = ['月', '日', '出勤', '退勤', '休憩', '実働', '勤務タイプ', '備考'];
  sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(3, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');
  
  // 古いヘッダー（I列、9列目）をクリア
  sheet.getRange(1, 9, 2, 1).clearContent();
  sheet.getRange(1, 9, 2, 1).clearFormat();
  
  // 列幅の設定
  sheet.setColumnWidth(1, 60);  // 月
  sheet.setColumnWidth(2, 50);  // 日
  sheet.setColumnWidth(3, 60);  // 出勤
  sheet.setColumnWidth(4, 60);  // 退勤
  sheet.setColumnWidth(5, 50);  // 休憩
  sheet.setColumnWidth(6, 60);  // 実働
  sheet.setColumnWidth(7, 100); // 勤務タイプ
  sheet.setColumnWidth(8, 150); // 備考
  
  // 今月合計セクション（J列）
  sheet.getRange(1, 10).setValue('📊 今月合計');
  sheet.getRange(1, 10).setFontWeight('bold').setBackground('#e8f0fe');
  sheet.getRange(1, 11).setValue('0:00');
  sheet.getRange(1, 11).setFontWeight('bold').setFontSize(12);
  
  sheet.getRange(2, 10).setValue('出勤日数');
  sheet.getRange(2, 10).setFontWeight('bold').setBackground('#e8f0fe');
  sheet.getRange(2, 11).setValue('0日');

  sheet.getRange(1, 12).setValue('🏠 リモート');
  sheet.getRange(1, 12).setFontWeight('bold').setBackground('#e3f2fd');
  sheet.getRange(1, 13).setValue('0日');
  
  sheet.getRange(2, 12).setValue('🏢 出社');
  sheet.getRange(2, 12).setFontWeight('bold').setBackground('#e8f5e9');
  sheet.getRange(2, 13).setValue('0日');
  
  // 先月合計セクション（O列）
  sheet.getRange(1, 15).setValue('📅 先月合計');
  sheet.getRange(1, 15).setFontWeight('bold').setBackground('#fff3e0');
  sheet.getRange(1, 16).setValue('0:00');
  sheet.getRange(1, 16).setFontWeight('bold').setFontSize(12);
  
  sheet.getRange(2, 15).setValue('出勤日数');
  sheet.getRange(2, 15).setFontWeight('bold').setBackground('#fff3e0');
  sheet.getRange(2, 16).setValue('0日');

  sheet.getRange(1, 17).setValue('🏠 リモート');
  sheet.getRange(1, 17).setFontWeight('bold').setBackground('#e3f2fd');
  sheet.getRange(1, 18).setValue('0日');
  
  sheet.getRange(2, 17).setValue('🏢 出社');
  sheet.getRange(2, 17).setFontWeight('bold').setBackground('#e8f5e9');
  sheet.getRange(2, 18).setValue('0日');
  
  // 列幅の設定
  sheet.setColumnWidth(10, 100); // 今月合計ラベル
  sheet.setColumnWidth(11, 80);  // 今月合計値
  sheet.setColumnWidth(12, 100); // 今月リモート/出社ラベル
  sheet.setColumnWidth(13, 60);  // 今月リモート/出社値
  sheet.setColumnWidth(14, 20);  // 区切り
  sheet.setColumnWidth(15, 100); // 先月合計ラベル
  sheet.setColumnWidth(16, 80);  // 先月合計値
  sheet.setColumnWidth(17, 100); // 先月リモート/出社ラベル
  sheet.setColumnWidth(18, 60);  // 先月リモート/出社値
}

/**
 * 月ごとにグループ化を適用（今月以外は折りたたみ）
 */
function applyMonthGrouping(sheet, monthStartRows, lastDataRow) {
  if (monthStartRows.length <= 1) return; // 1ヶ月分しかない場合はスキップ
  
  // 現在の月を取得
  const now = new Date();
  const currentMonth = (now.getMonth() + 1) + '月';
  
  // 既存のグループをクリア
  try {
    const maxRow = sheet.getMaxRows();
    if (maxRow > 4) {
      for (let i = 4; i <= Math.min(maxRow, lastDataRow); i++) {
        try {
          sheet.getRange(i, 1).shiftRowGroupDepth(-1);
        } catch (e) {
          // グループがない場合は無視
        }
      }
    }
  } catch (e) {
    // エラーは無視
  }
  
  // 各月のデータ行をグループ化
  const groupsToCollapse = [];
  
  for (let i = 0; i < monthStartRows.length; i++) {
    const monthInfo = monthStartRows[i];
    const startRow = monthInfo.startRow;
    const endRow = (i < monthStartRows.length - 1) ? monthStartRows[i + 1].startRow - 1 : lastDataRow;
    
    if (endRow > startRow) {
      try {
        // 月の開始行以外をグループ化（開始行は見出しとして残す）
        const groupRange = sheet.getRange(startRow + 1, 1, endRow - startRow, 1);
        groupRange.shiftRowGroupDepth(1);
        
        // 今月以外は折りたたむリストに追加
        if (monthInfo.month !== currentMonth) {
          groupsToCollapse.push(startRow + 1);
        }
      } catch (e) {
        Logger.log('グループ化エラー: ' + e.message);
      }
    }
  }
  
  // 今月以外のグループを折りたたむ
  groupsToCollapse.forEach(rowIndex => {
    try {
      const group = sheet.getRowGroup(rowIndex, 1);
      if (group) {
        group.collapse();
      }
    } catch (e) {
      Logger.log('折りたたみエラー: ' + e.message);
    }
  });
  
  // 今月のグループは展開（念のため）
  monthStartRows.forEach(monthInfo => {
    if (monthInfo.month === currentMonth) {
      try {
        const group = sheet.getRowGroup(monthInfo.startRow + 1, 1);
        if (group) {
          group.expand();
        }
      } catch (e) {
        // 展開できない場合は無視
      }
    }
  });
}

/**
 * 勤怠データを1行書き込む（月と日を分離、前の行と比較して月表示を制御）
 */
function writeAttendanceRow(sheet, row, attendance, prevMonth) {
  // 日付のフォーマット
  const date = new Date(attendance.date);
  const monthFormatted = (date.getMonth() + 1) + '月';
  const dayFormatted = date.getDate() + '日';
  
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
  
  // 勤務タイプのフォーマット
  let workTypeFormatted = '';
  if (attendance.work_type === 'remote') {
    workTypeFormatted = '🏠 リモート';
  } else if (attendance.work_type === 'office') {
    workTypeFormatted = '🏢 出社';
  }
  
  // 前の行と同じ月かチェック（同じ月なら月列は空白）
  const displayMonth = (prevMonth === monthFormatted) ? '' : monthFormatted;
  
  // データを書き込み（月と日を分離）
  sheet.getRange(row, 1, 1, 8).setValues([[
    displayMonth,
    dayFormatted,
    clockInTime,
    clockOutTime,
    breakFormatted,
    workFormatted,
    workTypeFormatted,
    attendance.notes
  ]]);
  
  // 勤務タイプに応じて背景色を設定
  if (attendance.work_type === 'remote') {
    sheet.getRange(row, 7).setBackground('#e3f2fd');
  } else if (attendance.work_type === 'office') {
    sheet.getRange(row, 7).setBackground('#e8f5e9');
  }
  
  // 月が変わった行は背景色を設定して目立たせる
  if (displayMonth !== '') {
    sheet.getRange(row, 1).setFontWeight('bold').setBackground('#fff3e0');
  }
  
  return monthFormatted; // 次の行で比較用に返す
}

/**
 * 特定の日付でテスト実行
 */
function testExportSpecificDate() {
  var testDate = '2025-11-11'; // テスト用の日付
  Logger.log('テスト実行: ' + testDate);
  
  var attendances = fetchAttendanceData(testDate);
  Logger.log('取得データ件数: ' + attendances.length);
  
  if (attendances.length > 0) {
    attendances.forEach(function(attendance) {
      writeToUserSheet(attendance);
    });
    updateDashboard();
    updateTodoAchievementSheet(testDate);
    Logger.log('テスト完了！');
  }
}

/**
 * スプレッドシートから各ユニットの達成率を取得してSupabaseに保存
 */
function syncUnitAchievementRates() {
  try {
    Logger.log('ユニット達成率の同期を開始します');

    // スプレッドシートを開く
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 現在の月に応じてシート名を動的に生成
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const sheetName = `報告/MG粗利${currentMonth}月`;
    
    Logger.log(`シート名を検索: ${sheetName}`);
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log(`シート「${sheetName}」が見つかりません`);
      // 代替として、シート名に「報告/MG粗利」を含むシートを検索
      const allSheets = spreadsheet.getSheets();
      const matchingSheet = allSheets.find(s => s.getName().indexOf('報告/MG粗利') !== -1);
      if (matchingSheet) {
        Logger.log(`代替シート「${matchingSheet.getName()}」を使用します`);
        return syncUnitAchievementRatesFromSheet(matchingSheet, currentMonth, currentYear);
      } else {
        Logger.log('「報告/MG粗利」を含むシートが見つかりません');
        return;
      }
    }
    
    return syncUnitAchievementRatesFromSheet(sheet, currentMonth, currentYear);
  } catch (error) {
    Logger.log('エラーが発生しました: ' + error.message);
    throw error;
  }
}

/**
 * シートからユニット達成率を同期
 */
function syncUnitAchievementRatesFromSheet(sheet, month, year) {
  try {
    // 各ユニットの達成率を取得
    const units = [
      { name: '第1ユニット', cell: 'L17' },
      { name: '第2ユニット', cell: 'L21' },
      { name: '第3ユニット', cell: 'L29' },
      { name: '第5ユニット', cell: 'L37' }
    ];

    const achievementRates = [];

    units.forEach(unit => {
      try {
        const cellValue = sheet.getRange(unit.cell).getValue();
        // パーセンテージを数値に変換（0.85 -> 85）
        const rate = typeof cellValue === 'number' ? Math.round(cellValue * 100) : 0;

        achievementRates.push({
          department: unit.name,
          achievement_rate: rate,
          month: month,
          year: year
        });

        Logger.log(`${unit.name}: ${rate}% (セル: ${unit.cell})`);
      } catch (error) {
        Logger.log(`${unit.name}のセル${unit.cell}の読み取りに失敗: ${error.message}`);
      }
    });

    // Supabaseに保存
    const url = `${SUPABASE_URL}/rest/v1/unit_achievement_rates`;

    achievementRates.forEach(data => {
      // 既存データを削除してから挿入（upsert）
      const deleteUrl = `${url}?department=eq.${encodeURIComponent(data.department)}&year=eq.${data.year}&month=eq.${data.month}`;
      const deleteOptions = {
        method: 'delete',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json'
        },
        muteHttpExceptions: true
      };

      UrlFetchApp.fetch(deleteUrl, deleteOptions);

      // 新しいデータを挿入
      const insertOptions = {
        method: 'post',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        payload: JSON.stringify(data),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, insertOptions);
      const statusCode = response.getResponseCode();

      if (statusCode === 201 || statusCode === 200) {
        Logger.log(`${data.department}の達成率を保存しました`);
      } else {
        Logger.log(`${data.department}の保存に失敗: ${statusCode}`);
      }
    });

    Logger.log('ユニット達成率の同期が完了しました');
  } catch (error) {
    Logger.log('エラーが発生しました: ' + error.message);
  }
}

