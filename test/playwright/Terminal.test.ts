import { Page, test } from '@playwright/test';

// let ctx: ITestContext;
// test.beforeEach(async ({ page }) => ctx = await createTextContext(page));

test('first test', async ({ page }) => {
  console.log('page', page);
});
