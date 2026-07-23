;; Factory registry - maps passkey pubkeys to per-user passkey-account contract principals.
;; Account contracts are deployed off-chain (relay); factory stores the mapping on-chain.

(define-constant ERR-UNAUTHORIZED (err u3001))
(define-constant ERR-ALREADY-REGISTERED (err u3002))
(define-constant ERR-NOT-FOUND (err u3003))

(define-map accounts (buff 33) principal)
(define-data-var registrar principal tx-sender)
(define-data-var account-count uint u0)

(define-public (set-registrar (new-registrar principal))
  (begin
    (asserts! (is-eq tx-sender (var-get registrar)) ERR-UNAUTHORIZED)
    (var-set registrar new-registrar)
    (ok true)
  )
)

(define-public (register-account (pubkey (buff 33)) (account principal))
  (begin
    (asserts! (is-eq tx-sender (var-get registrar)) ERR-UNAUTHORIZED)
    (asserts! (is-none (map-get? accounts pubkey)) ERR-ALREADY-REGISTERED)
    (map-set accounts pubkey account)
    (var-set account-count (+ (var-get account-count) u1))
    (print { event: "account-registered", pubkey: pubkey, account: account })
    (ok true)
  )
)

(define-read-only (lookup-account (pubkey (buff 33)))
  (ok (map-get? accounts pubkey))
)

(define-read-only (get-account-count)
  (ok (var-get account-count))
)
