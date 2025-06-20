# Kernel Job Agent

This is a demo AI agent built with [Kernel](https://onkernel.com), Playwright, and OpenAI. It automates the job application process for listings hosted on platforms like AshbyHQ.

## ✨ Features

- Accepts a job application URL (e.g. an Ashby-hosted form)
- Launches a headless browser in the cloud via Kernel
- Fills out standard fields (name, email, LinkedIn, etc.)
- Uploads a resume (e.g. `Weston_Ludeke_Resume.pdf`)
- Detects open-ended questions (e.g. “Why do you want to work here?”)
- Uses GPT-4o via OpenAI API to generate tailored responses
- Inserts AI-generated answers into the form fields
- Submits the completed application
- Handles basic error states (e.g. missing fields, failed loads, captchas)

## 🔧 Tech Stack

- [Kernel](https://onkernel.com) – Cloud infrastructure for browser-based automations
- [Playwright](https://playwright.dev/) – Browser scripting and automation
- [OpenAI GPT-4o](https://platform.openai.com/docs) – LLM-powered answer generation
- TypeScript

## 📁 Project Structure

```
/kernel-job-agent
├── index.ts                  # Main agent logic
├── .env                      # API keys (e.g. OPENAI\_API\_KEY)
├── Weston\_Ludeke\_Resume.pdf  # Resume file (gitignored by default)
└── README.md                 # Project overview
```

## 🚀 Getting Started

1. Clone the repo  
2. Add your `.env` file with your OpenAI API key  
3. Add your resume PDF to the root directory
4. Update `.gitignore` if you want to keep your resume off of GitHub
5. Deploy to Kernel using the CLI:  
   ```bash
   source .env && kernel deploy index.ts --env OPENAI_API_KEY=$OPENAI_API_KEY```

6. Invoke the agent with your target job application URL

## 🧠 Future Improvements

* Detect and report captchas or blocked access
* Add support for tailoring answers based on company and role context
* Extend support to other job platforms (Greenhouse, Lever, Workable)
* Capture browser screenshots for observability and debugging