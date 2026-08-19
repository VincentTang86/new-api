package constant

// PlaygroundTokenNamePrefix is the token name stamped on every playground
// request. The playground builds a temporary token that is never persisted, so
// its id stays 0 in both `logs` and `quota_data`; this prefix is the only thing
// that tells playground usage apart from other id-less rows.
const PlaygroundTokenNamePrefix = "playground-"
