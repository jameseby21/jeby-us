# Lessons: jeby-us

Dated records of failures that reached a person, each with the rule that prevents it and the test that proves the rule (standards rule 90). Newest first. A rule that turns out wrong stays here, marked as a bad bone with the corrected reading.

## 2026-11-08: a hover or focus check passed or failed by timing (CONS-0078)

**Case.** `node _src/jai/tests/browser.js` failed 2 of 3 runs on an untouched base, always in one of two checks: the records table "reason on focus" and the CONS-0051 group bars "numbers show on keyboard focus". Re-run four times on 2026-11-08 before the fix: 3 of 4 runs failed, one of them in both checks. The failure was `'0' !== '1'`, `'0.986121' !== '1'` or `true !== false` on a tooltip that the test had just caused to appear.

**Root cause.** A scroll event is delivered on the next animation frame, not when the scroll position changes. Both tooltips hide on any scroll (`records.js` and `report.js`). The test moved a scroll position (a click that resets the table to the top, `scrollIntoView`, Tab scrolling a far bar into view), focused or hovered, and then read the tooltip after a fixed `sleep`: whether the late scroll event hid the tooltip before or after the read depended on frame timing. For the group bars it was also a product defect: Tab to a bar that had to scroll into view lost its numbers a frame later, so a keyboard user saw nothing.

**Rule.** A check never waits a fixed time for a visual state. It waits for the state itself (`until`), and after anything that moves a scroll position it first lets the page deliver its scroll events (`settle`, two animation frames). A tooltip tied to focus must survive the scroll that the focus caused.

**Test.** `node _src/jai/tests/browser.js`, run in a loop. The two checks above now use `settle` and `until`. Observed after the fix on 2026-11-08: 9 of 10 runs green, then 9 of 10 (the one red was the 10,000-row frame-time budget, `p95 20.1` against 20, while another program was running), then 9 of 10 (the one red was the group-bar hover check timing out, cause not found), then 8 of 8 with a diagnostic line added to that timeout. No run failed in the two focus checks again. **Open:** the group-bar hover check still failed once in about 18 runs after the fix; its timeout message now prints what is under the pointer, so the next failure names its cause. Do not call the loop 10 of 10 until that is closed.
