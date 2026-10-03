import SwiftUI

/// AI coach (spec §4.11): a calm empty state, messages that rise in, a slide-out library of
/// chats, and a model picker. Mock replies until Phase 4 wires `ai-coach-chat`.
struct CoachView: View {
    @Environment(AppModel.self) private var model
    @State private var draft = ""
    @State private var thinking = false
    @State private var showLibrary = false
    @State private var showModels = false
    @FocusState private var focused: Bool

    private let suggestions = ["Plan my afternoon", "Why do I keep getting distracted?", "Quiz me on chapter 4", "Make a study schedule"]

    var body: some View {
        ZStack(alignment: .leading) {
            SkyBackground(mood: .night, intensity: 0.7)

            VStack(spacing: 0) {
                topBar
                if let conversation = model.currentConversation {
                    thread(conversation)
                } else {
                    emptyState
                }
                composer
            }
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)

            if showLibrary {
                Color.black.opacity(0.45)
                    .ignoresSafeArea()
                    .onTapGesture { withAnimation(.smooth) { showLibrary = false } }
                    .transition(.opacity)
                ChatLibrary(close: { withAnimation(.smooth) { showLibrary = false } })
                    .transition(.move(edge: .leading))
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showModels) {
            ModelPicker().environment(model).presentationDetents([.height(360)])
        }
    }

    private var topBar: some View {
        HStack {
            GlassCircleButton(symbol: "line.3.horizontal", size: 44) {
                focused = false
                withAnimation(.smooth) { showLibrary = true }
            }
            .accessibilityLabel("Chats")
            Spacer()
            Button { showModels = true } label: {
                HStack(spacing: 6) {
                    Text("Coach").foregroundStyle(Color.fzInk)
                    Text(model.coachModel.title).foregroundStyle(Color.fzInk3)
                    Image(systemName: "chevron.down").font(.caption.weight(.bold)).foregroundStyle(Color.fzInk3)
                }
                .font(.headline)
            }
            .buttonStyle(.plain)
            Spacer()
            GlassCircleButton(symbol: "square.and.pencil", size: 44) {
                withAnimation(.smooth) { model.newChat() }
            }
            .accessibilityLabel("New chat")
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
    }

    private var emptyState: some View {
        VStack(spacing: 18) {
            Spacer()
            FocusField(focus: 1, lights: 24, markScale: 0.5)
                .frame(width: 90, height: 90)
                .riseIn()
            Text("Ready when you are, \(model.userName)")
                .font(.system(size: 28, weight: .semibold))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.fzInk)
                .riseIn(delay: 0.15)
            Spacer()
            ScrollView(.horizontal) {
                HStack(spacing: 10) {
                    ForEach(Array(suggestions.enumerated()), id: \.element) { index, suggestion in
                        Button { send(suggestion) } label: {
                            Text(suggestion)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.fzInk)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 11)
                                .fzGlass(in: Capsule(), interactive: true)
                        }
                        .buttonStyle(.plain)
                        .riseIn(delay: 0.3 + 0.08 * Double(index))
                    }
                }
                .padding(.horizontal, 20)
            }
            .scrollIndicators(.hidden)
            .padding(.bottom, 10)
        }
        .id(model.currentConversationID)
    }

    private func thread(_ conversation: Conversation) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    ForEach(conversation.messages) { message in
                        Bubble(message: message)
                            .id(message.id)
                            .transition(.blurRise)
                    }
                    if thinking {
                        ThinkingLine().id("thinking").transition(.blurRise)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
                .animation(.smooth(duration: 0.5), value: conversation.messages.count)
                .animation(.smooth(duration: 0.5), value: thinking)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .defaultScrollAnchor(.bottom)
            .onChange(of: conversation.messages.count) {
                if let last = conversation.messages.last?.id { withAnimation(.smooth) { proxy.scrollTo(last, anchor: .bottom) } }
            }
        }
    }

    private var composer: some View {
        HStack(spacing: 10) {
            Button {} label: {
                Image(systemName: "plus").font(.title3).foregroundStyle(Color.fzInk2)
            }
            .accessibilityLabel("Attach")
            TextField("Ask anything", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .focused($focused)
                .foregroundStyle(Color.fzInk)
                .onSubmit { send(draft) }
            Button { send(draft) } label: {
                Image(systemName: draft.isEmpty ? "waveform" : "arrow.up")
                    .font(.headline)
                    .foregroundStyle(draft.isEmpty ? Color.fzInk : Color.fzBg)
                    .frame(width: 38, height: 38)
                    .background(draft.isEmpty ? AnyShapeStyle(Color.fzSurface) : AnyShapeStyle(Color.fzInk), in: Circle())
                    .contentTransition(.symbolEffect(.replace))
            }
            .accessibilityLabel(draft.isEmpty ? "Voice" : "Send")
        }
        .padding(.leading, 18)
        .padding(.trailing, 8)
        .padding(.vertical, 8)
        .fzGlass(in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .animation(.smooth(duration: 0.25), value: draft.isEmpty)
    }

    private func send(_ text: String) {
        let message = text
        draft = ""
        guard !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        Task {
            thinking = true
            await model.send(message)
            thinking = false
        }
    }
}

private struct Bubble: View {
    let message: ChatMessage

    var body: some View {
        if message.role == .user {
            HStack {
                Spacer(minLength: 60)
                Text(message.text)
                    .foregroundStyle(Color.fzInk)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Color.fzSurface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            }
        } else {
            // Coach replies sit on the page, no bubble, like reading.
            Text(LocalizedStringKey(message.text))
                .font(.body)
                .lineSpacing(4)
                .foregroundStyle(Color.fzInk)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// "Thinking": the focus lights gathering, then a shimmer on the word.
private struct ThinkingLine: View {
    var body: some View {
        HStack(spacing: 10) {
            FocusField(focus: 0.55, lights: 12, markScale: 0.4)
                .frame(width: 28, height: 28)
            Text("Thinking")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.fzInk3)
                .phaseAnimator([0.35, 1.0]) { text, phase in
                    text.opacity(phase)
                } animation: { _ in .easeInOut(duration: 0.8) }
        }
    }
}

/// The slide-out library: new chat, search, and past chats grouped by when.
private struct ChatLibrary: View {
    @Environment(AppModel.self) private var model
    let close: () -> Void
    @State private var search = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Coach").font(.title2.weight(.bold)).foregroundStyle(Color.fzInk)
                Spacer()
                GlassCircleButton(symbol: "xmark", size: 38, action: close)
            }
            .padding(.bottom, 14)

            row("square.and.pencil", "New chat", highlighted: true) {
                model.newChat()
                close()
            }
            HStack(spacing: 14) {
                Image(systemName: "magnifyingglass").foregroundStyle(Color.fzInk2).frame(width: 26)
                TextField("Search chats", text: $search).foregroundStyle(Color.fzInk)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)

            SectionLabel("Recent").padding(.top, 18).padding(.leading, 14)
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(Array(filtered.enumerated()), id: \.element.id) { index, conversation in
                        Button {
                            model.currentConversationID = conversation.id
                            close()
                        } label: {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(conversation.title).font(.body).foregroundStyle(Color.fzInk).lineLimit(1)
                                Text(conversation.updated, format: .relative(presentation: .named)).font(.caption).foregroundStyle(Color.fzInk3)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(conversation.id == model.currentConversationID ? Color.fzSurface : .clear, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .riseIn(delay: 0.04 * Double(index))
                    }
                }
            }
            .scrollIndicators(.hidden)
            Spacer(minLength: 0)
            HStack(spacing: 12) {
                Avatar(name: model.userName, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(model.userName).font(.headline).foregroundStyle(Color.fzInk)
                    Text(model.isPro ? "Pro" : "Free").font(.caption).foregroundStyle(Color.fzInk3)
                }
            }
            .padding(14)
        }
        .padding(16)
        .frame(width: 320)
        .frame(maxHeight: .infinity)
        .background(Color.fzBg.opacity(0.96))
        .overlay(alignment: .trailing) { Rectangle().fill(Color.fzLine).frame(width: 1) }
        .ignoresSafeArea(edges: .bottom)
    }

    private var filtered: [Conversation] {
        let query = search.trimmingCharacters(in: .whitespaces).lowercased()
        let sorted = model.conversations.sorted { $0.updated > $1.updated }
        return query.isEmpty ? sorted : sorted.filter { $0.title.lowercased().contains(query) }
    }

    private func row(_ symbol: String, _ title: String, highlighted: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: symbol).foregroundStyle(Color.fzInk).frame(width: 26)
                Text(title).foregroundStyle(Color.fzInk)
                Spacer()
            }
            .font(.body.weight(.medium))
            .padding(14)
            .background(highlighted ? Color.fzSurface : .clear, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}

/// Pick the coach's model: cards with what each is good at.
private struct ModelPicker: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Choose a model").font(.title3.weight(.bold)).padding(.bottom, 4)
            ForEach(CoachModel.allCases) { option in
                Button {
                    withAnimation(.smooth) { model.coachModel = option }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { dismiss() }
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: option.symbol)
                            .font(.title3)
                            .foregroundStyle(option == model.coachModel ? Theme.accent : Color.fzInk2)
                            .frame(width: 30)
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Text(option.title).font(.headline).foregroundStyle(Color.fzInk)
                                if option.needsPro && !model.isPro {
                                    Text("PRO").font(.caption2.weight(.heavy)).foregroundStyle(Color.fzBg)
                                        .padding(.horizontal, 6).padding(.vertical, 2)
                                        .background(Theme.accent, in: Capsule())
                                }
                            }
                            Text(option.detail).font(.subheadline).foregroundStyle(Color.fzInk3)
                        }
                        Spacer()
                        if option == model.coachModel {
                            Image(systemName: "checkmark.circle.fill").font(.title3).foregroundStyle(Color.fzInk)
                                .transition(.scale.combined(with: .opacity))
                        }
                    }
                    .padding(16)
                    .background(Color.fzSurface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(option == model.coachModel ? Color.fzInk.opacity(0.4) : Color.fzLine))
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(24)
        .presentationBackground(.ultraThinMaterial)
        .sensoryFeedback(.selection, trigger: model.coachModel)
    }
}
