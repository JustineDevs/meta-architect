# Reliability and recovery dossier

`$flow` uses this dossier when a design depends on retries, recovery, partial
completion, concurrency, or operational failure behavior.

## Default review

The lane must identify the state model, invariants, timeout budget, retry and
idempotency rule, cancellation path, partial-completion behavior, and the signal
that proves recovery. A reliability reference informs the review; it does not
prove that an application is reliable.

The review should prefer simple recovery boundaries, explicit failure ownership,
bounded retries, and observable outcomes. If a failure can duplicate work or
leave an ambiguous state, `$flow` records it as a blocker or an explicit
accepted risk before handing off to `$vet`.

## Reference source

The pinned reference is [Google's Building Secure and Reliable Systems](https://github.com/google/building-secure-and-reliable-systems),
commit `2a2ae3e0d4dbd288f9862ed47194f5b1b1ed7c3c`, accessed through
`https://gitmcp.io/google/building-secure-and-reliable-systems`. Credit belongs
to the book authors and Google; this dossier is an implementation aid, not a
replacement for the source.
