# Plan: the Kauzl course as an owl-guided lesson flow

For: an AI coding agent (OpenCode) working in this repo.
Written: 2026-11-22. Status: not started.

## Goal

kauzl.com/guides/ is a 22-lesson course, "Learn web analytics for your app",
in 5 modules. Today each lesson is an article with previous/next links. Make
it three things:

1. **A course everywhere.** On the home page, in the menus, in `llms.txt` and
   in the structured data, it is presented and marked up as one course with
   modules and numbered lessons, not a pile of blog posts.
2. **A flow the owl guides.** A visitor picks a path, works through each
   lesson (outcomes, then steps, then a short check), and sees their progress
   as the owl's eyes filling in, from ring (before) to amber (after).
3. **SEO-consistent.** Every lesson stays a fast, fully indexable article at
   its current URL, with the same title and description. Nothing the flow adds
   may hide content, shift the layout or create duplicate URLs.

## Hard constraints

- **Static site, no backend.** Pages are built by `tools/build.mjs` into
  `tools/dist/` and served from Vercel at kauzl.com/guides/ and
  kauzl.com/tools/. The kauzl.com home page is a separate app,
  `server/home.mjs` on Fly. There are no accounts on these pages.
- **Progress lives in `localStorage` only**, under one key
  (`kauzl.course.v1`). Wrap every read and write in `try/catch`. Each page must
  render and work when storage is missing, blocked or empty.
- **Content is in the HTML.** Outcomes, steps and check questions are
  rendered by the build. JavaScript only adds saving, ticking, feedback and
  the owl's reactions. Test every page with JavaScript off.
- **The SEO/GEO rules keep passing.** These are `tools/seo-rules.mjs` and
  `docs/seo-rules.md`: one h1, 3+ h2, FAQ rules, "We make Kauzl" in `Compare`
  leads, no competitor prices.
- **Don't change any existing URL, `<title>`, meta description or
  canonical.** These pages are already indexed. Lesson numbers can change, so
  they never go in a title or URL.
- **No new third-party scripts, fonts or CDNs.** Use the tokens in
  `tools/assets/site.css`, the helpers in `tools/assets/site.js` (`track`, `$`,
  `$$`, `esc`) and `tools/assets/lib/owl.js` (`owl()`, `owlSays()`).
- **Nothing a visitor types leaves the page.** Analytics events say what was
  done, never what was typed.
- **Don't deploy, commit or push** unless the user asks. Build and test
  locally.

## Read first

| File | Why |
|---|---|
| `tools/build.mjs` | `COURSE`, `MODULES`, `lessonNo`, `guidePage()`, `guidesIndex()`, `guideRow()`, `layout()`, the `llms.txt` and sitemap writers |
| `tools/guides/*.mjs` | One lesson per file: `title`, `h1`, `lead`, `inShort`, `body`, `faq`, `tools`, `cta` |
| `tools/seo-rules.mjs`, `docs/seo-rules.md` | Rules every page must pass; `checkGuide()` validates lesson data |
| `tools/assets/lib/owl.js` | The owl SVG: left pupil `.before` is a ring, right pupil is filled amber; `owlSays()` for speech |
| `tools/assets/site.js` | `track()`; eyes follow the pointer and blink; `guide_read` fires at 75% scroll (around line 165) |
| `tools/assets/site.css` | Tokens and the course styles (`.lesson-nav`, `.lesson-badge`, `.col.module`, `.ic.num`) |
| `server/home.mjs` | The kauzl.com home page: its nav link and the `GUIDES` list in the footer |
| `tools/README.md` | Build, deploy and the analytics event table |
| `test/seo-rules.test.js`, `test/free-tools.test.js` | Test style to copy |

Commands:

```sh
npm run tools:build                      # builds tools/dist, fails on any SEO/GEO rule
node --test test/seo-rules.test.js test/free-tools.test.js
npx --yes serve tools/dist -l 3123       # preview at http://localhost:3123/guides/
```

## Part 1: a course everywhere

### One source of truth

Move `COURSE`, `MODULES` and the lesson-order helpers out of
`tools/build.mjs` into a new `tools/course.mjs` that exports them. This is
plain data plus pure functions. Both `tools/build.mjs` and `server/home.mjs`
import it, so the home page can never list a lesson the course doesn't have.
Give each module a stable `id` (`basics`, `choose-tools`, `read-numbers`,
`ai-search`, `ask-ai`) for anchors and data attributes.

### Where the word "course" appears

| Place | Today | Change to |
|---|---|---|
| Tools and guides header nav | "Course" (done) | Keep |
| kauzl.com home nav (`server/home.mjs`) | "Guides" → /guides/ | "Course" → /guides/ |
| kauzl.com home footer | "Guides" + 4 hand-picked links | "Free course" + lessons 1–4 in order + "All 22 lessons →" |
| Course page modules | Plain columns | `<section id="module-<id>">` per module, so module links and breadcrumbs have an anchor |
| Lesson pages | "Lesson 8 of 22" badge (done) | Keep; add the module's owl eyes (Part 2) |
| Tool pages, "Read the guide" | Guide rows | "Learn it in the course", with numbered lesson rows |
| Visible UI words | "guide" in buttons, skip links, section titles | "lesson" or "course". Leave lesson body text alone. |
| `llms.txt` | One flat "Guides" list | See below |

### `llms.txt` as a course

Replace the flat `## Guides` list with the course structure:

```md
## Free course: Learn web analytics for your app

22 lessons in 5 modules. Course page: https://kauzl.com/guides/

### Module 1: Basics
1. [The web analytics tools map](https://kauzl.com/guides/web-analytics-tools/): …
2. [Set up Google Analytics 4](…): …
```

Lessons that aren't in `MODULES` go under `### More lessons`. The site check
(`checkSite`, rule `llms`) must still find every lesson URL.

### Structured data

The course page and each lesson must describe one course, using
connected `@id`s. Validate with Google's Rich Results Test and
validator.schema.org before handing over. Add the checks below to
`tools/seo-rules.mjs` so the build fails if they break.

**Course page (`/guides/`)**: one `Course` node, `@id`
`https://kauzl.com/guides/#course`:

- `name`, `description`, `url`, `inLanguage: "en"`
- `provider`: Organization Kauzl, `url` https://kauzl.com/
- `isAccessibleForFree: true`, `educationalLevel: "Beginner"`
- `offers`: `{ "@type": "Offer", "price": 0, "priceCurrency": "USD", "category": "Free" }`
- `hasCourseInstance`: `{ "@type": "CourseInstance", "courseMode": "Online", "courseWorkload": "PT<total minutes>M" }`
- `teaches`: one short line per module
- `syllabusSections`: one `Syllabus` per module, with `name`, `description`
  and `timeRequired`
- `hasPart`: every lesson's `@id`, in order

Also add a `BreadcrumbList` with a single item, the course.

Note that the "no prices" rule covers the visible text of `Compare` lessons
only. A free `Offer` of 0 for our own course is correct and not a competitor
price.

**Each lesson**: change the `Article` node to
`"@type": ["Article", "LearningResource"]`, `@id`
`https://kauzl.com/guides/<slug>/#lesson`, and keep every current field.
Add:

- `learningResourceType: "Lesson"`, `educationalLevel: "Beginner"`
- `timeRequired: "PT<minutes>M"`
- `position: <lesson number>`
- `teaches`: the lesson's `goal` items
- `isPartOf`: `{ "@id": "https://kauzl.com/guides/#course" }`, plus `name`
  and `url`

Keep `FAQPage` as it is. Make the `BreadcrumbList` three items: Course → the
module (URL `https://kauzl.com/guides/#module-<id>`) → the lesson.

Don't put quiz questions in JSON-LD. Google's practice-problem markup is for
maths and science and doesn't fit here.

## Part 2: the owl-guided flow

### The owl's rules

These come from the brand. Keep to them; they're why it feels like Kauzl and
not a generic LMS.

- **Before and after eyes are the progress mark.** The owl's left pupil is a
  ring (before) and the right is filled amber (after). A lesson not yet done
  shows a ring; a finished lesson shows a filled amber dot. Use this instead
  of checkmarks, badges or bars.
- **The owl only talks in empty and celebration moments,** through
  `owlSays()`:
  - the course page before any progress
  - the path-picker questions
  - a module finished
  - the whole course finished

  It never comments on quiz answers, steps or anything with numbers.
- **The owl's lines are short and warm:** at most 12 words, no exclamation
  marks, no puns. "Three quick questions, and I’ll pick your lessons." "Module
  2 done. Your tools are picked." "That’s the course. Now go watch your site."
- **Owl sizes and placements:**

  | Where | Size |
  |---|---|
  | Course hero | 190 (exists) |
  | Lesson hero | 132 (exists) |
  | `owlSays` moments | 44 |
  | Module and course cards | 56 |
  | Inline eye marks | 14–16, eyes only, no body |

- **Motion:** a ring fills to amber over 300 ms, the eyes keep following the
  pointer and blinking, and nothing moves under `prefers-reduced-motion`.
- **Colour:** follow the dark/light rules. Amber is only for done marks,
  buttons, the owl's eyes and "after". Grey is for "before" and not yet done.

### The eye mark

Add `eye(state, size)` to `tools/assets/lib/owl.js`: a single owl eye as SVG.
It has a white or ink sclera with a pupil that is a ring (`todo`) or filled
amber (`done`), plus an accessible label ("not done" / "done").

Use it:

- in each syllabus row, replacing the number box. Keep the lesson number as
  text next to it.
- as a row of small eyes under each module heading, one per lesson.
- in the lesson header next to "Lesson 8 of 22", showing that module's eyes.
- on the "Mark as done" button, which shows the eye filling.

The build renders every eye as `todo`, because the server can't know a
visitor's progress. `course.js` switches eyes to `done` from storage. Eyes
have fixed sizes, so this causes no layout shift.

### Course page (`/guides/`)

1. **Owl welcome (empty state).** With no saved progress, show
   `owlSays("New here? Three quick questions, and I’ll pick your lessons.")`
   with two buttons: "Pick my path" and "Start at lesson 1". It sits in a
   slot the build already renders at a fixed height, so it doesn't push
   content down.
2. **Pick your path.** The three questions appear inline, one at a time, each
   with 3–4 buttons. Use no modal or overlay, which Google treats as an
   intrusive interstitial.
   - What are you building? (a website or blog · a web app or SaaS · a mobile
     or desktop app · a content site)
   - Where are you? (not launched · launched, few users · growing)
   - What worries you most? (where visitors come from · whether my changes
     work · AI search replacing Google · picking the right tools)

   The result is "Your path": 6–10 numbered lesson rows with eyes, above the
   full syllabus, plus a "Change my answers" link. The full syllabus never
   changes order.
3. **Returning visitor.** The welcome slot shows one line, "4 of 22 lessons
   done", and one button, "Continue: Lesson 5 →". That's the first unfinished
   lesson on their path, or in course order. The owl doesn't speak here.
4. **Course finished.** The owl at 56 with both eyes amber says "That’s the
   course. Now go watch your site." It shows the existing early-access CTA
   below.

Without JavaScript, the course page shows only the full syllabus with all
eyes as rings. That's what crawlers see.

### Lesson pages

Keep the article as it is (hero, "In short", body, Questions). Add:

1. **"By the end of this lesson"** (`goal`, 2–3 items), right after "In
   short", as a plain list.
2. **"Checkpoint"**: one section after the body and before "Questions", with
   the owl perched at 56 (silent). It holds:
   - **Do it now** (`steps`, 2–5 checkboxes). Each step links to a free tool
     or setting where one fits. Ticked steps are saved.
   - **Check yourself** (`check`, 1–3 multiple-choice questions). Picking an
     option marks it right or wrong in plain words, with a one-sentence
     explanation. Without JavaScript, each question has a `<details>` that
     reveals the answer.

   Use an `<h2>`, "Checkpoint", with `<h3>` subheads, so the heading outline
   stays valid.
3. **Mark as done**: a button in the lesson nav whose eye fills when pressed.
   It's set automatically when every check question has been answered, or
   when `guide_read` fires and at least one step is ticked. It can be undone.
4. **Module finished.** On the last lesson of a module, once all its lessons
   are done, the owl says "Module 2 done. Your tools are picked." It links to
   the next module's first lesson, and appears in the lesson nav area.

## Data model

### Lesson fields (in each `tools/guides/<slug>.mjs`)

```js
goal: [
  'Pick the right kind of analytics tool for the question you have',
  'Know which two tools to set up before launch',
],
steps: [
  { text: 'Write down the one question you most want your analytics to answer.' },
  { text: 'Set up Search Console for your site.', href: 'https://search.google.com/search-console' },
  { text: 'Tag the next link you share.', href: '/tools/utm-builder/' },
],
check: [
  {
    q: 'Which kind of tool shows what a visitor saw before leaving a page?',
    options: ['Web analytics', 'Session replay', 'Search data', 'Error tracking'],
    answer: 1,
    why: 'Session replay rebuilds the visitor’s screen; web analytics only counts the visit.',
  },
],
```

Rules (add them to `checkGuide()` in `tools/seo-rules.mjs`, with tests):

- `goal`: 2–3 items, each ≤ 90 characters, each starting with a verb. These
  become `teaches` in JSON-LD.
- `steps`: 2–5 items, each `text` ≤ 140 characters. `href` is optional; when
  it's internal it must be a built page.
- `check`: 1–3 questions, 2–4 options each, `answer` a valid index, `why` ≤
  200 characters, `q` ending in `?`.
- All three fields are optional until the final content phase, then required
  for every lesson in `MODULES`.
- Take every fact from that lesson's own body. Add no new claims about other
  products.

### Paths (in `tools/course.mjs`)

```js
export const PATHS = {
  // key: `${building}|${stage}|${worry}`, with '*' as a wildcard; first match wins.
  'app|*|changes': ['web-analytics-tools', 'google-analytics-4-setup', 'product-analytics-tools', 'did-a-website-change-work', 'statistical-significance-ab-testing', 'session-replay-heatmaps'],
  '*|*|ai': ['web-analytics-tools', 'track-chatgpt-traffic-google-analytics', 'what-is-aeo', 'generative-engine-optimization', 'ai-crawlers-robots-txt', 'openai-crawlers', 'claude-crawlers'],
  // …one rule per combination worth distinguishing, ending in a '*|*|*' default
};
```

`pickPath(answers, paths)` goes in `tools/assets/lib/course.js` with unit
tests. The build fails if any slug in `PATHS` isn't a lesson.

### Saved progress (`localStorage['kauzl.course.v1']`)

```json
{ "v": 1, "done": ["web-analytics-tools"], "steps": { "web-analytics-tools": [0, 2] }, "quiz": { "web-analytics-tools": [1] }, "path": { "answers": ["app", "launched", "changes"], "slugs": ["…"] }, "at": "2026-11-22" }
```

- Drop slugs that aren't in the current course.
- `v` lets a later version migrate the data.
- Put the logic in `tools/assets/lib/course.js` as pure functions over a
  plain object (`markDone`, `toggleStep`, `answer`, `nextLesson`,
  `moduleProgress`, `pickPath`), plus a thin storage wrapper with the
  `try/catch`.

## Build changes (`tools/build.mjs`)

- Import the course data from `tools/course.mjs`.
- In `guidePage()`:
  - Render `goal` and the Checkpoint. Steps are checkboxes with
    `data-step="<index>"`; each question is a `<fieldset>` of radios plus a
    `<details>` answer.
  - Render the eye marks as `todo`.
  - Put the new JSON-LD described above.
  - Put these data attributes on `<main>`: `data-lesson`, `data-lesson-no`,
    `data-module`, `data-module-slugs`, `data-next`, and
    `data-next-module-first` on a module's last lesson.
- In `guidesIndex()`:
  - Render module `<section id="module-<id>">` wrappers, eye rows and
    syllabus rows with `data-slug`.
  - Render a fixed-height `#course-welcome` slot and the picker markup,
    hidden until JavaScript shows it.
  - Embed `PATHS` and the course order once, as
    `<script type="application/json" id="course-data">`.
- Write `llms.txt` as a course.
- Load `assets/course.js` on the course page and on lesson pages.

## Client script (`tools/assets/course.js`)

- A module that imports `./site.js`, `./lib/course.js` and `./lib/owl.js`. It
  must not throw if any element is missing.
- In `site.js`, next to `track('guide_read', …)`, add
  `document.dispatchEvent(new CustomEvent('kauzl:guide-read'))`, and listen
  for it in `course.js`. Don't add a second observer.
- **On lesson pages:**
  - Restore steps and answers.
  - Fill the eyes.
  - Wire the checkboxes, radios and "Mark as done".
  - Show the module-finished owl.
- **On the course page:**
  - Fill the eyes.
  - Show the welcome or the progress line.
  - Run the picker and render "Your path".
  - Show the course-finished owl.
- Never insert content above anything already on screen without a reserved
  slot. Cumulative Layout Shift must stay below 0.1.
- Respect `prefers-reduced-motion`.

## Analytics events

Add these, and add them to the event table and GTM trigger regex in
`tools/README.md` (the regex needs `course_`).

| Event | When | Parameters |
|---|---|---|
| `course_path` | Path picked | `detail` = the three answer keys joined by `|` |
| `course_step` | A step ticked | `guide`, `detail` = step index |
| `course_check` | A check question answered | `guide`, `detail` = `right` or `wrong` |
| `course_done` | Lesson marked done | `guide`, `detail` = `auto` or `manual` |
| `course_module` | A module finished | `detail` = module id |
| `course_continue` | "Continue" pressed | `detail` = target slug |

Send each event at most once per page view per distinct `detail`.

## Phases

Do them in order. Each phase ends with a green build and tests, and a short
note to the user.

1. **Course everywhere.**
   - Create `tools/course.mjs` and switch `build.mjs` to it.
   - Add module anchors, the course-shaped `llms.txt`, and the new
     Course/LearningResource JSON-LD with its checks in `seo-rules.mjs`.
   - Change visible "guide" wording to "lesson" or "course".
   - Update `server/home.mjs` (nav and footer). That part needs a Fly deploy
     later; say so, and don't deploy.
2. **Data model and logic.** Add `goal`, `steps` and `check` to
   `checkGuide()` (optional for now) with tests, plus `PATHS`. Write
   `tools/assets/lib/course.js` and `test/course.test.js`, covering stale
   slugs and empty storage.
3. **Owl eye and server-rendered blocks.** Add `eye()` to `owl.js`. Render
   goal, Checkpoint, eye rows and the welcome slot. Fill in module 1's four
   lessons only. Check with JavaScript off.
4. **Lesson interactivity.** Add `course.js` for lesson pages.
5. **Course page.** Add the welcome, picker, "Your path", progress and the
   course-finished owl.
6. **Analytics.** Add the events and update the README.
7. **Content.** Write `goal`, `steps` and `check` for lessons 5–22 in the
   existing plain voice, then make the fields required.
8. **Verify and hand over.**
   - Run the build and tests.
   - Run Rich Results Test and validator.schema.org on the course page and
     two lessons.
   - Run Lighthouse on the course page and one lesson: SEO 100, CLS < 0.1.
   - Take screenshots at 1280px and 390px, in dark and light, at three
     moments: no progress, mid-way, and module finished.
   - Check with JavaScript off and with `localStorage` throwing (run
     `Storage.prototype.setItem = () => { throw new Error() }` in the
     console).
   - Ask the user before `npm run tools:deploy`, and before any Fly deploy
     for the home page.

## Done when

- [ ] The course page validates as a `Course` with `offers`,
      `hasCourseInstance`, `provider` and `syllabusSections`. Every lesson
      validates as `Article` + `LearningResource` with `isPartOf` the course.
      The build checks both.
- [ ] `llms.txt` lists the course by module with numbered lessons.
- [ ] The home page nav and footer say "Course" and list lessons from
      `tools/course.mjs`.
- [ ] All 22 lessons have `goal`, `steps` and `check`, and the build enforces
      them.
- [ ] Progress shows only as owl eyes (ring → amber), with no checkmarks,
      bars or badges.
- [ ] The owl speaks only at the welcome, the picker, a finished module and
      the finished course.
- [ ] With JavaScript off, every lesson shows outcomes, steps and questions,
      and each answer can be revealed.
- [ ] With storage blocked, pages work and remember nothing.
- [ ] No URL, `<title>`, meta description or canonical changed. Sitemap and
      robots are unchanged.
- [ ] Lighthouse SEO is 100 and CLS < 0.1. Nothing scrolls sideways at 390px.
- [ ] Unit tests cover `lib/course.js`. The README lists the `course_` events
      and the new regex.

## Open questions for the user

These are defaults; go ahead with them unless the user says otherwise.

1. **A shorter address like kauzl.com/course/?** Default: no new pages. If
   wanted, make it a 301 redirect to /guides/ in `server/hosted.mjs`, never a
   second copy of the page.
2. **Certificates or emails at the end?** Default: no. The end of the course
   links to the existing early-access CTA.
3. **Should the path picker reorder the syllabus?** Default: no. "Your path"
   is a separate list, so lesson numbers and links stay stable.
4. **Should progress sync across devices?** Default: no. That needs accounts.
