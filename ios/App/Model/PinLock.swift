import CryptoKit
import Foundation
import Security

/// The optional 4-digit PIN in front of the ways out: ending a session early, switching protections
/// off, signing out. Kept in this device's Keychain as a salted hash, never the digits.
///
/// Forgetting it is allowed, slowly: "Forgot it?" starts a 24-hour wait, then the PIN switches off by
/// itself. Long enough for the urge to pass, short enough that nobody's locked out for good.
enum PinLock {
    static let length = 4
    static let resetWait: TimeInterval = 24 * 3600

    private static let service = "com.focuznow.pin"
    private static let account = "pin"
    private static let resetKey = "pinResetAt"

    static var isSet: Bool {
        finishResetIfDue()
        return stored != nil
    }

    static func set(_ pin: String) {
        var salt = Data(count: 16)
        _ = salt.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 16, $0.baseAddress!) }
        write(salt + hash(pin, salt: salt))
        cancelReset()
    }

    static func check(_ pin: String) -> Bool {
        guard let data = stored, data.count > 16 else { return false }
        let salt = data.prefix(16)
        return hash(pin, salt: salt) == data.dropFirst(16)
    }

    static func clear() {
        SecItemDelete(query as CFDictionary)
        cancelReset()
    }

    // MARK: Forgot it

    /// When the PIN switches off by itself, if "Forgot it?" was used.
    static var resetAt: Date? { UserDefaults.standard.object(forKey: resetKey) as? Date }

    static func startReset() {
        guard resetAt == nil else { return }
        UserDefaults.standard.set(Date.now.addingTimeInterval(resetWait), forKey: resetKey)
    }

    static func cancelReset() {
        UserDefaults.standard.removeObject(forKey: resetKey)
    }

    private static func finishResetIfDue() {
        if let at = resetAt, at <= .now { clear() }
    }

    // MARK: Keychain

    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }

    private static var stored: Data? {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(request as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    private static func write(_ data: Data) {
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }

    private static func hash(_ pin: String, salt: Data) -> Data {
        Data(SHA256.hash(data: salt + Data(pin.utf8)))
    }
}
