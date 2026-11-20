# Video script: Rishta Safe, under three minutes

Target 2:40 to 2:50 spoken at a calm pace. The narration column has 369 words (split on spaces and hyphens); read by the local Windows voice at rate +1 with short pauses for the on-screen actions, the finished video runs 2:49.97. The narration column below is the exact text of the voice track and of the burned-in captions (`docs/submission/video/captions.srt` and `docs/submission/video/narration.txt` are generated from it). The script follows the redesigned interface and is written for someone who has never seen the product: every click is named exactly as the screen labels it, and every statement of what the product does is paired with what it does not do.

## Before recording

- Start the backend and the frontend locally (commands in the technical report, section 12). Do not say where the demo runs and do not say it is deployed (ADR 0220); the script says nothing about hosting.
- Reset the demo first so every case starts from its seed: choose the judge lens ("Evidence and live probes") from the case bench, then press **Reset the demo**. Reset again after every take: the threshold choice, the sharing switch and the probes each write audit rows.
- The cases and people are synthetic and come from `GET /v1/demo/cases` and `GET /v1/demo/personas`. The flagship is case 2: first cousins who both carry the same condition (Usher syndrome type 2A; the carrier frequency behind it is illustrative). Every name on screen carries "(synthetic)". The narration names no one.
- Case 9 (a pregnancy in progress with a shared result) is the case for the staff beat. The counsellor lens opens it from the **Counsellor** column of the case bench ("Brief").
- The Arabic text on screen is a machine draft awaiting native clinical review. The evidence figures and the staff brief are English only, and the screen says so. Keep those notes in shot.

## What not to say

- Do not read any number that is not in the narration.
- Do not say "validated", "reviewed", "approved", "compliant", "secure", "fully accessible" or "clinically tested" about anything.
- Do not say where the demo runs, and do not say it is deployed.
- Do not name a person who built or advised on Rishta Safe, and do not name or count other entries to the challenge.
- Do not call the Arabic or Urdu translations reviewed. They are drafts.
- Do not describe the scoreboard's 100% figures as proof of safety. The screen tags them "Regression gate, not safety evidence".
- Do not call the three result categories a severity scale, and do not state a residual-risk number or a marriage-decision answer.

## Script

| What is on screen | What is said |
| --- | --- |
| 1. Title card, then the landing page `/en`: the dark statement row and, under it, one synthetic result in two languages beside its tally of 100 pregnancies, tagged "From a recorded response". Return to the top and point at the honesty rail ("Synthetic data"). | A screening result can leave a couple asking what it means, who may see it, and what happens next. Rishta Safe is a prototype for the UAE premarital genetic screening pathway that addresses them. Everything you see is synthetic data. |
| 2. The case bench `/en/demo`. Show the table of ten cases crossed with Partner 1, Partner 2, Counsellor, Clinician and Programme; point at "Aggregate only". Press **Open the flagship case**. | Ten synthetic cases, each crossed with the roles that may open them. The programme role sees aggregates only. We open case two: first cousins who carry the same condition. |
| 3. The threshold. Press **Change how I meet it**: four options, none selected. Select **I prefer not to know**, press **Continue**; the dialog quotes the articles; press **Record my choice**: the page reads "You chose not to know this result". Press **I want to see my result**, select **Read it now**, press **Continue**. | Before a result is shown, each person chooses how to meet it: now, with a counsellor first, not yet, or not at all. Nothing is preselected. Choosing not to know is recorded as a legal right, Federal Decree-Law 49 of 2023, Article 9(2). |
| 4. Read together. The same text in English and Arabic side by side, the category chip, the grid of 100 cells with its legend, then "What this means, and what it does not". Point at the chip, then at the "draft" tag on the Arabic column. | The result is read together: the same text in English and Arabic, with one hundred pregnancies as a grid. It states a chance, never a diagnosis. The headline is one of three categories, not a severity scale. The Arabic is a machine draft awaiting native clinical review. |
| 5. Who sees what. Press **Who sees what** in the header. Point at the first column ("You decide") and the fixed columns that cite the articles. In the first column press **Share** on the row "Gene names"; scroll to the audit table below ("What has happened to your information") where a `consent_granted` row has appeared. | Who sees what: only the first column is the person's to change. The care team, the national genomic database, employers and insurers are fixed by the rules. Sharing gene names with the partner writes a row to the audit log. |
| 6. The staff instrument. From `/en/demo`, in the row for case 9 press **Brief** in the Counsellor column. Show the queue, the one-page brief and the trace pane together. Press **J** and **K** to move through the queue. Click a trace chip on a brief line. | Staff get a queue, a one-page brief and a trace, side by side. Every line of the brief links to the rule and source behind it. Nothing is generated, and it recommends nothing. The rule text is English and pending clinical sign-off. |
| 7. Try to break it. Choose the judge lens, then open **Evidence** in the header. With the probe **An employer asks for a result** open, press **Send this request**: the refusal, its legal basis and the audit row it wrote. Then choose **Ask whether to go ahead with the wedding** and press **Send this request**. | Now try to break it. Each probe sends a real request as a synthetic persona, and shows the response and the audit row it wrote. An employer asks for a result: refused, and logged. Asking whether to go ahead with the wedding: refused, never answered, never scored. |
| 8. The scoreboard, below the probes. Pause on the weakest figure shown first (the refusal measure, 36 of 59, 61%); then the figures tagged "Regression gate, not safety evidence"; then the two hatched "Not run" cells (M8 and M9). | The scoreboard shows its weakest figure first: our refusal classifier refused thirty-six of fifty-nine held-out prompts on its first run, sixty-one percent. The hundred percent figures are regression gates, not safety evidence. Two measures are hatched: not run. |
| 9. The limits. Open `/en/governance#limits`: "Limits of this prototype", items 1 to 6, with the honesty rail above. | What is not done: no clinical review, no comprehension study, no real patient data, and no connection to any UAE health system. Arabic and Urdu text are drafts awaiting native review. |
| 10. Closing card: "Rishta Safe", the challenge, "Prototype on synthetic data. Not a medical device. Not clinical advice." | Rishta Safe explains. People decide. |

## Notes for the editor

- Keep the honesty rail and the "synthetic" and draft marks visible in beats 2 to 7; they are part of the message.
- Beat 3 changes the server's record for case 2 and then withdraws it. Do it in the order given so the flagship ends open, and reset the demo after the take.
- Beats 6 and 7 each need a lens change. If that feels slow on camera, cut from the click to the opened screen.
- Case 9's brief states its priority and the triggers that fired. Do not read them aloud; they are not in the narration.
- The title card carries the challenge name and the line "Prototype on synthetic data. Not a medical device. Not clinical advice." No music.
- Narration is kept in English throughout, with Arabic shown only on screen, because the local text-to-speech voice reads English well and Arabic poorly.
