import LocalAuthentication
import SwiftUI
import UIKit

/// FocuzPass (spec §4.10): locked with Face ID, then a list and item detail. On iPad the split
/// view shows list and detail side by side (Clean Desk).
struct PassView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if model.vaultUnlocked {
            PassBrowser()
                .transition(.opacity)
        } else {
            PassLock()
                .transition(.opacity)
        }
    }
}

private struct PassLock: View {
    @Environment(AppModel.self) private var model
    @State private var error: String?

    var body: some View {
        ZStack {
            SkyBackground(mood: .night)
            VStack(spacing: 18) {
                Spacer()
                ZStack {
                    Circle().fill(Theme.beamGradient).frame(width: 120, height: 120).blur(radius: 40).opacity(0.7)
                    Image(systemName: "lock.fill")
                        .font(.system(size: 52, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 104, height: 104)
                        .fzGlass(in: RoundedRectangle(cornerRadius: 30, style: .continuous))
                }
                Text("FocuzPass").font(.system(size: 32, weight: .bold)).foregroundStyle(Color.fzInk)
                Text("Your passwords, encrypted on this device.\nOnly you can open them.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.fzInk2)
                if let error {
                    Text(error).font(.footnote).foregroundStyle(Theme.warn)
                }
                Spacer()
                Button { Task { await unlock() } } label: {
                    Label("Unlock with Face ID", systemImage: "faceid")
                }
                .buttonStyle(.beam)
                Button("Use master password") { withAnimation(.smooth) { model.vaultUnlocked = true } }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.fzInk2)
                    .padding(.bottom, 20)
            }
            .frame(maxWidth: 460)
            .padding(.horizontal, 24)
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    @MainActor
    private func unlock() async {
        let context = LAContext()
        do {
            let ok = try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Unlock FocuzPass")
            if ok { withAnimation(.smooth) { model.vaultUnlocked = true } }
        } catch {
            self.error = "Couldn't unlock: \(error.localizedDescription)"
        }
    }
}

private struct PassBrowser: View {
    enum Filter: String, CaseIterable { case all = "All", favorites = "Favorites", work = "Work", personal = "Personal" }

    @Environment(AppModel.self) private var model
    @State private var selection: VaultEntry.ID?
    @State private var search = ""
    @State private var filter: Filter = .all

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Section {
                    ScrollView(.horizontal) {
                        HStack(spacing: 8) {
                            ForEach(Filter.allCases, id: \.self) { item in
                                Button { withAnimation(.smooth) { filter = item } } label: {
                                    Chip(title: item.rawValue, selected: item == filter)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .scrollIndicators(.hidden)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                }
                Section {
                    ForEach(items) { entry in
                        HStack(spacing: 12) {
                            EntryTile(entry: entry, size: 40)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(entry.title).font(.headline).foregroundStyle(Color.fzInk)
                                Text(entry.username).font(.subheadline).foregroundStyle(Color.fzInk3)
                            }
                            Spacer()
                            if entry.favorite {
                                Image(systemName: "star.fill").font(.caption).foregroundStyle(Theme.gold)
                            }
                        }
                        .padding(.vertical, 4)
                        .tag(entry.id)
                        .listRowBackground(Color.fzSurface)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background { SkyBackground(mood: .night) }
            .navigationTitle("Pass")
            .searchable(text: $search, prompt: "Search your vault")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { withAnimation(.smooth) { model.vaultUnlocked = false } } label: {
                        Image(systemName: "lock")
                    }
                    .accessibilityLabel("Lock FocuzPass")
                }
            }
        } detail: {
            if let id = selection, let entry = model.vault.first(where: { $0.id == id }) {
                EntryDetail(entry: entry)
            } else {
                ContentUnavailableView("Pick an item", systemImage: "key.fill", description: Text("Its details show here."))
                    .background { SkyBackground(mood: .night) }
            }
        }
    }

    private var items: [VaultEntry] {
        model.vault.filter { entry in
            let matchesFilter: Bool
            switch filter {
            case .all: matchesFilter = true
            case .favorites: matchesFilter = entry.favorite
            case .work: matchesFilter = entry.vault == "Work"
            case .personal: matchesFilter = entry.vault == "Personal"
            }
            let query = search.trimmingCharacters(in: .whitespaces).lowercased()
            return matchesFilter && (query.isEmpty || entry.title.lowercased().contains(query) || entry.username.lowercased().contains(query))
        }
    }
}

struct EntryTile: View {
    let entry: VaultEntry
    var size: CGFloat = 40

    var body: some View {
        switch entry.kind {
        case .card:
            Text("AMEX")
                .font(.system(size: size * 0.24, weight: .heavy))
                .foregroundStyle(.white)
                .frame(width: size * 1.3, height: size)
                .background(Color(hex: 0x1F6FD6), in: RoundedRectangle(cornerRadius: size * 0.2, style: .continuous))
        case .wifi:
            Image(systemName: "wifi.router")
                .font(.system(size: size * 0.42))
                .foregroundStyle(Color.fzInk)
                .frame(width: size, height: size)
                .fzSurface(cornerRadius: size * 0.28)
        default:
            LetterTile(title: entry.title, size: size)
        }
    }
}

private struct EntryDetail: View {
    let entry: VaultEntry
    @State private var revealed = false
    @State private var copied: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack(spacing: 16) {
                    EntryTile(entry: entry, size: 64)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(entry.title).font(.system(size: 30, weight: .bold)).foregroundStyle(Color.fzInk)
                        Label(entry.vault, systemImage: "lock.square.fill").font(.subheadline).foregroundStyle(Color.fzInk3)
                    }
                }
                VStack(spacing: 0) {
                    field("Username", entry.username, copyValue: entry.username)
                    if entry.kind == .passkey {
                        Divider().overlay(Color.fzLine)
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                SectionLabel("Passkey")
                                Text("Signs in with Face ID").foregroundStyle(Color.fzInk)
                            }
                            Spacer()
                            Image(systemName: "person.badge.key.fill").font(.title2).foregroundStyle(Theme.beamGradient)
                        }
                        .padding(16)
                    } else {
                        Divider().overlay(Color.fzLine)
                        HStack {
                            VStack(alignment: .leading, spacing: 6) {
                                SectionLabel(entry.kind == .card ? "Card number" : "Password")
                                Text(revealed ? entry.secret : String(repeating: "•", count: 14))
                                    .font(.system(.body, design: .monospaced))
                                    .foregroundStyle(Color.fzInk)
                                    .contentTransition(.opacity)
                            }
                            Spacer()
                            Button { withAnimation(.smooth) { revealed.toggle() } } label: {
                                Image(systemName: revealed ? "eye.slash" : "eye")
                            }
                            copyButton(entry.secret, key: "secret")
                        }
                        .padding(16)
                        if entry.kind == .login {
                            StrengthBar(value: entry.strength)
                                .padding(.horizontal, 16)
                                .padding(.bottom, 16)
                        }
                    }
                }
                .fzSurface()
                if let website = entry.website {
                    Link(destination: URL(string: "https://\(website)")!) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                SectionLabel("Website")
                                Text(website).foregroundStyle(Color.fzInk)
                            }
                            Spacer()
                            Image(systemName: "arrow.up.right").foregroundStyle(Color.fzInk3)
                        }
                        .padding(16)
                        .fzSurface()
                    }
                }
            }
            .padding(20)
            .frame(maxWidth: 640, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background { SkyBackground(mood: .night) }
        .navigationBarTitleDisplayMode(.inline)
        .overlay(alignment: .bottom) {
            if copied != nil {
                Label("Copied", systemImage: "checkmark.circle.fill")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .fzGlass(in: Capsule())
                    .padding(.bottom, 20)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .sensoryFeedback(.success, trigger: copied)
    }

    private func field(_ label: String, _ value: String, copyValue: String) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                SectionLabel(label)
                Text(value).foregroundStyle(Color.fzInk)
            }
            Spacer()
            copyButton(copyValue, key: label)
        }
        .padding(16)
    }

    private func copyButton(_ value: String, key: String) -> some View {
        Button {
            UIPasteboard.general.setItems([[UIPasteboard.typeAutomatic: value]], options: [.expirationDate: Date.now.addingTimeInterval(90), .localOnly: true])
            withAnimation(.smooth) { copied = key }
            Task {
                try? await Task.sleep(for: .seconds(1.6))
                withAnimation(.smooth) { copied = nil }
            }
        } label: {
            Image(systemName: "doc.on.doc")
        }
        .padding(.leading, 12)
        .accessibilityLabel("Copy \(key)")
    }
}

struct StrengthBar: View {
    let value: Double

    var body: some View {
        HStack(spacing: 10) {
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.fzLine)
                    Capsule().fill(color).frame(width: proxy.size.width * value)
                }
            }
            .frame(height: 6)
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(color)
        }
    }

    private var color: Color { value > 0.8 ? Theme.good : value > 0.5 ? Theme.warn : Theme.danger }
    private var label: String { value > 0.8 ? "Strong" : value > 0.5 ? "Fair" : "Weak" }
}
