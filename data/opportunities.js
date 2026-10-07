// Competitions and programs to sign up for. The page sorts them by date and moves
// anything whose date has passed into a "Past" list automatically.
//
// To add one, copy a block and fill it in:
//   title:     name of the competition or program
//   organizer: who runs it
//   date:      the key date (deadline or start) as "YYYY-MM-DD", or "" if not announced yet
//   dateLabel: what that date is, e.g. "Submissions due" or "Contest opens"
//   estimated: true if the date is a best guess until the organizer posts it
//   when:      text shown instead of a date when date is "" (e.g. "Usually March")
//   note:      one or two short lines on who it's for and what to know
//   url:       official page

window.CLUB_OPPORTUNITIES = [
  {
    title: "Congressional App Challenge",
    organizer: "U.S. House of Representatives",
    date: "2026-10-26",
    dateLabel: "Submissions due, 12:00 p.m. ET",
    note: "Build an app and submit it to your district. Teams of up to 4. The app must be made after Oct 30, 2025.",
    url: "https://www.congressionalappchallenge.us/",
  },
  {
    title: "ACSL",
    organizer: "American Computer Science League",
    date: "2026-10-19",
    dateLabel: "Contest #1 opens",
    note: "Four short contests through the year, taken at school. A teacher registers the school, so ask our sponsor.",
    url: "https://www.acsl.org/",
  },
  {
    title: "USACO December contest",
    organizer: "USA Computing Olympiad",
    date: "2026-12-11",
    estimated: true,
    dateLabel: "Contest window starts",
    note: "Free, online and individual. Four contests a season, starting in Bronze. Confirm dates on usaco.org.",
    url: "https://usaco.org/",
  },
  {
    title: "picoCTF",
    organizer: "Carnegie Mellon University",
    date: "",
    when: "Usually March",
    note: "A two-week hacking competition built for high schoolers. Practice now on picoGym.",
    url: "https://picoctf.org/",
  },
];
