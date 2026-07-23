;; Universal adapter - registry + forward to registered contracts implementing passkey-exec-trait.

(define-constant ERR-UNAUTHORIZED (err u2001))
(define-constant ERR-NOT-REGISTERED (err u2002))
(define-constant ERR-ALREADY-REGISTERED (err u2003))

(define-trait passkey-exec-trait
  (
    (passkey-exec ((string-ascii 128) uint uint principal principal (buff 1024)) (response uint uint))
  )
)

(define-map registry principal { registered: bool, registered-at: uint })
(define-data-var registrar principal tx-sender)
(define-data-var registry-count uint u0)

(define-public (set-registrar (new-registrar principal))
  (begin
    (asserts! (is-eq tx-sender (var-get registrar)) ERR-UNAUTHORIZED)
    (var-set registrar new-registrar)
    (ok true)
  )
)

(define-public (register-contract (target principal))
  (begin
    (asserts! (is-eq tx-sender (var-get registrar)) ERR-UNAUTHORIZED)
    (asserts! (is-none (map-get? registry target)) ERR-ALREADY-REGISTERED)
    (map-set registry target { registered: true, registered-at: burn-block-height })
    (var-set registry-count (+ (var-get registry-count) u1))
    (print { event: "registered", target: target })
    (ok true)
  )
)

(define-public (unregister-contract (target principal))
  (begin
    (asserts! (is-eq tx-sender (var-get registrar)) ERR-UNAUTHORIZED)
    (asserts! (is-some (map-get? registry target)) ERR-NOT-REGISTERED)
    (map-delete registry target)
    (var-set registry-count (- (var-get registry-count) u1))
    (print { event: "unregistered", target: target })
    (ok true)
  )
)

(define-read-only (is-registered (target principal))
  (ok (is-some (map-get? registry target)))
)

(define-read-only (get-registry-count)
  (ok (var-get registry-count))
)

(define-public (forward-invoke
    (target <passkey-exec-trait>)
    (function-name (string-ascii 128))
    (arg0 uint)
    (arg1 uint)
    (arg2 principal)
    (arg3 principal)
    (arg4 (buff 1024))
  )
  (let ((target-principal (contract-of target)))
    (begin
      (asserts! (is-some (map-get? registry target-principal)) ERR-NOT-REGISTERED)
      (try! (as-contract? ()
        (try! (contract-call? target passkey-exec function-name arg0 arg1 arg2 arg3 arg4))
      ))
      (print { event: "invoke", target: target-principal, function-name: function-name })
      (ok true)
    )
  )
)
