// The time zone the tests run in, on both sides: Node (which builds the made-up people's clock times) and the browser (which runs the app).
// It has a fixed offset and no clock changes, so the two sides can never disagree. A real zone's rules change now and then,
// and Node and the browser each carry their own copy of them: with a real zone, a test can fail on one machine and pass on another.
// Clock changes are tested separately, inside the browser alone (screens.test.js, "[clock]").
// Require this file before anything that reads a date.
const ZONE = 'Etc/GMT+7';       // seven hours behind UTC, all year
process.env.TZ = ZONE;
module.exports = { ZONE };
