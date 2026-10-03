import CommonCrypto
import CryptoKit
import Foundation

/// An AES-GCM result as FocuzPass stores it: base64 nonce (12 bytes) and base64 ciphertext with the
/// 16-byte tag on the end (WebCrypto's layout). Same JSON as `EncryptedPayload` in `src/src/lib/focuzPass/types.ts`.
public struct EncryptedPayload: Codable, Equatable, Sendable {
    public let iv: String
    public let ct: String

    public init(iv: String, ct: String) {
        self.iv = iv
        self.ct = ct
    }
}

/// The vault's setup record (`focuzpass.meta.v1`): either a wrapped vault key (version 2) or an
/// older verifier (version 1).
public struct VaultMeta: Codable, Equatable, Sendable {
    public let version: Int?
    public let salt: String
    public let kdf: String?
    public let iterations: Int?
    public let wrappedKey: EncryptedPayload?
    public let verifier: EncryptedPayload?
}

public enum VaultCryptoError: Error, Equatable {
    case badBase64
    case wrongPassword
    case unreadable
}

/// FocuzPass crypto, byte for byte the same as the browser extension (`crypto.ts`):
/// PBKDF2-SHA-256 (600,000 rounds) → a wrapping key → AES-GCM unwrap of the 256-bit vault key
/// (associated data "focuzpass:vault-key:v1") → AES-256-GCM for the vault and each secret.
public enum VaultCrypto {
    public static let defaultIterations = 600_000
    static let vaultKeyContext = "focuzpass:vault-key:v1"
    static let verifierPlaintext = "focuzpass.v1.ok"

    /// PBKDF2-HMAC-SHA-256 over the password's UTF-8 bytes (what WebCrypto's `importKey('raw', TextEncoder…)` uses).
    public static func deriveKey(password: String, salt: Data, iterations: Int) -> SymmetricKey {
        let passwordBytes = Array(password.utf8)
        var derived = [UInt8](repeating: 0, count: 32)
        let status = passwordBytes.withUnsafeBufferPointer { passwordPointer in
            salt.withUnsafeBytes { saltPointer in
                CCKeyDerivationPBKDF(
                    CCPBKDFAlgorithm(kCCPBKDF2),
                    passwordPointer.baseAddress.map { UnsafeRawPointer($0).assumingMemoryBound(to: CChar.self) },
                    passwordBytes.count,
                    saltPointer.bindMemory(to: UInt8.self).baseAddress,
                    salt.count,
                    CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                    UInt32(iterations),
                    &derived,
                    derived.count
                )
            }
        }
        precondition(status == kCCSuccess, "PBKDF2 failed")
        return SymmetricKey(data: derived)
    }

    /// Opens one AES-GCM payload. Throws when the key is wrong or the data was changed.
    public static func open(_ payload: EncryptedPayload, key: SymmetricKey, associatedData: Data? = nil) throws -> Data {
        guard let nonceData = Data(base64Encoded: payload.iv), let sealed = Data(base64Encoded: payload.ct), sealed.count >= 16 else {
            throw VaultCryptoError.badBase64
        }
        let box = try AES.GCM.SealedBox(
            nonce: AES.GCM.Nonce(data: nonceData),
            ciphertext: sealed.dropLast(16),
            tag: sealed.suffix(16)
        )
        if let associatedData {
            return try AES.GCM.open(box, using: key, authenticating: associatedData)
        }
        return try AES.GCM.open(box, using: key)
    }

    public static func openString(_ payload: EncryptedPayload, key: SymmetricKey) throws -> String {
        guard let text = String(data: try open(payload, key: key), encoding: .utf8) else { throw VaultCryptoError.unreadable }
        return text
    }

    /// Seals data the way the extension does: a fresh random 12-byte nonce, tag appended.
    public static func seal(_ plaintext: Data, key: SymmetricKey, associatedData: Data? = nil) throws -> EncryptedPayload {
        let nonce = AES.GCM.Nonce()
        let box = try associatedData.map { try AES.GCM.seal(plaintext, using: key, nonce: nonce, authenticating: $0) }
            ?? AES.GCM.seal(plaintext, using: key, nonce: nonce)
        return EncryptedPayload(
            iv: Data(box.nonce).base64EncodedString(),
            ct: (box.ciphertext + box.tag).base64EncodedString()
        )
    }

    /// The vault key for a master password, from either setup format.
    public static func unlockVaultKey(masterPassword: String, meta: VaultMeta) throws -> SymmetricKey {
        guard let salt = Data(base64Encoded: meta.salt) else { throw VaultCryptoError.badBase64 }
        let iterations = meta.iterations ?? defaultIterations
        // Same bounds the extension enforces, so a tampered record can't make this hang or go weak.
        guard (100_000...10_000_000).contains(iterations) else { throw VaultCryptoError.unreadable }
        let derived = deriveKey(password: masterPassword, salt: salt, iterations: iterations)
        if let wrapped = meta.wrappedKey {
            do {
                let raw = try open(wrapped, key: derived, associatedData: Data(vaultKeyContext.utf8))
                guard raw.count == 32 else { throw VaultCryptoError.unreadable }
                return SymmetricKey(data: raw)
            } catch VaultCryptoError.unreadable {
                throw VaultCryptoError.unreadable
            } catch {
                throw VaultCryptoError.wrongPassword
            }
        }
        if let verifier = meta.verifier {
            guard (try? openString(verifier, key: derived)) == verifierPlaintext else { throw VaultCryptoError.wrongPassword }
            return derived
        }
        throw VaultCryptoError.unreadable
    }
}
