import { Page, expect } from '@playwright/test';

/**
 * ミニゲームE2Eテスト用ヘルパー関数
 */

// ランダムな名前を生成
export const generateRandomName = () => `Test_${Date.now().toString(36)}`;

// ランダムなイベント名を生成
export const generateEventName = () => `TestEvent_${Date.now().toString(36)}`;

// 管理者としてログイン（認証が必要な場合）
export async function loginAsAdmin(page: Page) {
  // このプロジェクトでは認証はSupabaseで行われているため、
  // テスト用にlocalStorageにセッション情報を設定する必要がある場合がある
  // 現時点では認証なしでアクセスできる想定
  await page.goto('/');
}

// ミニゲーム管理画面に移動
export async function navigateToMinigameAdmin(page: Page) {
  await page.goto('/');
  // ユーザーがis_minigame_adminの場合のみ表示される
  // テストでは認証をバイパスする必要がある場合がある
}

// 参加者画面に移動
export async function navigateToParticipant(page: Page, eventId: string) {
  await page.goto(`/minigame/${eventId}`);
}

// イベントを作成（API直接呼び出し）
export async function createEventViaAPI(page: Page, name: string, description?: string) {
  // Supabaseに直接イベントを作成
  // E2EテストではブラウザコンテキストでlocalStorageを使うので、
  // Supabase JS経由でイベントを作成する
  const result = await page.evaluate(async ({ name, description }) => {
    // Supabaseクライアントを使用してイベント作成
    // グローバルに公開されている場合
    const { createEvent } = await import('/src/features/minigame/utils/event.js');
    return await createEvent(name, description || '');
  }, { name, description });
  return result;
}

// 要素が表示されるのを待つ
export async function waitForElement(page: Page, selector: string, timeout = 10000) {
  await page.waitForSelector(selector, { timeout });
}

// テキストが表示されるのを待つ
export async function waitForText(page: Page, text: string, timeout = 10000) {
  await page.waitForSelector(`text=${text}`, { timeout });
}

// ローディングが終わるのを待つ
export async function waitForLoading(page: Page) {
  // "読み込み中..." テキストが消えるのを待つ
  try {
    await page.waitForSelector('text=読み込み中...', { state: 'hidden', timeout: 10000 });
  } catch {
    // 既に消えている場合はスキップ
  }
}

// 参加者をチェックイン
export async function checkInAsParticipant(page: Page, name: string) {
  await page.fill('input[placeholder="あなたの名前"]', name);
  await page.click('text=参加する');
  await waitForLoading(page);
}

// スクリーンショットを撮る（デバッグ用）
export async function takeDebugScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${name}.png` });
}
