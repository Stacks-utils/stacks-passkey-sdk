;; Internal test fixture only - not part of the SDK product surface.
(impl-trait .passkey-adapter.passkey-exec-trait)

(define-constant ERR-UNKNOWN-FUNCTION (err u9001))

(define-map user-scores principal uint)

(define-public (passkey-exec
    (function-name (string-ascii 128))
    (arg0 uint)
    (arg1 uint)
    (arg2 principal)
    (arg3 principal)
    (arg4 (buff 1024))
  )
  (begin
    (asserts! (is-eq function-name "set-score") ERR-UNKNOWN-FUNCTION)
    (map-set user-scores arg2 arg0)
    (ok arg0)
  )
)

(define-read-only (get-score (user principal))
  (ok (default-to u0 (map-get? user-scores user)))
)
