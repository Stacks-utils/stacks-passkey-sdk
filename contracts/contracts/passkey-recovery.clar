;; Optional guardian recovery module for passkey accounts.
;; Guardians can initiate recovery after a timelock; the account owner can cancel.

(define-constant err-unauthorized (err u2001))
(define-constant err-already-guardian (err u2002))
(define-constant err-not-guardian (err u2003))
(define-constant err-recovery-pending (err u2004))
(define-constant err-no-recovery (err u2005))
(define-constant err-timelock (err u2006))
(define-constant err-max-guardians (err u2007))

(define-constant MAX-GUARDIANS u3)
(define-constant RECOVERY-DELAY u144) ;; ~1 day at ~10 min blocks

(define-data-var owner-account principal tx-sender)
(define-data-var recovery-pubkey (optional (buff 33)) none)
(define-data-var recovery-start-block (optional uint) none)
(define-map guardians principal bool)
(define-data-var guardian-count uint u0)
(define-data-var recovery-threshold uint u2)

(define-public (set-owner (account principal))
  (begin
    (asserts! (is-eq tx-sender (var-get owner-account)) err-unauthorized)
    (var-set owner-account account)
    (ok true)
  )
)

(define-public (add-guardian (guardian principal))
  (begin
    (asserts! (is-eq tx-sender (var-get owner-account)) err-unauthorized)
    (asserts! (< (var-get guardian-count) MAX-GUARDIANS) err-max-guardians)
    (asserts! (is-none (map-get? guardians guardian)) err-already-guardian)
    (map-set guardians guardian true)
    (var-set guardian-count (+ (var-get guardian-count) u1))
    (print { event: "guardian-added", guardian: guardian })
    (ok true)
  )
)

(define-public (remove-guardian (guardian principal))
  (begin
    (asserts! (is-eq tx-sender (var-get owner-account)) err-unauthorized)
    (asserts! (is-some (map-get? guardians guardian)) err-not-guardian)
    (map-delete guardians guardian)
    (var-set guardian-count (- (var-get guardian-count) u1))
    (print { event: "guardian-removed", guardian: guardian })
    (ok true)
  )
)

(define-public (initiate-recovery (new-pubkey (buff 33)))
  (begin
    (asserts! (default-to false (map-get? guardians tx-sender)) err-unauthorized)
    (asserts! (is-none (var-get recovery-pubkey)) err-recovery-pending)
    (var-set recovery-pubkey (some new-pubkey))
    (var-set recovery-start-block (some burn-block-height))
    (print { event: "recovery-initiated", pubkey: new-pubkey })
    (ok true)
  )
)

(define-public (cancel-recovery)
  (begin
    (asserts! (is-eq tx-sender (var-get owner-account)) err-unauthorized)
    (asserts! (is-some (var-get recovery-pubkey)) err-no-recovery)
    (var-set recovery-pubkey none)
    (var-set recovery-start-block none)
    (print { event: "recovery-cancelled" })
    (ok true)
  )
)

(define-public (complete-recovery)
  (let (
      (start-block (unwrap! (var-get recovery-start-block) err-no-recovery))
      (pubkey (unwrap! (var-get recovery-pubkey) err-no-recovery))
    )
    (begin
      (asserts! (default-to false (map-get? guardians tx-sender)) err-unauthorized)
      (asserts! (>= burn-block-height (+ start-block RECOVERY-DELAY)) err-timelock)
      (print { event: "recovery-completed", pubkey: pubkey, account: (var-get owner-account) })
      (ok pubkey)
    )
  )
)

(define-read-only (get-recovery-status)
  (ok {
    pending: (is-some (var-get recovery-pubkey)),
    start-block: (var-get recovery-start-block),
    pubkey: (var-get recovery-pubkey),
    delay: RECOVERY-DELAY,
  })
)

(define-read-only (is-guardian (who principal))
  (ok (default-to false (map-get? guardians who)))
)
