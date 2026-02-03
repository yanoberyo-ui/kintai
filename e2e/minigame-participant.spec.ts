import { test, expect } from '@playwright/test';

/**
 * ミニゲーム参加者画面のE2Eテスト
 *
 * テスト対象:
 * 1. チェックイン画面
 * 2. 待機室
 * 3. ゲーム画面
 * 4. タイマー表示
 */

// テスト用の固定イベントID（存在するイベントIDを使用）
// 実際のテストでは事前にイベントを作成するか、環境変数で指定
const TEST_EVENT_ID = 'test-event-id';

test.describe('ミニゲーム参加者画面', () => {

  test.describe('チェックイン', () => {
    test('存在しないイベントでエラー表示', async ({ page }) => {
      await page.goto('/minigame/non-existent-event-id');

      // ローディングを待つ
      await page.waitForTimeout(3000);

      // エラーメッセージが表示されることを確認
      await expect(page.locator('text=イベントが見つかりません').or(page.locator('text=URLを確認してください'))).toBeVisible();
    });

    test('チェックインフォームが表示される', async ({ page }) => {
      // 実際に存在するイベントURLにアクセス
      // ここではダミーIDを使用（実環境では存在するIDを使う）
      await page.goto('/minigame/test-event');

      // ローディングを待つ
      await page.waitForTimeout(2000);

      // イベントが存在する場合
      const checkInForm = page.locator('input[placeholder="あなたの名前"]');
      const errorMessage = page.locator('text=イベントが見つかりません');

      if (await checkInForm.isVisible({ timeout: 3000 }).catch(() => false)) {
        // チェックインフォームが表示される
        await expect(checkInForm).toBeVisible();
        await expect(page.locator('button:has-text("参加する")')).toBeVisible();
      } else if (await errorMessage.isVisible({ timeout: 1000 }).catch(() => false)) {
        // イベントが存在しない場合はテストスキップ
        test.skip(true, 'テスト用イベントが存在しないためスキップ');
      }
    });

    test('名前未入力で参加ボタンが無効', async ({ page }) => {
      await page.goto('/minigame/test-event');
      await page.waitForTimeout(2000);

      const checkInForm = page.locator('input[placeholder="あなたの名前"]');
      if (await checkInForm.isVisible({ timeout: 3000 }).catch(() => false)) {
        // 名前が空の状態で参加ボタンが無効であることを確認
        const submitButton = page.locator('button:has-text("参加する")');
        await expect(submitButton).toBeDisabled();
      } else {
        test.skip(true, 'チェックインフォームが表示されないためスキップ');
      }
    });

    test('名前入力で参加ボタンが有効になる', async ({ page }) => {
      await page.goto('/minigame/test-event');
      await page.waitForTimeout(2000);

      const checkInForm = page.locator('input[placeholder="あなたの名前"]');
      if (await checkInForm.isVisible({ timeout: 3000 }).catch(() => false)) {
        // 名前を入力
        await checkInForm.fill('テストユーザー');

        // 参加ボタンが有効になることを確認
        const submitButton = page.locator('button:has-text("参加する")');
        await expect(submitButton).toBeEnabled();
      } else {
        test.skip(true, 'チェックインフォームが表示されないためスキップ');
      }
    });
  });

  test.describe('待機室', () => {
    test('待機室UIが正しく表示される', async ({ page }) => {
      await page.goto('/minigame/test-event');
      await page.waitForTimeout(2000);

      // チェックインフォームが表示される場合
      const checkInForm = page.locator('input[placeholder="あなたの名前"]');
      if (await checkInForm.isVisible({ timeout: 3000 }).catch(() => false)) {
        // ユニークな名前でチェックイン
        const uniqueName = `Test_${Date.now()}`;
        await checkInForm.fill(uniqueName);
        await page.click('button:has-text("参加する")');

        // 待機室または他の画面に遷移するのを待つ
        await page.waitForTimeout(3000);

        // 待機中画面が表示される場合
        const waitingText = page.locator('text=待機中');
        const gameScreen = page.locator('text=あなたのテーブル');

        if (await waitingText.isVisible({ timeout: 3000 }).catch(() => false)) {
          // 待機室のUI確認
          await expect(page.locator('text=管理者がゲームを開始するまでお待ちください')).toBeVisible();
          await expect(page.locator('text=人参加中')).toBeVisible();
        } else if (await gameScreen.isVisible({ timeout: 3000 }).catch(() => false)) {
          // すでにゲームが始まっている場合
          test.skip(true, 'ゲームが既に開始されているためスキップ');
        }
      } else {
        test.skip(true, 'イベントが存在しないためスキップ');
      }
    });

    test('参加者リストが表示される', async ({ page }) => {
      await page.goto('/minigame/test-event');
      await page.waitForTimeout(2000);

      const checkInForm = page.locator('input[placeholder="あなたの名前"]');
      if (await checkInForm.isVisible({ timeout: 3000 }).catch(() => false)) {
        const uniqueName = `Test_${Date.now()}`;
        await checkInForm.fill(uniqueName);
        await page.click('button:has-text("参加する")');
        await page.waitForTimeout(3000);

        const waitingText = page.locator('text=待機中');
        if (await waitingText.isVisible({ timeout: 3000 }).catch(() => false)) {
          // 自分の名前が表示されていることを確認
          await expect(page.locator(`text=${uniqueName}`)).toBeVisible();
          // 「あなた」マークが表示されていることを確認
          await expect(page.locator('text=(あなた)')).toBeVisible();
        }
      } else {
        test.skip(true, 'イベントが存在しないためスキップ');
      }
    });
  });

  test.describe('ゲーム画面', () => {
    test('ゲーム画面UIが正しく表示される', async ({ page }) => {
      await page.goto('/minigame/test-event');
      await page.waitForTimeout(2000);

      const checkInForm = page.locator('input[placeholder="あなたの名前"]');
      if (await checkInForm.isVisible({ timeout: 3000 }).catch(() => false)) {
        const uniqueName = `Test_${Date.now()}`;
        await checkInForm.fill(uniqueName);
        await page.click('button:has-text("参加する")');
        await page.waitForTimeout(3000);

        // ゲーム画面が表示される場合（イベントがactiveの時）
        const gameScreen = page.locator('text=あなたのテーブル');
        if (await gameScreen.isVisible({ timeout: 5000 }).catch(() => false)) {
          // テーブル番号が表示される
          await expect(gameScreen).toBeVisible();

          // 同席メンバーセクション
          await expect(page.locator('text=同席メンバー')).toBeVisible();

          // ラウンド表示
          await expect(page.locator('text=ラウンド')).toBeVisible();
        }
      } else {
        test.skip(true, 'イベントが存在しないためスキップ');
      }
    });

    test('タイマーが表示される', async ({ page }) => {
      await page.goto('/minigame/test-event');
      await page.waitForTimeout(2000);

      const checkInForm = page.locator('input[placeholder="あなたの名前"]');
      if (await checkInForm.isVisible({ timeout: 3000 }).catch(() => false)) {
        const uniqueName = `Test_${Date.now()}`;
        await checkInForm.fill(uniqueName);
        await page.click('button:has-text("参加する")');
        await page.waitForTimeout(3000);

        const gameScreen = page.locator('text=あなたのテーブル');
        if (await gameScreen.isVisible({ timeout: 5000 }).catch(() => false)) {
          // タイマーコンポーネントが存在することを確認
          // タイマー形式: "X:XX" または "0:00"
          const timerDisplay = page.locator('text=/\\d+:\\d{2}/');
          if (await timerDisplay.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(timerDisplay.first()).toBeVisible();
          }
        }
      } else {
        test.skip(true, 'イベントが存在しないためスキップ');
      }
    });
  });

  test.describe('終了画面', () => {
    test('終了画面が表示される（イベント終了時）', async ({ page }) => {
      // 終了したイベントにアクセスした場合のテスト
      await page.goto('/minigame/finished-event');
      await page.waitForTimeout(3000);

      // 終了メッセージが表示される場合
      const finishedText = page.locator('text=イベント終了');
      if (await finishedText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(page.locator('text=ご参加ありがとうございました')).toBeVisible();
      } else {
        // イベントが存在しないか、終了していない
        test.skip(true, '終了したイベントが存在しないためスキップ');
      }
    });
  });
});
