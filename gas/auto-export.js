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
  var title = employeeId ? userName + ' (' + employeeId + ')' : userName;
  sheet.getRange(1, 1).setValue(title);
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
    const workTime = row[4]; // "8:30" 形式 または Dateオブジェクト
    if (workTime) {
      let minutes = 0;
      if (typeof workTime === 'string') {
        // 文字列の場合
        const parts = workTime.split(':');
        minutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      } else if (workTime instanceof Date) {
        // Dateオブジェクトの場合
        const hours = workTime.getHours();
        const mins = workTime.getMinutes();
        minutes = hours * 60 + mins;
      }
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
    sheet.getRange(4, 1, lastRow - 3, 7).clearContent();
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
        todoTotal: 0,
        todoCompleted: 0
      };
    }

    userSummary[userId].days++;
    userSummary[userId].totalMinutes += record.work_minutes || 0;

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
      workTimeFormatted,
      avgFormatted,
      summary.lateCount,
      todoRateFormatted,
      summary.lateCount > 0 ? '⚠️' : '✅'
    ]]);

    row++;
  });

  // 条件付き書式（遅刻が多い人を強調）
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

  // ヘッダー行
  const headers = ['名前', '部署', '出勤日数', '合計勤務時間', '平均勤務時間', '遅刻回数', 'TODO達成率', 'ステータス'];
  sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(3, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // 列幅の設定
  sheet.setColumnWidth(1, 120); // 名前
  sheet.setColumnWidth(2, 100); // 部署
  sheet.setColumnWidth(3, 80);  // 出勤日数
  sheet.setColumnWidth(4, 120); // 合計勤務時間
  sheet.setColumnWidth(5, 120); // 平均勤務時間
  sheet.setColumnWidth(6, 80);  // 遅刻回数
  sheet.setColumnWidth(7, 100); // TODO達成率
  sheet.setColumnWidth(8, 100); // ステータス

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
      work_minutes: record.total_work_minutes || 0
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
