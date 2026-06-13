# DriftFold — what to say (demo script)

Read this aloud while `design-system.html` is on screen. Plain language, no jargon.
`[brackets]` = what to do/point at. Everything else = say it.

---

## The one-liner (if someone asks "what is it?")

> "It finds every place in your app where someone pasted custom styling onto a
> button instead of using the real one, groups the ones that are secretly the
> same, and an AI tells you which to merge, which are duplicates, and which are
> bugs — so your design system stops drifting."

---

## The 60-second script

**Set up the problem (15s)**

> "Every frontend team has this problem. You build one Button. It's clean. Then
> across the app, people paste their own colors and shapes onto it instead of
> reusing it. Six months later you've got six slightly-different blue buttons
> that were all supposed to be the *same* button. Nobody decided that — it just
> drifted. And the reason it never gets fixed is **nobody can see all of it at
> once.**"

**Show the page (15s)**

> [point at the top] "So DriftFold scanned the app and here it is — every button,
> every card, grouped by how it actually looks. Each card is one look."
>
> [point at the first Button card] "This blue pill? **Used in 4 places.** The AI
> says: this is a real, repeated style — let's make it one official style called
> 'brand.'"

**The wow moment (15s) — slow down here**

> [point at the `bg-[#2563eb]` / 'custom color' card] "Now watch this one. It looks
> *identical* to the first blue button — same pill, same shadow. But in the code,
> one was written `bg-blue-600` and this one `#2563eb` — which is the exact same
> blue, just typed as a hex code. A human reading the code would **never** catch
> that they're the same. The AI did, and flagged it: 'this is a duplicate, merge
> it.'"
>
> [point at the blue-on-blue 'looks like a mistake' card] "And this one — blue text
> on a blue background. That's not drift, that's an actual **bug**. It found that
> for free."

**Where it goes (15s)**

> [point at the red → destructive card] "It also caught this hand-rolled red button
> that just re-invents a 'destructive' style the app already had."
>
> [scroll to the bottom dock] "You pick what to do with each — keep, merge,
> make-it-official — and it builds this list of decisions. The next step takes that
> list and **rewrites the code automatically** and adds a rule so it can't drift
> again. The whole point: one page, see the entire mess, fix it with intent."

---

## If you're also showing it run live (optional +20s)

Before opening the page:

> "This isn't a static report — it's a Claude Code workflow. It fans out an AI
> agent per component, clusters the styling deterministically in code so the counts
> are trustworthy, and only uses the model for the *judgment* — naming styles,
> spotting duplicates, flagging bugs."
>
> [run the workflow, let `/workflows` show the agents, ~60s] "...and that's the page."

---

## If they ask…

**"Does it actually change my code?"**
> "The reveal you're seeing is step one — it diagnoses and you approve. The rewrite
> step is the next build; the approved decisions are already saved in the exact
> format it needs. Today it shows you the whole problem and your fix plan."

**"Does it work on a real app, or just this demo?"**
> "Point it at any Tailwind + shadcn app. This demo app has known, planted drift so
> you can see it catch exactly the right things. It's scoped on purpose to the four
> things design systems actually drift on — color, corners, shadow, spacing."

**"How is this different from a linter / Prettier?"**
> "A linter checks rules you already wrote. This *discovers* the styles you didn't
> know you had, decides which should become rules, and an AI makes the judgment
> calls a regex can't — like 'these two different code snippets render the same.'"

---

## The 10-second version (elevator)

> "Your buttons drifted into six near-identical versions. DriftFold finds them all,
> shows them on one page, and an AI says which are duplicates, which are bugs, and
> which should become official styles. It even caught two buttons that look
> identical but were coded differently."
