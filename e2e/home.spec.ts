import { test, expect } from '@playwright/test'

test('home loads and sets title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Zen Notes/i)
})

