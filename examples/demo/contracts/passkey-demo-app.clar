;; Example app contract - see examples/demo/README.md
(impl-trait .passkey-adapter.passkey-exec-trait)

(define-constant ERR-UNKNOWN-FUNCTION (err u9001))
(define-constant ERR-MISSING-ARG (err u9002))

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
    (asserts!
      (or
        (is-eq function-name "set-score")
        (is-eq function-name "add-score")
        (is-eq function-name "reset-score")
      )
      ERR-UNKNOWN-FUNCTION
    )
    (if (is-eq function-name "reset-score")
      (begin
        (map-set user-scores arg2 u0)
        (ok u0)
      )
      (if (is-eq function-name "set-score")
        (begin
          (asserts! (> arg0 u0) ERR-MISSING-ARG)
          (map-set user-scores arg2 arg0)
          (print { event: "set-score", user: arg2, score: arg0, caller: contract-caller })
          (ok arg0)
        )
        (let (
            (delta (if (is-eq arg0 u0) u1 arg0))
            (current (default-to u0 (map-get? user-scores arg2)))
            (next (+ current delta))
          )
          (begin
            (map-set user-scores arg2 next)
            (print { event: "add-score", user: arg2, delta: delta, caller: contract-caller })
            (ok next)
          )
        )
      )
    )
  )
)

(define-read-only (get-score (user principal))
  (ok (default-to u0 (map-get? user-scores user)))
)
