import SwiftUI

/// AI coach chat (spec §4.11). Mock replies until Phase 4 wires the `ai-coach-chat` function.
struct CoachView: View {
    @Environment(AppModel.self) private var model
    @State private var draft = ""
    @State private var thinking = false
    @FocusState private var focused: Bool

    private let suggestions = ["Plan my afternoon", "Why do I keep getting distracted?", "Quiz me on chapter 4", "Make a study schedule"]

    var body: some View {
        ZStack {
            SkyBackground(mood: .violet)
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack(spacing: 10) {
                            Image(systemName: "sparkles")
                                .font(.title2)
                                .foregroundStyle(Theme.beamGradient)
                            Text("Coach").font(.system(size: 34, weight: .bold)).foregroundStyle(Color.fzInk)
                            Spacer()
                            Menu {
                                Button("Flash · fast") {}
                                Button("Pro · thinks deeper") {}
                            } label: {
                                Label("Flash", systemImage: "chevron.down")
                                    .labelStyle(.titleAndIcon)
                                    .font(.subheadline.weight(.semibold))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .fzGlass(in: Capsule())
                            }
                        }
                        .padding(.top, 8)

                        ForEach(model.chat) { message in
                            Bubble(message: message)
                                .id(message.id)
                                .transition(.move(edge: .bottom).combined(with: .opacity))
                        }
                        if thinking {
                            TypingDots().id("typing")
                        }
                        if model.chat.count <= 1 {
                            FlowChips(items: suggestions) { suggestion in send(suggestion) }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 120)
                    .frame(maxWidth: 720)
                    .frame(maxWidth: .infinity)
                }
                .scrollIndicators(.hidden)
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: model.chat.count) {
                    if let last = model.chat.last?.id { withAnimation(.smooth) { proxy.scrollTo(last, anchor: .bottom) } }
                }
            }
        }
        .safeAreaInset(edge: .bottom) { composer }
        .toolbar(.hidden, for: .navigationBar)
    }

    private var composer: some View {
        HStack(spacing: 10) {
            TextField("Ask anything…", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .focused($focused)
                .foregroundStyle(Color.fzInk)
                .onSubmit { send(draft) }
            Button { send(draft) } label: {
                Image(systemName: "arrow.up")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(draft.isEmpty ? AnyShapeStyle(Color.fzInk3) : AnyShapeStyle(Theme.beamGradient), in: Circle())
            }
            .disabled(draft.isEmpty)
            .accessibilityLabel("Send")
        }
        .padding(.leading, 18)
        .padding(.trailing, 8)
        .padding(.vertical, 8)
        .fzGlass(in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .frame(maxWidth: 720)
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    private func send(_ text: String) {
        let message = text
        draft = ""
        guard !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        Task {
            withAnimation(.smooth) { thinking = true }
            await model.send(message)
            withAnimation(.smooth) { thinking = false }
        }
    }
}

private struct Bubble: View {
    let message: ChatMessage

    var body: some View {
        if message.role == .user {
            HStack {
                Spacer(minLength: 50)
                Text(message.text)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Theme.beamGradient, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            }
        } else {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "sparkles")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(width: 28, height: 28)
                    .background(Theme.beamGradient, in: Circle())
                Text(LocalizedStringKey(message.text))
                    .foregroundStyle(Color.fzInk)
                    .padding(16)
                    .fzSurface(cornerRadius: 22)
                Spacer(minLength: 20)
            }
        }
    }
}

private struct TypingDots: View {
    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color.fzInk2)
                    .frame(width: 8, height: 8)
                    .phaseAnimator([0.3, 1]) { dot, phase in
                        dot.opacity(phase)
                    } animation: { _ in .easeInOut(duration: 0.5).delay(Double(index) * 0.15) }
            }
        }
        .padding(16)
        .fzSurface(cornerRadius: 22)
        .padding(.leading, 38)
    }
}

/// Wrapping suggestion chips.
private struct FlowChips: View {
    let items: [String]
    let tap: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(items, id: \.self) { item in
                Button { tap(item) } label: {
                    Text(item)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.fzInk)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 11)
                        .fzGlass(in: Capsule(), interactive: true)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.leading, 38)
    }
}
