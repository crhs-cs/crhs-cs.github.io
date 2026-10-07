// Projects members have presented at meetings.
//
// Projects reach the site two ways:
//   1. The project submission Google Form. Approved rows show up automatically (see data/config.js).
//   2. A pull request that adds a block to this file. See README.md for the steps.
//
// To add a project here, copy one block, paste it at the top of the list, and fill it in.
// Only title, presenter and date are required; leave anything else out if you don't have it.
//   id:          short, unique, lowercase-with-dashes name used in the project's page link
//   title:       project name
//   presenter:   first name(s), or first name and last initial, since the site is public
//   date:        the meeting it was presented at, as "YYYY-MM-DD"
//   summary:     one short line shown on the card
//   description: a few sentences for the project's own page: what it does, how it works, what was hard
//   image:       screenshot link (https://...), or a file in /images/projects/, e.g. "/images/projects/wordle.png"
//   tags:        a few short labels used for filtering, e.g. ["Python", "Game"]
//   code:        GitHub repo or other source link
//   demo:        live version people can try
//   slides:      presentation slides, if any
//
// The three sample blocks below are marked sample: true. Delete them once real projects are added.

window.CLUB_PROJECTS = [
  {
    sample: true,
    id: "pathfinding-visualizer",
    title: "Pathfinding visualizer",
    presenter: "Sample",
    date: "2026-10-14",
    summary: "A* and Dijkstra racing each other across the same grid",
    description: "Draw walls on a grid, pick a start and an end, and watch A* and Dijkstra's algorithm search side by side. Each explored cell lights up as it's visited, so you can see why A* usually checks far fewer cells.",
    tags: ["JavaScript", "Algorithms", "Web"],
  },
  {
    sample: true,
    id: "homework-reminder-bot",
    title: "Homework reminder bot",
    presenter: "Sample",
    date: "2026-10-14",
    summary: "A Discord bot that pings a channel before assignments are due",
    description: "Students add assignments with a slash command, and the bot posts reminders the day before and the morning of each due date. It stores everything in a small SQLite database.",
    tags: ["Python", "Discord"],
  },
  {
    sample: true,
    id: "wordle-solver",
    title: "Wordle solver",
    presenter: "Sample",
    date: "2026-10-07",
    summary: "Picks each guess by how much information it's expected to reveal",
    description: "For every possible guess, the solver works out how the remaining answers would split across all the color patterns, then picks the guess with the highest expected information. It solves most puzzles in three or four guesses.",
    tags: ["Python", "Algorithms"],
  },
];
