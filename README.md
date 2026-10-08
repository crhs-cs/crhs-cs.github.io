# Cedar Ridge CS Club website

The site for the Cedar Ridge High School Computer Science Club, live at **https://crhs-cs.github.io**.
It's plain HTML, CSS and JavaScript with no build step, hosted on GitHub Pages. Anything merged into
`main` is live within a couple of minutes.

## Where things live

| Path | What it is |
|---|---|
| `index.html` | Home page: the black hole intro, meetings calendar, latest projects and presentations |
| `projects/`, `presentations/`, `resources/`, `opportunities/` | The other pages |
| `projects/view/` | The page for a single project (`/projects/view/?id=...`) |
| `projects/submit/` | "Add your project" instructions |
| `data/*.js` | The content: projects, presentations, resources, opportunities, officers |
| `data/config.js` | Links for the project submission form and its sheet |
| `assets/` | Shared styles and scripts, including the header animations |
| `images/projects/` | Project screenshots added by pull request |

## Adding a project

Projects come from two places, merged automatically:

1. **The submission form.** Responses go into a Google Sheet. An officer types `yes` in the
   **Approved** column, and the project appears on the site. Only the sheet's public tab (approved
   rows only) is published.
2. **A pull request.** Edit `data/projects.js`, copy one of the blocks to the top of the list and fill
   it in. The comments at the top of the file explain every field. Put a screenshot in
   `images/projects/` and point `image` at it. An officer reviews and merges.

To build the form and its spreadsheet from scratch, use `tools/project-form-setup.gs`: paste it into
a new project at script.google.com while signed in to the account that should own the form, then
follow the steps at the top of the file.

If the same project shows up in both, the `data/projects.js` version wins, so officers can fix a form
entry by adding a corrected block with the same `id`.

## Adding a presentation

Drop the slides (Google Slides, PowerPoint or PDF) into the club's **CRHS CS Club presentations**
Drive folder, named like `2026-10-14 Intro to Git (Rishi B.)`. A script syncs the folder into the
spreadsheet every 15 minutes, and the site reads it, so the deck appears within about 20 minutes.
The first slide becomes the card's thumbnail. Setup and details are in `tools/presentations-sync.gs`.
`data/presentations.js` still works for anything that isn't in the folder.

## Editing other content

Every list on the site is a file in `data/`. Open it on GitHub, click the pencil, copy an existing
entry, edit it, and commit. Each file has instructions at the top.

## After changing files in `assets/`

Browsers cache scripts and styles. When you change a file in `assets/` or `data/`, bump the `?v=`
number on its `<script>` or `<link>` tag in the HTML pages so visitors get the new version right away.

## Credits

- The Utah teapot model (`data/teapot.js`) is Martin Newell's 1975 model, in the public domain,
  from the npm package `teapot`.
