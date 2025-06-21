# AI Job Application Agent

A sophisticated AI agent that automates the job application process on Ashby-hosted pages, using GPT-4o to write tailored, human-like responses.

This project is a demonstration of how modern AI and browser automation tools can be combined to handle complex, real-world tasks. It is designed to be both a practical tool and an impressive portfolio piece.

## How it Works: A High-Level View

For hiring managers, recruiters, and anyone curious about the agent's capabilities, here's what it does in plain English:

1.  **Understands Your Goal:** You provide a link to a job posting. The agent is smart enough to find the application form, even if you just link to the job description.
2.  **Reads the Job Description:** Before it does anything else, the agent reads the full job description to understand the role's requirements and responsibilities.
3.  **Fills the Form Intelligently:** It enters your standard information (name, email, LinkedIn) and uploads your resume, just like a human would.
4.  **Writes Unique, Tailored Answers:** For open-ended questions (like "Why do you want to work here?"), the agent uses OpenAI's GPT-4o and the context from the job description to write a professional, relevant, and natural-sounding answer. It's specifically instructed to avoid robotic language and formatting.
5.  **Submits and Confirms:** The agent clicks the final submit button and then checks to make sure the application was received successfully.
6.  **Handles Errors Gracefully:** If something goes wrong—like a missing field or a website glitch—the agent detects it, reports the problem, and stops, preventing failed or incomplete submissions.

---

## Technical Deep Dive

For software engineers and technical evaluators, here's a look under the hood:

The agent is built as a single, robust action within the Kernel ecosystem.

-   **URL Normalization:** The agent accepts either a base job URL or a direct application URL. It programmatically normalizes the URL to first scrape the job description from the base path (e.g., `.../job-id/`) and then navigates to the form at the `/application` path.
-   **Context Scraping:** It uses a Playwright locator (`[data-ashby-body="true"]`) to extract the full job description text. This context is crucial for the quality of the AI-generated responses.
-   **Robust Form Interaction:**
    -   Standard fields are filled by locating `<label>` elements and their associated inputs, with a fallback to placeholder text. This makes the selectors resilient to minor HTML changes.
    -   The resume is uploaded using Playwright's `setInputFiles` method on an `<input type="file">` element.
-   **Open-Ended Question Handling:**
    -   The agent detects all visible `<textarea>` elements, which are assumed to be open-ended questions. It extracts their associated labels to understand the question being asked.
    -   A carefully constructed prompt is sent to the `gpt-4o` model. The prompt includes the scraped job description, the question, and a strict directive to produce plain text with no markdown or em-dashes to ensure a human-like quality.
-   **Submission & Verification:** The agent locates a `button[type="submit"]` and clicks it. It then verifies success by waiting for either a navigation to a confirmation URL (`**/application/submitted`) or the appearance of a success message on the page.
-   **Comprehensive Error Capturing:**
    -   **UI Errors:** After submission, the agent actively checks for on-page validation error messages (e.g., "This field is required").
    -   **Console Errors:** A `page.on('console')` listener is attached at the start of the session to capture any client-side JavaScript errors, providing a deeper layer of debugging information. All errors are collected and returned in the final output.

## 🔧 Tech Stack

-   **Orchestration & Infrastructure:** [Kernel](https://onkernel.com) – For cloud-based headless browser execution and easy deployment.
-   **Browser Automation:** [Playwright](https://playwright.dev/) – For all web interaction, scraping, and form filling.
-   **AI & Language Model:** [OpenAI GPT-4o](https://platform.openai.com/docs) – For generating contextual, high-quality answers.
-   **Language & Runtime:** [TypeScript](https://www.typescriptlang.org/) & [Node.js](https://nodejs.org/) – For building robust, type-safe agent logic.

## 🚀 Getting Started

1.  Clone the repo:  
    `git clone <your-repo-url>`
2.  Install dependencies:  
    `npm install`
3.  Create a `.env` file in the root directory and add your OpenAI API key:  
    `OPENAI_API_KEY="sk-..."`
4.  Add your resume (e.g., `My_Resume.pdf`) to the root directory.
5.  Deploy to Kernel using the CLI:  
    `source .env && kernel deploy index.ts --env OPENAI_API_KEY=$OPENAI_API_KEY`
6.  Invoke the agent with the target job URL and your personal details.

    ```bash
    kernel invoke ts-basic apply-to-job --payload '{
      "url": "https://jobs.ashbyhq.com/example-company/job-id",
      "name": "Your Name",
      "email": "your.email@example.com",
      "linkedin": "https://linkedin.com/in/yourprofile",
      "resumePath": "My_Resume.pdf"
    }'
    ```

## 🧠 Future Improvements

-   **Extend Platform Support:** Add dedicated logic to handle other popular job platforms like Greenhouse, Lever, and Workday.
-   **Add a UI:** Build a simple web interface to track submitted applications, manage different resumes, and view results.
-   **Improve Contextual Understanding:** Use embedding models to create a vector representation of a resume or cover letter, and use it to further guide the tone and content of the AI-generated answers.
-   **Add Observability:** Capture screenshots or videos of the automation process for easier debugging of failed runs.