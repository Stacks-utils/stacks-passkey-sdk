;; WebAuthn / passkey signature verification for Clarity 5+
;; Requires Clarity 5 where secp256r1-verify verifies directly against the hash
;; (no double SHA-256). See SIP-035.

(define-constant err-invalid-signature (err u6001))
(define-constant err-user-not-present (err u6003))
(define-constant err-user-not-verified (err u6004))

(define-constant FLAG_UP u1)
(define-constant FLAG_UV u4)

(define-read-only (verify-webauthn-signature
    (signature (buff 64))
    (pubkey (buff 33))
    (authenticator-data (buff 512))
    (client-data-json (buff 1024))
  )
  (let (
      (client-data-hash (sha256 client-data-json))
      (signed-data (concat authenticator-data client-data-hash))
      (signed-hash (sha256 signed-data))
    )
    (ok (asserts! (secp256r1-verify signed-hash signature pubkey) err-invalid-signature))
  )
)

(define-read-only (verify-webauthn-signature-with-flags
    (signature (buff 64))
    (pubkey (buff 33))
    (authenticator-data (buff 512))
    (client-data-json (buff 1024))
    (require-user-present bool)
    (require-user-verified bool)
  )
  (let (
      (client-data-hash (sha256 client-data-json))
      (signed-data (concat authenticator-data client-data-hash))
      (signed-hash (sha256 signed-data))
      (flags-byte (get-flags-byte authenticator-data))
    )
    (asserts! (or (not require-user-present) (is-flag-set flags-byte FLAG_UP))
      err-user-not-present)
    (asserts! (or (not require-user-verified) (is-flag-set flags-byte FLAG_UV))
      err-user-not-verified)
    (ok (asserts! (secp256r1-verify signed-hash signature pubkey) err-invalid-signature))
  )
)

(define-read-only (compute-signed-hash
    (authenticator-data (buff 512))
    (client-data-json (buff 1024))
  )
  (let (
      (client-data-hash (sha256 client-data-json))
      (signed-data (concat authenticator-data client-data-hash))
    )
    (ok (sha256 signed-data))
  )
)

(define-read-only (get-sign-count (authenticator-data (buff 512)))
  (ok (unwrap-panic (slice? authenticator-data u33 u37)))
)

(define-private (get-flags-byte (authenticator-data (buff 512)))
  (match (slice? authenticator-data u32 u33)
    raw (buff-to-uint-be (unwrap-panic (as-max-len? raw u1)))
    u0
  )
)

(define-private (is-flag-set (flags uint) (flag uint))
  (> (bit-and flags flag) u0)
)
