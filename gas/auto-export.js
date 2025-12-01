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
 * メイン関数 - トリガーから実行される
 */
function exportDailyAttendance() {
  try {
    Logger.log('勤怠データの自動出力を開始します');

    // 前日の日付を取得
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 0);
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
  // デバッグ用ログ
  Logger.log('SUPABASE_URL: ' + SUPABASE_URL);
  Logger.log('SUPABASE_SERVICE_KEY: ' + (SUPABASE_SERVICE_KEY ? '設定済み' : 'null'));

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
    return {
      user_id: record.user_id,
      user_name: user.name,
      employee_id: user.employee_id,
      date: record.date,
      clock_in: record.clock_in,
      clock_out: record.clock_out,
      break_minutes: record.break_minutes_used || 0,
      work_minutes: record.total_work_minutes || 0,
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
  }

  // 既存の集計行を削除（「合計」を含む行を探して削除）
  clearSummaryRows(sheet);

  // データ行を追加（集計行を除いた最終行の次）
  const lastRow = findLastDataRow(sheet);
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
  sheet.getRange(newRow, 1, 1, 8).setValues([[
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
    sheet.getRange(newRow, 7).setBackground('#e3f2fd'); // 薄い青
  } else if (attendance.work_type === 'office') {
    sheet.getRange(newRow, 7).setBackground('#e8f5e9'); // 薄い緑
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

  // 月合計セクション（固定位置: J列）
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

  // ヘッダー行（月と日を分離）
  const headers = ['月', '日', '出勤', '退勤', '休憩', '実働', '勤務タイプ', '備考'];
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
  sheet.setColumnWidth(5, 50);  // 休憩
  sheet.setColumnWidth(6, 60);  // 実働
  sheet.setColumnWidth(7, 100); // 勤務タイプ
  sheet.setColumnWidth(8, 150); // 備考
  sheet.setColumnWidth(10, 100); // 月合計ラベル
  sheet.setColumnWidth(11, 80); // 月合計値
  sheet.setColumnWidth(12, 100); // リモート/出社ラベル
  sheet.setColumnWidth(13, 60); // リモート/出社値

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
  
  const lastDataRow = findLastDataRow(sheet);
  if (lastDataRow <= 3) return; // データがない場合

  // データ範囲（4行目からデータ最終行まで、8列：新形式）
  const dataRange = sheet.getRange(4, 1, lastDataRow - 3, 8);
  const values = dataRange.getValues();

  // 月ごとに集計
  const monthlySummary = {};
  const now = new Date();
  const currentMonthNum = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentMonthKey = `${currentYear}/${String(currentMonthNum).padStart(2, '0')}`;
  
  let lastSeenMonth = '';

  values.forEach(row => {
    // 月列の値を取得
    let monthValue = row[0];
    if (monthValue && String(monthValue).includes('月')) {
      // 「11月」のような形式から月を取得
      lastSeenMonth = String(monthValue).replace('月', '');
    }
    
    // 「合計」を含む行はスキップ
    if (String(row[0]).includes('合計') || String(row[1]).includes('合計')) return;
    
    // 日列から日を取得
    const dayValue = row[1];
    if (!dayValue) return;
    
    // 月と日から実際の月を特定
    const monthNum = lastSeenMonth ? parseInt(lastSeenMonth) : currentMonthNum;
    // 年は現在の年を使用（TODO: 年またぎの場合は調整が必要）
    const year = monthNum > currentMonthNum ? currentYear - 1 : currentYear;
    const monthKey = `${year}/${String(monthNum).padStart(2, '0')}`;

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

    // 実働時間を分に変換（6列目：実働）
    const workTime = row[5];
    if (workTime) {
      let minutes = 0;
      if (typeof workTime === 'string') {
        const parts = workTime.split(':');
        minutes = parseInt(parts[0] || 0) * 60 + parseInt(parts[1] || 0);
      } else if (workTime instanceof Date) {
        const hours = workTime.getHours();
        const mins = workTime.getMinutes();
        minutes = hours * 60 + mins;
      }
      monthlySummary[monthKey].totalMinutes += minutes;
    }

    // 勤務タイプを集計（7列目：勤務タイプ）
    const workType = row[6];
    if (workType && String(workType).includes('リモート')) {
      monthlySummary[monthKey].remoteDays++;
    } else if (workType && String(workType).includes('出社')) {
      monthlySummary[monthKey].officeDays++;
    }
  });

  // 固定セルに今月の合計を書き込み（J列、K列）
  const currentSummary = monthlySummary[currentMonthKey] || { days: 0, totalMinutes: 0, remoteDays: 0, officeDays: 0 };
  const hours = Math.floor(currentSummary.totalMinutes / 60);
  const minutes = currentSummary.totalMinutes % 60;
  const totalTimeFormatted = `${hours}:${minutes.toString().padStart(2, '0')}`;

  // 固定セルの値を更新
  sheet.getRange(1, 11).setValue(totalTimeFormatted);
  sheet.getRange(1, 11).setFontWeight('bold').setFontSize(12);
  sheet.getRange(2, 11).setValue(currentSummary.days + '日');
  sheet.getRange(1, 13).setValue(currentSummary.remoteDays + '日');
  sheet.getRange(2, 13).setValue(currentSummary.officeDays + '日');

  // シートの最下部に月別集計を追加（1行空けて）
  let summaryRow = findLastDataRow(sheet) + 2;

  // 月でソート（降順：新しい月が上）
  const sortedMonths = Object.keys(monthlySummary).sort((a, b) => b.localeCompare(a));

  sortedMonths.forEach(monthKey => {
    const summary = monthlySummary[monthKey];
    const h = Math.floor(summary.totalMinutes / 60);
    const m = summary.totalMinutes % 60;

    sheet.getRange(summaryRow, 1).setValue(summary.monthLabel + ' 合計');
    sheet.getRange(summaryRow, 2).setValue(summary.days + '日');
    sheet.getRange(summaryRow, 6).setValue(`${h}時間${m}分`);
    sheet.getRange(summaryRow, 7).setValue(`🏠${summary.remoteDays} / 🏢${summary.officeDays}`);

    sheet.getRange(summaryRow, 1, 1, 8)
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
 * ダッシュボードシートを更新
 */
function updateDashboard() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName('ダッシュボード');

  if (!sheet) {
    sheet = spreadsheet.insertSheet('ダッシュボード', 0); // 最初のシートとして作成
    createDashboardHeader(sheet);
  }

  // 既存データをクリア（ヘッダーは残す）
  const lastRow = sheet.getLastRow();
  if (lastRow > 3) {
    sheet.getRange(4, 1, lastRow - 3, 10).clearContent();
  }

  // 全ユーザーの今月のデータを取得
  const allAttendances = fetchMonthlyAttendanceData();
  
  // 今月のTODOデータを取得
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayStr = Utilities.formatDate(firstDay, 'Asia/Tokyo', 'yyyy-MM-dd');
  const todayStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');
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

    sheet.getRange(row, 1, 1, 10).setValues([[
      summary.name,
      summary.department,
      summary.days,
      workTimeFormatted,
      avgFormatted,
      summary.remoteDays,
      summary.officeDays,
      summary.lateCount,
      todoRateFormatted,
      summary.lateCount > 0 ? '⚠️' : '✅'
    ]]);

    // リモート/出社セルに背景色を設定
    sheet.getRange(row, 6).setBackground('#e3f2fd'); // リモート：薄い青
    sheet.getRange(row, 7).setBackground('#e8f5e9'); // 出社：薄い緑

    row++;
  });

  // 条件付き書式（遅刻が多い人を強調）
  if (row > 4) {
    const dataRange = sheet.getRange(4, 1, row - 4, 10);
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

  // ヘッダー行（リモート/出社を追加）
  const headers = ['名前', '部署', '出勤日数', '合計稼働時間', '平均稼働時間', '🏠リモート', '🏢出社', '遅刻回数', 'TODO達成率', 'ステータス'];
  sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(3, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // リモート/出社の列ヘッダーに背景色を設定
  sheet.getRange(3, 6).setBackground('#1976d2'); // リモート：青
  sheet.getRange(3, 7).setBackground('#388e3c'); // 出社：緑

  // 列幅の設定
  sheet.setColumnWidth(1, 120); // 名前
  sheet.setColumnWidth(2, 100); // 部署
  sheet.setColumnWidth(3, 80);  // 出勤日数
  sheet.setColumnWidth(4, 120); // 合計稼働時間
  sheet.setColumnWidth(5, 120); // 平均稼働時間
  sheet.setColumnWidth(6, 80);  // リモート
  sheet.setColumnWidth(7, 80);  // 出社
  sheet.setColumnWidth(8, 80);  // 遅刻回数
  sheet.setColumnWidth(9, 100); // TODO達成率
  sheet.setColumnWidth(10, 100); // ステータス

  sheet.setFrozenRows(3);
}

/**
 * 今月の全勤怠データを取得
 */
function fetchMonthlyAttendanceData() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayStr = Utilities.formatDate(firstDay, 'Asia/Tokyo', 'yyyy-MM-dd');

  const url = `${SUPABASE_URL}/rest/v1/attendances?date=gte.${firstDayStr}&status=eq.completed&select=*,users(name,department)`;

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
    return {
      user_id: record.user_id,
      user_name: user.name,
      department: user.department,
      date: record.date,
      clock_in: record.clock_in,
      clock_out: record.clock_out,
      work_minutes: record.total_work_minutes || 0,
      work_type: record.work_type || ''
    };
  });
}

/**
 * TODO達成率シートを更新
 */
function updateTodoAchievementSheet(date) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName('TODO達成率');

  if (!sheet) {
    sheet = spreadsheet.insertSheet('TODO達成率', 1);
    createTodoAchievementHeader(sheet);
  }

  // 指定日のTODOデータを取得
  const todoData = fetchTodoData(date);

  if (!todoData || todoData.length === 0) {
    Logger.log('TODOデータがありません');
    return;
  }

  // データを書き込み
  const lastRow = sheet.getLastRow();
  const newRow = lastRow + 1;

  todoData.forEach((data, index) => {
    const row = newRow + index;

    sheet.getRange(row, 1, 1, 6).setValues([[
      data.date,
      data.user_name,
      data.total_tasks,
      data.completed_tasks,
      data.achievement_rate + '%',
      data.achievement_rate >= 80 ? '🎉' : data.achievement_rate >= 50 ? '👍' : '📝'
    ]]);

    // 達成率に応じて背景色を変更
    const achievementCell = sheet.getRange(row, 5);
    if (data.achievement_rate === 100) {
      achievementCell.setBackground('#d4edda'); // 緑
    } else if (data.achievement_rate >= 80) {
      achievementCell.setBackground('#fff3cd'); // 黄色
    } else if (data.achievement_rate < 50) {
      achievementCell.setBackground('#f8d7da'); // 赤
    }
  });
}

/**
 * TODO達成率シートのヘッダーを作成
 */
function createTodoAchievementHeader(sheet) {
  // タイトル
  sheet.getRange(1, 1).setValue('✅ TODO達成率');
  sheet.getRange(1, 1).setFontSize(16).setFontWeight('bold');

  // ヘッダー行
  const headers = ['日付', '名前', 'タスク総数', '完了数', '達成率', 'ステータス'];
  sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(3, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#34a853')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // 列幅の設定
  sheet.setColumnWidth(1, 100); // 日付
  sheet.setColumnWidth(2, 120); // 名前
  sheet.setColumnWidth(3, 100); // タスク総数
  sheet.setColumnWidth(4, 100); // 完了数
  sheet.setColumnWidth(5, 100); // 達成率
  sheet.setColumnWidth(6, 100); // ステータス

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
 */
function rebuildAllSheets() {
  try {
    Logger.log('=== 全シート一括更新を開始 ===');
    
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 全勤怠データを取得（期間指定なし、completedのみ）
    const allAttendances = fetchAllAttendanceData();
    
    if (!allAttendances || allAttendances.length === 0) {
      Logger.log('勤怠データがありません');
      return;
    }
    
    Logger.log('取得したデータ件数: ' + allAttendances.length);
    
    // ユーザーごとにグループ化
    const userAttendances = {};
    allAttendances.forEach(record => {
      if (!userAttendances[record.user_name]) {
        userAttendances[record.user_name] = {
          employee_id: record.employee_id,
          records: []
        };
      }
      userAttendances[record.user_name].records.push(record);
    });
    
    Logger.log('ユーザー数: ' + Object.keys(userAttendances).length);
    
    // 各ユーザーのシートを再構築
    Object.keys(userAttendances).forEach(userName => {
      try {
        Logger.log('処理中: ' + userName);
        
        const userData = userAttendances[userName];
        let sheet = spreadsheet.getSheetByName(userName);
        
        // シートが存在する場合はデータをクリア
        if (sheet) {
          const lastRow = sheet.getLastRow();
          if (lastRow > 3) {
            sheet.getRange(4, 1, lastRow - 3, 12).clearContent();
            sheet.getRange(4, 1, lastRow - 3, 12).clearFormat();
          }
        } else {
          // シートが存在しない場合は新規作成
          sheet = spreadsheet.insertSheet(userName);
          createSheetHeader(sheet, userName, userData.employee_id);
        }
        
        // ヘッダーが古い形式の場合は更新
        updateSheetHeaderIfNeeded(sheet, userName, userData.employee_id);
        
        // レコードを日付順にソート（古い順）
        userData.records.sort((a, b) => a.date.localeCompare(b.date));
        
        // データを書き込み（月ごとにグループ化）
        let row = 4;
        let prevMonth = '';
        let monthStartRows = []; // 各月の開始行を記録
        
        userData.records.forEach(record => {
          const date = new Date(record.date);
          const currentMonth = (date.getMonth() + 1) + '月';
          
          // 月が変わった場合、開始行を記録
          if (currentMonth !== prevMonth) {
            monthStartRows.push({ month: currentMonth, startRow: row });
          }
          
          prevMonth = writeAttendanceRow(sheet, row, record, prevMonth);
          row++;
        });
        
        // 月ごとにグループ化（折りたたみ可能に）
        applyMonthGrouping(sheet, monthStartRows, row - 1);
        
        // 集計を更新
        updateMonthlySummaryFixed(sheet);
        
        Logger.log(userName + ': ' + userData.records.length + '件 完了');
        
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
    
    Logger.log('=== 全シート一括更新が完了しました ===');
    
  } catch (error) {
    Logger.log('エラーが発生しました: ' + error.message);
    throw error;
  }
}

/**
 * 全期間の勤怠データを取得
 */
function fetchAllAttendanceData() {
  const url = `${SUPABASE_URL}/rest/v1/attendances?status=eq.completed&select=*,users(*)&order=date.asc`;
  
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
  
  // 列幅の設定
  sheet.setColumnWidth(1, 60);  // 月
  sheet.setColumnWidth(2, 50);  // 日
  sheet.setColumnWidth(3, 60);  // 出勤
  sheet.setColumnWidth(4, 60);  // 退勤
  sheet.setColumnWidth(5, 50);  // 休憩
  sheet.setColumnWidth(6, 60);  // 実働
  sheet.setColumnWidth(7, 100); // 勤務タイプ
  sheet.setColumnWidth(8, 150); // 備考
  
  // 固定セル（月合計）のヘッダーを更新
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
  
  sheet.setColumnWidth(10, 100);
  sheet.setColumnWidth(11, 80);
  sheet.setColumnWidth(12, 100);
  sheet.setColumnWidth(13, 60);
}

/**
 * 月ごとにグループ化を適用（折りたたみ可能に）
 */
function applyMonthGrouping(sheet, monthStartRows, lastDataRow) {
  if (monthStartRows.length <= 1) return; // 1ヶ月分しかない場合はスキップ
  
  // 既存のグループをクリア
  try {
    const maxRow = sheet.getMaxRows();
    if (maxRow > 4) {
      // グループ深度を取得してクリア
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
  
  // 各月のデータ行をグループ化（最新月以外を折りたたみ可能に）
  for (let i = 0; i < monthStartRows.length; i++) {
    const startRow = monthStartRows[i].startRow;
    const endRow = (i < monthStartRows.length - 1) ? monthStartRows[i + 1].startRow - 1 : lastDataRow;
    
    if (endRow > startRow) {
      try {
        // 月の開始行以外をグループ化（開始行は見出しとして残す）
        const groupRange = sheet.getRange(startRow + 1, 1, endRow - startRow, 1);
        groupRange.shiftRowGroupDepth(1);
      } catch (e) {
        Logger.log('グループ化エラー: ' + e.message);
      }
    }
  }
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
    const sheet = spreadsheet.getSheetByName('報告/MG粗利11月');

    if (!sheet) {
      Logger.log('シート「報告/MG粗利11月」が見つかりません');
      return;
    }

    // 各ユニットの達成率を取得
    const units = [
      { name: '第1ユニット', cell: 'L17' },
      { name: '第2ユニット', cell: 'L21' },
      { name: '第3ユニット', cell: 'L29' },
      { name: '第5ユニット', cell: 'L37' }
    ];

    const achievementRates = [];

    units.forEach(unit => {
      const cellValue = sheet.getRange(unit.cell).getValue();
      // パーセンテージを数値に変換（0.85 -> 85）
      const rate = typeof cellValue === 'number' ? Math.round(cellValue * 100) : 0;

      achievementRates.push({
        department: unit.name,
        achievement_rate: rate,
        month: new Date().getMonth() + 1, // 現在の月
        year: new Date().getFullYear()
      });

      Logger.log(`${unit.name}: ${rate}% (セル: ${unit.cell})`);
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

/**
 * データベース接続テスト用関数
 */
function debugFetchData() {
  Logger.log('=== デバッグ開始 ===');
  
  // 1. すべての勤怠データを取得（日付フィルタなし）
  Logger.log('--- 1. 全勤怠データを取得 ---');
  const allUrl = `${SUPABASE_URL}/rest/v1/attendances?select=*&order=date.desc&limit=10`;
  const allOptions = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  
  const allResponse = UrlFetchApp.fetch(allUrl, allOptions);
  Logger.log('ステータスコード: ' + allResponse.getResponseCode());
  const allData = JSON.parse(allResponse.getContentText());
  Logger.log('データ件数: ' + allData.length);
  if (allData.length > 0) {
    Logger.log('最新のデータ:');
    allData.slice(0, 3).forEach(record => {
      Logger.log('  ID: ' + record.id + ', Date: ' + record.date + ', Status: ' + record.status + ', User ID: ' + record.user_id);
    });
  }
  
  // 2. 今日の日付で検索
  Logger.log('--- 2. 今日の日付で検索 ---')
  const today = new Date();
  const todayString = Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy-MM-dd');
  Logger.log('検索日付: ' + todayString);
  
  const todayUrl = `${SUPABASE_URL}/rest/v1/attendances?date=eq.${todayString}&select=*`;
  const todayResponse = UrlFetchApp.fetch(todayUrl, allOptions);
  const todayData = JSON.parse(todayResponse.getContentText());
  Logger.log('データ件数: ' + todayData.length);
  
  // 3. 昨日の日付で検索
  Logger.log('--- 3. 昨日の日付で検索 ---');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = Utilities.formatDate(yesterday, 'Asia/Tokyo', 'yyyy-MM-dd');
  Logger.log('検索日付: ' + yesterdayString);
  
  const yesterdayUrl = `${SUPABASE_URL}/rest/v1/attendances?date=eq.${yesterdayString}&select=*`;
  const yesterdayResponse = UrlFetchApp.fetch(yesterdayUrl, allOptions);
  const yesterdayData = JSON.parse(yesterdayResponse.getContentText());
  Logger.log('データ件数: ' + yesterdayData.length);
  
  // 4. ステータス別データ件数
  Logger.log('--- 4. ステータス別データ件数 ---');
  ['completed', 'working', 'pending'].forEach(status => {
    const statusUrl = `${SUPABASE_URL}/rest/v1/attendances?status=eq.${status}&select=id`;
    const statusResponse = UrlFetchApp.fetch(statusUrl, allOptions);
    const statusData = JSON.parse(statusResponse.getContentText());
    Logger.log(status + ': ' + statusData.length + '件');
  });
  
  // 5. 2025年のデータで検索
  Logger.log('\n--- 5. 2025-11-11で検索 ---');
  var future2025Url = SUPABASE_URL + '/rest/v1/attendances?date=eq.2025-11-11&select=*';
  var future2025Response = UrlFetchApp.fetch(future2025Url, allOptions);
  var future2025Data = JSON.parse(future2025Response.getContentText());
  Logger.log('データ件数: ' + future2025Data.length);
  if (future2025Data.length > 0) {
    Logger.log('データが見つかりました！');
    future2025Data.forEach(function(record) {
      Logger.log('  Date: ' + record.date + ', Status: ' + record.status + ', Clock In: ' + record.clock_in);
    });
  }
  
  // 6. 全ユーザーを取得
  Logger.log('--- 5. 全ユーザーを取得 ---');
  const usersUrl = `${SUPABASE_URL}/rest/v1/users?select=id,name,email&limit=10`;
  const usersResponse = UrlFetchApp.fetch(usersUrl, allOptions);
  const usersData = JSON.parse(usersResponse.getContentText());
  Logger.log('ユーザー数: ' + usersData.length);
  usersData.forEach(user => {
    Logger.log('  ' + user.name + ' (' + user.email + ')');
  });
  
  Logger.log('=== デバッグ終了 ===');
}
