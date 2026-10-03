import CryptoKit
import XCTest
@testable import FocuzNowKit

/// The phone must open vaults the browser extension made. `Fixtures/vault-v1.json` was written by
/// `src/src/lib/focuzPass/iosFixture.test.ts` (test master password, made-up logins).
final class VaultCryptoTests: XCTestCase {
    private struct Fixture: Decodable {
        struct Expected: Decodable {
            let title: String
            let identity: String
            let domain: String
            let password: String
            let note: String
        }
        let masterPassword: String
        let meta: VaultMeta
        let blob: EncryptedPayload
        let expect: [Expected]
    }

    private func fixture() throws -> Fixture {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "vault-v1", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
    }

    func testOpensAVaultMadeByTheExtension() throws {
        let fixture = try fixture()
        let key = try VaultCrypto.unlockVaultKey(masterPassword: fixture.masterPassword, meta: fixture.meta)
        let document = try VaultCrypto.openString(fixture.blob, key: key)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(document.utf8)) as? [String: Any])
        let items = try XCTUnwrap(json["items"] as? [[String: Any]])
        XCTAssertEqual(items.count, fixture.expect.count)

        for expected in fixture.expect {
            let item = try XCTUnwrap(items.first { $0["title"] as? String == expected.title }, "missing \(expected.title)")
            XCTAssertEqual(item["identity"] as? String, expected.identity)
            XCTAssertEqual(item["domain"] as? String, expected.domain)
            let password = try payload(item["password"])
            XCTAssertEqual(try VaultCrypto.openString(password, key: key), expected.password)
            if expected.note.isEmpty {
                XCTAssertNil(item["notes"])
            } else {
                XCTAssertEqual(try VaultCrypto.openString(try payload(item["notes"]), key: key), expected.note)
            }
        }
    }

    func testWrongMasterPasswordIsRefused() throws {
        let fixture = try fixture()
        XCTAssertThrowsError(try VaultCrypto.unlockVaultKey(masterPassword: "not the password", meta: fixture.meta)) { error in
            XCTAssertEqual(error as? VaultCryptoError, .wrongPassword)
        }
    }

    func testSealedDataOpensAndTamperingIsCaught() throws {
        let key = SymmetricKey(size: .bits256)
        let sealed = try VaultCrypto.seal(Data("hello focuz".utf8), key: key, associatedData: Data("ctx".utf8))
        XCTAssertEqual(String(data: try VaultCrypto.open(sealed, key: key, associatedData: Data("ctx".utf8)), encoding: .utf8), "hello focuz")
        XCTAssertThrowsError(try VaultCrypto.open(sealed, key: key, associatedData: Data("other".utf8)))
        var bytes = try XCTUnwrap(Data(base64Encoded: sealed.ct))
        bytes[0] ^= 0x01
        XCTAssertThrowsError(try VaultCrypto.open(EncryptedPayload(iv: sealed.iv, ct: bytes.base64EncodedString()), key: key))
    }

    private func payload(_ value: Any?) throws -> EncryptedPayload {
        let object = try XCTUnwrap(value as? [String: Any])
        return EncryptedPayload(iv: try XCTUnwrap(object["iv"] as? String), ct: try XCTUnwrap(object["ct"] as? String))
    }
}
