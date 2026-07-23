# LockIN

A study tool that turns your notes into flashcards using AI. This is v1:
paste/upload notes, generate flashcards, flip through them. More features
(quizzes, wrong-answer tracking, games, XP) get added on top of this.

## Run it on your machine

1. **Open this folder in VS Code**
   File → Open Folder → select `studybuddy`

2. **Open a terminal in VS Code**
   Terminal menu → New Terminal

3. **Install the project's dependencies**
   ```
   npm install
   ```
   This reads `package.json` and downloads the libraries the project needs.

4. **Install the Vercel CLI** (lets you run the frontend and the backend
   function together locally, exactly like it'll work once deployed)
   ```
   npm install -g vercel
   ```

5. **Add your API key**
   Copy `.env.example` to a new file called `.env` and paste your real key in:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-actual-key
   ```

6. **Start the app**
   ```
   vercel dev
   ```
   First time, it'll ask a few setup questions - just accept the defaults
   (link to a new project, no need to change any settings). It'll then give
   you a local address like `http://localhost:3000` - open that in your browser.

7. Paste some notes, hit "Generate flashcards," and you should see cards appear.

## Deploying it live (once it's working locally)

1. Create a free account at [vercel.com](https://vercel.com) and at
   [github.com](https://github.com) if you don't have them.
2. Push this project to a new GitHub repo (VS Code has a built-in "Source
   Control" tab that can do this - or ask me and I'll walk you through the
   git commands).
3. In Vercel, click "Add New Project," import your GitHub repo.
4. In the Vercel project settings → Environment Variables, add
   `ANTHROPIC_API_KEY` with your real key (this keeps it secret - it's
   never in your code or on GitHub).
5. Deploy. You'll get a live `.vercel.app` URL you can share.

## Project structure

```
studybuddy/
  src/
    App.jsx              main component, holds app state
    components/
      FileUpload.jsx      paste/upload notes
      Flashcards.jsx      flip-card viewer
  api/
    generate.js           serverless function - calls Claude to make flashcards
  .env                     your secret API key (never commit this)
```

## What's next

Once this runs for you, tell Claude and we'll add, one at a time:
- Quiz generator with different modes
- Wrong-answer tracking with source references
- Rapid Fire / Survival / Memory Match games
- XP and streaks
- PDF and Word file support (right now only `.txt` files work)
