# The Library · La Bibliothèque

How the body works, one picture at a time. The other V3KTOR apps measure what happens in one person; the Library explains how bodies work in general, so those apps don't each have to.

- **The app:** https://v3ktor.org/library/app/ (installs on a phone, works offline). A card has its own address, so another app can link straight to it: `https://v3ktor.org/library/app/#caffeine-clock`.
- **Status:** a first slice. The home screen (a meal's path through the body, six stops) and the Energy stop: eight cards (Tiny batteries, What slows the power plant, The door that sticks, What the brain runs on, Caffeine's clock, The heart and a scare, Water and salt, The dip after a meal); the Gut stop: eight cards (How long food takes, The burn after a meal, Ulcers: a sore in the wall, What the color of blood says, Where a belly pain sits, The bucket, Gas and bloating, Where each nutrient gets in); the Fuel stop: four cards (Iron, in and out; The body's fuel tanks; B12 and folate; Calcium, vitamin D and vitamin K); the Sleep stop: three cards (The night's stages, What cuts sleep short; Short sleep, hunger and blood sugar); the Signals stop: four cards (The brakes on eating, The stress response, Reward and habit, The gut-brain link); the Wear stop: two cards (DNA damage and cancer, Inflammation). 287 pictures in all. No public page yet, and it isn't on the front page yet.

## How a card is written
- **One idea per picture.** Each picture changes one thing from the one before; the first one says what we're looking at and where it is in the body.
- **Plain words first.** The specialist's term follows in `{braces}`, shown grey in brackets, the first time a word comes up.
- **Third person.** Card text is about the body and a person, not "you". « Tu » only in the buttons. No « on » in French card text.
- **How sure.** Every picture carries a grade (`solid` or `likely`), and every card its sources (`SRC`), each checked against the source itself.
- **Report, never advise.** None of the words listed in `tests/library/cards.test.js`.
- **One visual alphabet.** The same colour means the same thing on every card (`COLOURS` in the app, and the "What the colours mean" sheet).
- **The novice read.** Before a card ships, it is read as someone who knows nothing about the subject: every word points to something drawn and labelled, or taught in an earlier picture; movement is drawn; the last picture is never a free benefit.

## How it's built
- **`library/app/index.html` is the whole app**: HTML, CSS, JavaScript, the cards and the drawings, in one file, both languages. No build step.
- The cards sit between `/* ==== COLOURS` and `/* ==== end of CARDS ==== */`; the tests read them from there.
- After changing the app: `node tools/stamp_cache.js`, then `node tests/run.js`.
- `tools/library/make_icons.js` draws the icons (an open book on the family's orange square).
