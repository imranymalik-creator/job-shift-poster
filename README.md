# job-shift-poster

Job Shift Careers: scheduled posts to Instagram (@jobshiftcareers, with i.m.imran as collaborator) and the Job Shift Careers Facebook Page. Runs on GitHub by itself; no computer needs to be on.

## How it works
- **`schedule.json`**: the list of reels, each with its time (India time), video file, caption and where it goes. Claude adds the week's reels every Saturday after Imran approves them.
- **`media/`**: the reel videos. GitHub Pages puts them online so Instagram and Facebook can fetch them.
- **Every 30 minutes** (Actions › *Post*), the poster publishes anything that is due, then notes it in `state/posted.json` so nothing is ever posted twice. A reel that missed its time by more than 12 hours is skipped, not posted at a strange hour.
- **Sundays 08:00** (Actions › *Insights*), views, reach, likes, comments, shares and saves are saved to `insights/latest.json` for the Sunday review.

## Settings (Settings › Secrets and variables › Actions)
| Name | Kind | What |
| --- | --- | --- |
| `META_TOKEN` | Secret | Meta key that can post for the Page and @jobshiftcareers. Only Imran adds or changes it. |
| `IG_USER_ID`, `FB_PAGE_ID` | `poster/config.json` | Public ids of @jobshiftcareers and the Page (*whoami* prints them) |
| `GRAPH_VERSION` | Variable, optional | Meta API version, default `v23.0` |

## Tests
- `node tests/poster.test.mjs`: runs the poster against a pretend Meta server.
- Actions › Post › Run workflow › **check**: uploads the upcoming reels to Instagram and waits until Instagram accepts them, **without publishing**. `"test": true` entries in the schedule are never published.

## Stop everything
Actions › Post › ⋯ › **Disable workflow**. Or set `"paused": true` on one reel.

Not handled by any API (done by hand): Instagram music, story link stickers, DMs, likes, follows, LinkedIn, YouTube (until YouTube's audit).
