import { test, expect } from '@playwright/test';
import {
  clearAuthenticatedUser,
  installChatApiMocks,
  seedAuthenticatedUser
} from './chatPage.mocks';

test.describe('ChatPage E2E (mocked)', () => {
  test('redirects unauthenticated users from /chat to /login', async ({ page }) => {
    await clearAuthenticatedUser(page);
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('hydrates conversations and defaults to first thread', async ({ page }) => {
    await seedAuthenticatedUser(page);
    await installChatApiMocks(page);

    await page.goto('/chat');

    await expect(page.getByTestId('chat-list')).toBeVisible();
    await expect(page.getByTestId('chat-item-c_alpha')).toBeVisible();
    await expect(page.getByTestId('chat-item-c_beta')).toBeVisible();
    await expect(page.locator('.chat-header-title')).toHaveText('Admin');
    await expect(page.getByTestId('message-bubble-m_alpha_1')).toContainText('Hi Jordan');
  });

  test('switches threads and updates header/messages', async ({ page }) => {
    await seedAuthenticatedUser(page);
    await installChatApiMocks(page);

    await page.goto('/chat');
    await page.getByTestId('chat-item-c_beta').click();

    await expect(page.locator('.chat-header-title')).toHaveText('Taylor Seller');
    await expect(page.getByTestId('message-bubble-m_beta_1')).toContainText('Can you pick up tomorrow?');
  });

  test('sends text message via HTTP fallback and re-renders messages', async ({ page }) => {
    await seedAuthenticatedUser(page);
    await installChatApiMocks(page);

    await page.goto('/chat');
    await page.getByTestId('chat-input').fill('Playwright message');
    await page.getByTestId('chat-send-btn').click();

    await expect(page.getByTestId('message-bubble-m_generated_100')).toContainText('Playwright message');
  });

  test('shows withdraw on right-click for own message and updates withdrawn UI', async ({ page }) => {
    await seedAuthenticatedUser(page);
    await installChatApiMocks(page);

    await page.goto('/chat');
    await page.getByTestId('message-bubble-m_alpha_2').click({ button: 'right' });
    await expect(page.getByTestId('message-context-menu')).toBeVisible();
    await expect(page.getByTestId('withdraw-action')).toBeVisible();
    await page.getByTestId('withdraw-action').click();

    await expect(page.getByTestId('message-bubble-m_alpha_2')).toContainText('Message withdrawn');
  });

  test('does not show withdraw context menu for non-owned message', async ({ page }) => {
    await seedAuthenticatedUser(page);
    await installChatApiMocks(page);

    await page.goto('/chat');
    await page.getByTestId('message-bubble-m_alpha_1').click({ button: 'right' });
    await expect(page.getByTestId('message-context-menu')).toHaveCount(0);
  });
});

