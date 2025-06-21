import { Kernel, type KernelContext } from '@onkernel/sdk';
import { chromium, type Locator } from 'playwright';
import OpenAI from 'openai';

const kernel = new Kernel();

const app = kernel.app('ts-basic');

/**
 * Example app that extracts the title of a webpage
 * Args:
 *     ctx: Kernel context containing invocation information
 *     payload: An object with a URL property
 * Returns:
 *     A dictionary containing the page title
 * Invoke this via CLI:
 *  export KERNEL_API_KEY=<your_api_key>
 *  kernel deploy index.ts # If you haven't already deployed this app
 *  kernel invoke ts-basic get-page-title -p '{"url": "https://www.google.com"}'
 *  kernel logs ts-basic -f # Open in separate tab
 */
interface PageTitleInput {
  url: string;
}

interface PageTitleOutput {
  title: string;
}
app.action<PageTitleInput, PageTitleOutput>(
  'get-page-title',
  async (ctx: KernelContext, payload?: PageTitleInput): Promise<PageTitleOutput> => {
    if (!payload?.url) {
      throw new Error('URL is required');
    }
    
    if (!payload.url.startsWith('http://') && !payload.url.startsWith('https://')) {
      payload.url = `https://${payload.url}`;
    }

    // Validate the URL
    try {
      new URL(payload.url);
    } catch {
      throw new Error(`Invalid URL: ${payload.url}`);
    }

    const kernelBrowser = await kernel.browsers.create({
      invocation_id: ctx.invocation_id,
    });

    console.log("Kernel browser live view url: ", kernelBrowser.browser_live_view_url);

    const browser = await chromium.connectOverCDP(kernelBrowser.cdp_ws_url);
    const context = await browser.contexts()[0] || (await browser.newContext());
    const page = await context.pages()[0] || (await context.newPage());

    try {
      //////////////////////////////////////
      // Your browser automation logic here
      //////////////////////////////////////
      await page.goto(payload.url);
      const title = await page.title();
      return { title };
    } finally {
      await browser.close();
    }
  },
);

/**
 * Example app that instantiates a persisted Kernel browser that can be reused across invocations
 * Invoke this action to test Kernel browsers manually with our browser live view
 * https://docs.onkernel.com/launch/browser-persistence
 * Args:
 *     ctx: Kernel context containing invocation information
 * Returns:
 *     A dictionary containing the browser live view url
 * Invoke this via CLI:
 *  export KERNEL_API_KEY=<your_api_key>
 *  kernel deploy index.ts # If you haven't already deployed this app
 *  kernel invoke ts-basic create-persisted-browser
 *  kernel logs ts-basic -f # Open in separate tab
 */
interface CreatePersistedBrowserOutput {
  browser_live_view_url: string;
}
app.action("create-persisted-browser",
  async (ctx: KernelContext): Promise<CreatePersistedBrowserOutput> => {

    const kernelBrowser = await kernel.browsers.create({
      invocation_id: ctx.invocation_id,
      persistence: {
        id: "persisted-browser",
      },
      stealth: true, // Turns on residential proxy & auto-CAPTCHA solver
    });

    return {
      browser_live_view_url: kernelBrowser.browser_live_view_url,
    };
  }
);

/**
 * Main agent logic: Automate job applications on Ashby-style pages
 * Args:
 *     ctx: Kernel context containing invocation information
 *     payload: Job application details (URL, applicant info, etc.)
 * Returns:
 *     A dictionary with the application result and any errors
 */
interface ApplyToJobInput {
  url: string;
  name: string;
  email: string;
  linkedin: string;
  resumePath: string; // Path to the resume PDF in the workspace
  // Add more fields as needed
}

interface ApplyToJobOutput {
  success: boolean;
  message: string;
  errors?: string[];
}

app.action<ApplyToJobInput, ApplyToJobOutput>(
  'apply-to-job',
  async (ctx: KernelContext, payload?: ApplyToJobInput): Promise<ApplyToJobOutput> => {
    if (!payload?.url || !payload.name || !payload.email || !payload.linkedin || !payload.resumePath) {
      return { success: false, message: 'Missing required fields', errors: ['URL, name, email, linkedin, and resumePath are required'] };
    }

    let browser;
    const consoleErrors: string[] = []; // Declare here to be accessible in finally
    try {
      // 1. Launch Kernel browser
      const kernelBrowser = await kernel.browsers.create({
        invocation_id: ctx.invocation_id,
      });
      browser = await chromium.connectOverCDP(kernelBrowser.cdp_ws_url);
      const context = await browser.contexts()[0] || (await browser.newContext());
      const page = await context.pages()[0] || (await context.newPage());

      // Capture console errors for debugging
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          console.error(`Browser Console Error: ${msg.text()}`);
          consoleErrors.push(msg.text());
        }
      });

      // Normalize URL to get base and application URLs
      const baseUrl = payload.url.replace(/\/application\/?$/, '');
      const applicationUrl = `${baseUrl}/application`;

      // 1.5 Scrape job description for context
      let jobDescription = '';
      try {
        await page.goto(baseUrl);
        // This selector is specific to Ashby job pages
        const descriptionElement = page.locator('[data-ashby-body="true"]');
        if (await descriptionElement.count()) {
          jobDescription = await descriptionElement.innerText();
          console.log('Scraped job description for context.');
        } else {
          console.warn('Could not find job description element on the page.');
        }
      } catch (e: any) {
        console.warn(`Could not scrape job description, proceeding without it. Error: ${e.message}`);
      }

      // 2. Navigate to the job application URL
      await page.goto(applicationUrl);

      // 3. Fill out standard fields (name, email, LinkedIn, etc.)
      // Try to fill by label, then by placeholder, for each field
      const fieldConfigs = [
        { label: /name|full name/i, value: payload.name },
        { label: /email/i, value: payload.email },
        { label: /linkedin/i, value: payload.linkedin },
      ];
      for (const { label, value } of fieldConfigs) {
        let filled = false;
        // Try by label
        const labelElements = await page.locator(`label`).all();
        for (const labelEl of labelElements) {
          const text = (await labelEl.textContent()) || '';
          if (label.test(text)) {
            const forAttr = await labelEl.getAttribute('for');
            if (forAttr) {
              const input = page.locator(`#${forAttr}`);
              if (await input.count()) {
                await input.fill(value);
                filled = true;
                break;
              }
            } else {
              // Label wraps input
              const input = labelEl.locator('input,textarea');
              if (await input.count()) {
                await input.fill(value);
                filled = true;
                break;
              }
            }
          }
        }
        if (!filled) {
          // Try by placeholder
          const input = page.locator(`input[placeholder],textarea[placeholder]`);
          const count = await input.count();
          for (let i = 0; i < count; i++) {
            const el = input.nth(i);
            const placeholder = (await el.getAttribute('placeholder')) || '';
            if (label.test(placeholder)) {
              await el.fill(value);
              filled = true;
              break;
            }
          }
        }
        if (!filled) {
          console.warn(`Could not find field for label: ${label}`);
        }
      }

      // 4. Upload resume PDF
      // Try to find file input by label (e.g., Resume, CV), then fallback to any file input
      const fileLabels = [/resume/i, /cv/i];
      let fileInputFound = false;
      const labelElements = await page.locator('label').all();
      for (const labelEl of labelElements) {
        const text = (await labelEl.textContent()) || '';
        if (fileLabels.some((re) => re.test(text))) {
          const forAttr = await labelEl.getAttribute('for');
          if (forAttr) {
            const input = page.locator(`#${forAttr}[type="file"]`);
            if (await input.count()) {
              await input.setInputFiles(payload.resumePath);
              fileInputFound = true;
              break;
            }
          } else {
            // Label wraps input
            const input = labelEl.locator('input[type="file"]');
            if (await input.count()) {
              await input.setInputFiles(payload.resumePath);
              fileInputFound = true;
              break;
            }
          }
        }
      }
      if (!fileInputFound) {
        // Fallback: try any file input
        const fileInputs = page.locator('input[type="file"]');
        if (await fileInputs.count()) {
          await fileInputs.first().setInputFiles(payload.resumePath);
          fileInputFound = true;
        }
      }
      if (!fileInputFound) {
        console.warn('Could not find file input for resume upload');
      }

      // 5. Detect open-ended questions
      // Extract all visible textarea elements and their associated labels
      const openEndedQuestions: { label: string; locator: Locator }[] = [];
      const textareas = page.locator('textarea');
      const count = await textareas.count();
      for (let i = 0; i < count; i++) {
        const textarea = textareas.nth(i);
        // Check if visible
        if (await textarea.isVisible()) {
          // Try to find associated label
          let labelText = '';
          // 1. Check for <label for=...>
          const id = await textarea.getAttribute('id');
          if (id) {
            const label = page.locator(`label[for="${id}"]`);
            if (await label.count()) {
              labelText = (await label.first().textContent())?.trim() || '';
            }
          }
          // 2. Check if textarea is wrapped by a label
          if (!labelText) {
            const parentLabel = await textarea.locator('xpath=ancestor::label').first();
            if (await parentLabel.count()) {
              labelText = (await parentLabel.textContent())?.trim() || '';
            }
          }
          // 3. Fallback: look for preceding text node or element
          if (!labelText) {
            const prev = textarea.locator('xpath=preceding-sibling::*[1]');
            if (await prev.count()) {
              labelText = (await prev.textContent())?.trim() || '';
            }
          }
          openEndedQuestions.push({ label: labelText, locator: textarea });
        }
      }
      // Optionally: log detected questions
      console.log('Detected open-ended questions:', openEndedQuestions.map(q => q.label));

      // 6. Use OpenAI GPT-4o to generate responses
      if (openEndedQuestions.length > 0) {
        // Initialize OpenAI client
        const openai = new OpenAI(); // Automatically uses OPENAI_API_KEY from env

        for (const question of openEndedQuestions) {
          console.log(`Generating answer for: "${question.label}"`);
          try {
            const prompt = `You are a world-class job applicant applying for a role.
            Based on the following job description, please provide a concise and professional answer to the application question.
            Your response must be plain text only, with no markdown formatting (like bolding or lists) and no em-dashes (—).

            Job Description:
            ---
            ${jobDescription || 'Not available'}
            ---

            Question: "${question.label}"

            Answer:`;

            const completion = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
              max_tokens: 250,
            });

            const answer = completion.choices[0]?.message?.content?.trim();

            if (answer) {
              // 7. Insert AI-generated answers into the form
              await question.locator.fill(answer);
              console.log(`Filled answer for: "${question.label}"`);
            } else {
              console.warn(`Generated empty answer for: "${question.label}"`);
            }
          } catch (err: any) {
            console.error(`Failed to generate answer for "${question.label}":`, err.message);
          }
        }
      }

      // 8. Submit the application
      const submitButton = page.locator('button[type="submit"]:has-text(/submit/i)');
      if (await submitButton.count() > 0) {
        console.log('Submitting the application...');
        await submitButton.first().click();

        // 9. Handle post-submission state (success or errors)
        // Wait for navigation to a success page or for an error message to appear
        try {
          // Option 1: Wait for a URL change that indicates success (common on Ashby)
          await page.waitForURL('**/application/submitted', { timeout: 10000 });
          console.log('Application submitted successfully! Navigated to success page.');
          return { success: true, message: 'Application submitted successfully.' };
        } catch (e) {
          // Option 2: Check for inline validation errors if navigation doesn't happen
          const validationError = page.locator('.ashby-application-form-errors__error-message, [role="alert"]');
          if (await validationError.count() > 0) {
            const errorMessages = await validationError.allInnerTexts();
            console.error('Submission failed with validation errors:', errorMessages);
            return { success: false, message: 'Submission failed with validation errors.', errors: errorMessages };
          }

          // Option 3: Check for a generic success message on the same page
          const successMessage = page.locator('text=/Thank you for your application|Application submitted/i');
          if (await successMessage.count() > 0) {
            console.log('Application submitted successfully! Found success message.');
            return { success: true, message: 'Application submitted successfully.' };
          }

          // If none of the above, assume it might have worked but we can't confirm.
          console.log('Submit button clicked, but confirmation state is unclear. Assuming success.');
          return { success: true, message: 'Application submitted, but confirmation could not be verified.' };
        }
      } else {
        console.error('Could not find the submit button.');
        return { success: false, message: 'Could not find submit button.', errors: ['Submit button not found on page.'] };
      }
    } catch (err: any) {
      const allErrors = [err?.message || String(err), ...consoleErrors];
      return { success: false, message: 'An unexpected error occurred during the process.', errors: allErrors };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  },
);