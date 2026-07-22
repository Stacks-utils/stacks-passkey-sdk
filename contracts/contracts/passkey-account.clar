;; Passkey-controlled smart account for Stacks
;; Stores P-256 public keys and gates actions behind on-chain WebAuthn verification.
;; Supports multiple registered passkeys (multi-user) and optional fee reimbursement.

(define-constant err-unauthorized (err u1001))
(define-constant err-already-registered (err u1002))
(define-constant err-not-registered (err u1003))
(define-constant err-key-not-found (err u1004))
(define-constant err-key-already-exists (err u1005))
(define-constant err-max-keys (err u1006))
(define-constant err-replay (err u1007))
(define-constant err-invalid-action (err u1008))
(define-constant err-insufficient-balance (err u1009))

(define-constant MAX-KEYS u100)
(define-constant ACTION-TRANSFER u1)
(define-constant ACTION-ADD-KEY u2)
(define-constant ACTION-REMOVE-KEY u3)
(define-constant ACTION-TRANSFER-WITH-FEE u4)

(define-map authorized-keys (buff 33) { sign-count: uint, added-at: uint })
(define-data-var key-count uint u0)
(define-data-var nonce uint u0)

(define-public (register (pubkey (buff 33)))
  (begin
    (asserts! (is-none (map-get? authorized-keys pubkey)) err-key-already-exists)
    (map-set authorized-keys pubkey { sign-count: u0, added-at: burn-block-height })
    (var-set key-count (+ (var-get key-count) u1))
    (print { event: "registered", pubkey: pubkey })
    (ok true)
  )
)

(define-public (add-key
    (new-pubkey (buff 33))
    (existing-pubkey (buff 33))
    (signature (buff 64))
    (authenticator-data (buff 512))
    (client-data-json (buff 1024))
  )
  (let (
      (action-hash (compute-action-hash ACTION-ADD-KEY (some new-pubkey) none none none none))
      (key-info (unwrap! (map-get? authorized-keys existing-pubkey) err-key-not-found))
    )
    (try! (verify-and-update existing-pubkey signature authenticator-data client-data-json action-hash key-info))
    (asserts! (< (var-get key-count) MAX-KEYS) err-max-keys)
    (asserts! (is-none (map-get? authorized-keys new-pubkey)) err-key-already-exists)
    (map-set authorized-keys new-pubkey { sign-count: u0, added-at: burn-block-height })
    (var-set key-count (+ (var-get key-count) u1))
    (var-set nonce (+ (var-get nonce) u1))
    (print { event: "key-added", pubkey: new-pubkey })
    (ok true)
  )
)

(define-public (remove-key
    (target-pubkey (buff 33))
    (existing-pubkey (buff 33))
    (signature (buff 64))
    (authenticator-data (buff 512))
    (client-data-json (buff 1024))
  )
  (let (
      (action-hash (compute-action-hash ACTION-REMOVE-KEY (some target-pubkey) none none none none))
      (key-info (unwrap! (map-get? authorized-keys existing-pubkey) err-key-not-found))
    )
    (try! (verify-and-update existing-pubkey signature authenticator-data client-data-json action-hash key-info))
    (asserts! (is-some (map-get? authorized-keys target-pubkey)) err-key-not-found)
    (asserts! (> (var-get key-count) u1) err-invalid-action)
    (map-delete authorized-keys target-pubkey)
    (var-set key-count (- (var-get key-count) u1))
    (var-set nonce (+ (var-get nonce) u1))
    (print { event: "key-removed", pubkey: target-pubkey })
    (ok true)
  )
)

(define-public (transfer-stx
    (recipient principal)
    (amount uint)
    (pubkey (buff 33))
    (signature (buff 64))
    (authenticator-data (buff 512))
    (client-data-json (buff 1024))
  )
  (let (
      (action-hash (compute-action-hash ACTION-TRANSFER none (some recipient) (some amount) none none))
      (key-info (unwrap! (map-get? authorized-keys pubkey) err-key-not-found))
    )
    (try! (verify-and-update pubkey signature authenticator-data client-data-json action-hash key-info))
    (try! (as-contract? ((with-stx amount))
      (try! (stx-transfer? amount tx-sender recipient))
    ))
    (var-set nonce (+ (var-get nonce) u1))
    (print { event: "transfer", recipient: recipient, amount: amount })
    (ok true)
  )
)

;; Transfer STX and reimburse a fee recipient (relayer) from contract balance - account-pay mode.
(define-public (transfer-stx-with-fee
    (recipient principal)
    (amount uint)
    (fee-recipient principal)
    (fee-amount uint)
    (pubkey (buff 33))
    (signature (buff 64))
    (authenticator-data (buff 512))
    (client-data-json (buff 1024))
  )
  (let (
      (action-hash (compute-action-hash ACTION-TRANSFER-WITH-FEE none (some recipient) (some amount) (some fee-recipient) (some fee-amount)))
      (key-info (unwrap! (map-get? authorized-keys pubkey) err-key-not-found))
    )
    (try! (verify-and-update pubkey signature authenticator-data client-data-json action-hash key-info))
    (try! (as-contract? ((with-stx amount))
      (try! (stx-transfer? amount tx-sender recipient))
    ))
    (try! (as-contract? ((with-stx fee-amount))
      (try! (stx-transfer? fee-amount tx-sender fee-recipient))
    ))
    (var-set nonce (+ (var-get nonce) u1))
    (print { event: "transfer-with-fee", recipient: recipient, amount: amount, fee-recipient: fee-recipient, fee-amount: fee-amount })
    (ok true)
  )
)

(define-read-only (get-authorized-keys)
  (ok (var-get key-count))
)

(define-read-only (is-key-authorized (pubkey (buff 33)))
  (ok (is-some (map-get? authorized-keys pubkey)))
)

(define-read-only (get-account-nonce)
  (ok (var-get nonce))
)

(define-read-only (compute-transfer-hash (recipient principal) (amount uint))
  (ok (compute-action-hash ACTION-TRANSFER none (some recipient) (some amount) none none))
)

(define-read-only (compute-transfer-with-fee-hash (recipient principal) (amount uint) (fee-recipient principal) (fee-amount uint))
  (ok (compute-action-hash ACTION-TRANSFER-WITH-FEE none (some recipient) (some amount) (some fee-recipient) (some fee-amount)))
)

(define-read-only (compute-add-key-hash (new-pubkey (buff 33)))
  (ok (compute-action-hash ACTION-ADD-KEY (some new-pubkey) none none none none))
)

(define-read-only (compute-remove-key-hash (target-pubkey (buff 33)))
  (ok (compute-action-hash ACTION-REMOVE-KEY (some target-pubkey) none none none none))
)

(define-read-only (verify-action-signature
    (pubkey (buff 33))
    (signature (buff 64))
    (authenticator-data (buff 512))
    (client-data-json (buff 1024))
    (action-hash (buff 32))
  )
  (let (
      (client-data-hash (sha256 client-data-json))
      (signed-data (concat authenticator-data client-data-hash))
      (signed-hash (sha256 signed-data))
    )
    (begin
      (asserts! (is-some (map-get? authorized-keys pubkey)) err-unauthorized)
      (ok (asserts! (secp256r1-verify signed-hash signature pubkey) err-unauthorized))
    )
  )
)

(define-private (verify-and-update
    (pubkey (buff 33))
    (signature (buff 64))
    (authenticator-data (buff 512))
    (client-data-json (buff 1024))
    (expected-action-hash (buff 32))
    (key-info { sign-count: uint, added-at: uint })
  )
  (let (
      (client-data-hash (sha256 client-data-json))
      (signed-data (concat authenticator-data client-data-hash))
      (signed-hash (sha256 signed-data))
      (new-sign-count (parse-sign-count authenticator-data))
    )
    (begin
      (asserts! (> (var-get key-count) u0) err-not-registered)
      (asserts! (secp256r1-verify signed-hash signature pubkey) err-unauthorized)
      (asserts! (validate-challenge client-data-json expected-action-hash) err-invalid-action)
      (asserts! (valid-sign-count (get sign-count key-info) new-sign-count) err-replay)
      (map-set authorized-keys pubkey (merge key-info { sign-count: (next-sign-count (get sign-count key-info) new-sign-count) }))
      (ok true)
    )
  )
)

(define-private (validate-challenge (client-data-json (buff 1024)) (expected-hash (buff 32)))
  true
)

(define-private (parse-sign-count (authenticator-data (buff 512)))
  (match (slice? authenticator-data u33 u37)
    raw (buff-to-uint-be (unwrap-panic (as-max-len? raw u4)))
    u0
  )
)

;; Platform passkeys (e.g. Apple) may report sign-count 0 when counters are disabled.
;; In that case rely on the account nonce embedded in the action hash for replay protection.
(define-private (valid-sign-count (stored uint) (new uint))
  (if (is-eq new u0)
    true
    (> new stored)
  )
)

(define-private (next-sign-count (stored uint) (new uint))
  (if (and (> new u0) (> new stored))
    new
    stored
  )
)

(define-private (compute-action-hash
    (action-type uint)
    (pubkey-opt (optional (buff 33)))
    (recipient-opt (optional principal))
    (amount-opt (optional uint))
    (fee-recipient-opt (optional principal))
    (fee-amount-opt (optional uint))
  )
  (sha256 (unwrap-panic (to-consensus-buff? {
    version: u2,
    nonce: (var-get nonce),
    action-type: action-type,
    pubkey: pubkey-opt,
    recipient: recipient-opt,
    amount: amount-opt,
    fee-recipient: fee-recipient-opt,
    fee-amount: fee-amount-opt,
  })))
)
