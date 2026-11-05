# Privacy design

The educational mechanism clips model deltas then adds Gaussian parameter noise; it provides no proven differential privacy. Configured epsilon is recorded in a basic ledger, delta is stored as experimental metadata, and exceeding the epsilon limit blocks training. No relationship between these settings and a certified privacy guarantee is claimed.

Pairwise additive numeric masks illustrate cancellation, not a cryptographic protocol. Nodes and coordinator share a process and trust boundary. Authorization uses server-checked roles and hospital ownership, passwords use scrypt, JWTs are signed and stored in HttpOnly SameSite cookies, and logout revokes the token identifier. Production requires durable PostgreSQL, stable secrets, distributed rate limits/locks, stronger audit guarantees, secret rotation and an independent security assessment. TLS is supplied by hosting; at-rest encryption must be configured at the data host.
