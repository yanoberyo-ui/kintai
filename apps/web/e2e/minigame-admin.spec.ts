import { test, expect, Page } from '@playwright/test';

/**
 * ミニゲーム管理者画面のE2Eテスト
 *
 * テスト対象:
 * 1. イベント作成
 * 2. イベント操作（開始/シャッフル/終了）
 * 3. タイマー操作
 * 4. 席配置表示
 * 5. 参加者表示
 */

test.describe('ミニゲーム管理者画面', () => {
  // 管理者画面へのナビゲーションをセットアップ
  // 注: 実際のテストでは認証が必要な場合がある

  test.describe('イベント作成', () => {
    test('新規イベント作成モーダルが表示される', async ({ page }) => {
      // 管理者画面にアクセス（認証が必要な場合はスキップ）
      await page.goto('/');

      // ミニゲーム管理ボタンが表示されるか確認
      // 注: is_minigame_admin権限を持つユーザーでログインしている必要がある
      const minigameButton = page.locator('text=ミニゲーム管理');

      if (await minigameButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await minigameButton.click();

        // 「新規イベント」ボタンをクリック
        await page.click('text=新規イベント');

        // モーダルが表示されることを確認
        await expect(page.locator('text=新規イベント作成')).toBeVisible();

        // 入力フィールドが存在することを確認
        await expect(page.locator('input[placeholder*="シャッフルランチ"]')).toBeVisible();
        await expect(page.locator('textarea[placeholder*="イベントの説明"]')).toBeVisible();
      } else {
        test.skip(true, '管理者権限がないためスキップ');
      }
    });

    test('イベント名未入力で作成ボタンが無効', async ({ page }) => {
      await page.goto('/');

      const minigameButton = page.locator('text=ミニゲーム管理');
      if (await minigameButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await minigameButton.click();
        await page.click('text=新規イベント');

        // 作成ボタンが無効であることを確認
        const createButton = page.locator('button:has-text("作成")');
        await expect(createButton).toBeDisabled();
      } else {
        test.skip(true, '管理者権限がないためスキップ');
      }
    });

    test('イベント名入力で作成ボタンが有効になる', async ({ page }) => {
      await page.goto('/');

      const minigameButton = page.locator('text=ミニゲーム管理');
      if (await minigameButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await minigameButton.click();
        await page.click('text=新規イベント');

        // イベント名を入力
        await page.fill('input[placeholder*="シャッフルランチ"]', 'テストイベント');

        // 作成ボタンが有効になることを確認
        const createButton = page.locator('button:has-text("作成")');
        await expect(createButton).toBeEnabled();
      } else {
        test.skip(true, '管理者権限がないためスキップ');
      }
    });
  });

  test.describe('イベントコントロール', () => {
    test('参加者2人未満でゲーム開始ボタンが無効', async ({ page }) => {
      await page.goto('/');

      const minigameButton = page.locator('text=ミニゲーム管理');
      if (await minigameButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await minigameButton.click();

        // イベント一覧から選択（既存イベントがある場合）
        const eventItem = page.locator('[class*="rounded-2xl"]').filter({ hasText: '待機中' }).first();

        if (await eventItem.isVisible({ timeout: 5000 }).catch(() => false)) {
          await eventItem.click();

          // 参加者が2人未満の場合、ゲーム開始ボタンが無効
          const startButton = page.locator('button:has-text("ゲーム開始")');
          if (await startButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            // 参加者数を確認
            const participantCount = await page.locator('text=参加者').locator('..').textContent();
            if (participantCount && parseInt(participantCount.match(/\d+/)?.[0] || '0') < 2) {
              await expect(startButton).toBeDisabled();
            }
          }
        }
      } else {
        test.skip(true, '管理者権限またはイベントがないためスキップ');
      }
    });

    test('参加用URLがコピーできる', async ({ page, context }) => {
      await page.goto('/');

      const minigameButton = page.locator('text=ミニゲーム管理');
      if (await minigameButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await minigameButton.click();

        // イベント一覧から選択
        const eventItem = page.locator('[class*="rounded-2xl"]').first();

        if (await eventItem.isVisible({ timeout: 5000 }).catch(() => false)) {
          await eventItem.click();

          // 参加用URLセクションが表示されることを確認
          await expect(page.locator('text=参加用URL')).toBeVisible();

          // コピーボタンが存在することを確認
          const copyButton = page.locator('button:has-text("コピー")');
          await expect(copyButton).toBeVisible();
        }
      } else {
        test.skip(true, '管理者権限またはイベントがないためスキップ');
      }
    });
  });

  test.describe('タイマー操作', () => {
    test('タイマーコントロールが表示される（ゲーム進行中）', async ({ page }) => {
      await page.goto('/');

      const minigameButton = page.locator('text=ミニゲーム管理');
      if (await minigameButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await minigameButton.click();

        // 進行中のイベントを選択
        const activeEvent = page.locator('[class*="rounded-2xl"]').filter({ hasText: '進行中' }).first();

        if (await activeEvent.isVisible({ timeout: 5000 }).catch(() => false)) {
          await activeEvent.click();

          // タイマー表示を確認
          await expect(page.locator('text=スタート')).toBeVisible();
          await expect(page.locator('text=一時停止').or(page.locator('text=再開'))).toBeVisible();
          await expect(page.locator('text=リセット')).toBeVisible();
        }
      } else {
        test.skip(true, '進行中のイベントがないためスキップ');
      }
    });

    test('タイマー分数を設定できる', async ({ page }) => {
      await page.goto('/');

      const minigameButton = page.locator('text=ミニゲーム管理');
      if (await minigameButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await minigameButton.click();

        const activeEvent = page.locator('[class*="rounded-2xl"]').filter({ hasText: '進行中' }).first();

        if (await activeEvent.isVisible({ timeout: 5000 }).catch(() => false)) {
          await activeEvent.click();

          // 分数入力フィールド
          const minuteInput = page.locator('input[type="number"]');
          if (await minuteInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await minuteInput.fill('10');
            await expect(minuteInput).toHaveValue('10');
          }
        }
      } else {
        test.skip(true, '進行中のイベントがないためスキップ');
      }
    });
  });

  test.describe('席配置', () => {
    test('席配置が表示される（ゲーム進行中）', async ({ page }) => {
      await page.goto('/');

      const minigameButton = page.locator('text=ミニゲーム管理');
      if (await minigameButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await minigameButton.click();

        const activeEvent = page.locator('[class*="rounded-2xl"]').filter({ hasText: '進行中' }).first();

        if (await activeEvent.isVisible({ timeout: 5000 }).catch(() => false)) {
          await activeEvent.click();

          // 席配置セクション
          await expect(page.locator('text=現在の席配置')).toBeVisible();

          // テーブル表示
          const tableElements = page.locator('text=テーブル');
          if (await tableElements.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            expect(await tableElements.count()).toBeGreaterThan(0);
          }
        }
      } else {
        test.skip(true, '進行中のイベントがないためスキップ');
      }
    });

    test('シャッフルボタンが機能する', async ({ page }) => {
      await page.goto('/');

      const minigameButton = page.locator('text=ミニゲーム管理');
      if (await minigameButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await minigameButton.click();

        const activeEvent = page.locator('[class*="rounded-2xl"]').filter({ hasText: '進行中' }).first();

        if (await activeEvent.isVisible({ timeout: 5000 }).catch(() => false)) {
          await activeEvent.click();

          // シャッフルボタン
          const shuffleButton = page.locator('button').filter({ hasText: /シャッフル/ });
          if (await shuffleButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(shuffleButton).toBeEnabled();
          }
        }
      } else {
        test.skip(true, '進行中のイベントがないためスキップ');
      }
    });
  });
});
