import SwiftUI

/// The running session (spec §4.7): your photo or a scene fills the top, blurring progressively
/// into a dark panel that holds the clock, one clean progress track and the controls.
struct ActiveSessionView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var confirmEnd = false
    @State private var editing = false
    @State private var editingBreak = false
    @State private var customizing = false

    var body: some View {
        ZStack {
            if let session = model.session {
                running(session)
                    .transition(.opacity)
            } else if let done = model.completed {
                SessionCompleteView(result: done, close: {
                    model.completed = nil
                    dismiss()
                }, again: {
                    model.completed = nil
                    model.startSession()
                })
                .transition(.blurRise)
            } else {
                Color.black.onAppear { dismiss() }
            }
        }
        .animation(.smooth(duration: 0.7), value: model.session == nil)
        .preferredColorScheme(.dark)
        .sheet(isPresented: $editing) { EditSessionSheet().environment(model).presentationDetents([.medium]) }
        .sheet(isPresented: $editingBreak) { BreakSheet().environment(model).presentationDetents([.height(340)]) }
        .sheet(isPresented: $customizing) { NavigationStack { CustomizeView() }.environment(model) }
    }

    private func running(_ session: FocusSession) -> some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let now = context.date
            let onBreak = session.isOnBreak(at: now)
            ZStack(alignment: .bottom) {
                SessionBackdrop(progress: session.progress(at: now))

                VStack(spacing: 0) {
                    HStack {
                        GlassCircleButton(symbol: "chevron.down", size: 42) { dismiss() }
                        Spacer()
                        GlassCircleButton(symbol: "paintbrush", size: 42) { customizing = true }
                    }
                    .padding(.horizontal, 20)
                    Spacer()
                    if onBreak {
                        breakPanel(session, now: now)
                            .transition(.blurRise)
                    } else {
                        panel(session, now: now)
                            .transition(.blurRise)
                    }
                }
                .frame(maxWidth: 560)
                .animation(.smooth(duration: 0.6), value: onBreak)
            }
        }
        .confirmationDialog("End this session early?", isPresented: $confirmEnd, titleVisibility: .visible) {
            Button("End session", role: .destructive) { withAnimation { model.endSession(completedFully: false) } }
            Button("Keep focusing", role: .cancel) {}
        } message: {
            Text("Your focused time still counts, but your tree won't grow.")
        }
    }

    private func panel(_ session: FocusSession, now: Date) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Spacer()
                Button { editing = true } label: {
                    Label("Edit session", systemImage: "pencil")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .fzGlass(in: Capsule(), interactive: true)
                }
                .buttonStyle(.plain)
            }
            .padding(.bottom, 14)

            Label(session.title, systemImage: session.symbol)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(.white)

            SessionClock(remaining: session.remaining(at: now), progress: session.progress(at: now), style: model.timerStyle)
                .padding(.top, 6)

            SessionProgress(progress: session.progress(at: now))
                .padding(.top, 18)
            HStack {
                Text(session.start, style: .time)
                Spacer()
                Text(session.end, style: .time)
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(.white.opacity(0.6))
            .padding(.top, 8)

            HStack(spacing: 12) {
                card(title: "Block list", action: {}) {
                    AppStack(apps: model.blockedApps, size: 24, limit: 4)
                }
                card(title: "Breaks", action: { editingBreak = true }) {
                    Text(session.difficulty == .lockedIn ? "Locked in" : "\(Int(session.breakLength / 60)) min")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
            .padding(.top, 20)

            if session.difficulty != .lockedIn {
                Button("Take a break") { withAnimation(.smooth) { model.takeBreak() } }
                    .buttonStyle(.beam)
                    .padding(.top, 20)
                Button("Leave early") { confirmEnd = true }
                    .font(.headline)
                    .foregroundStyle(Theme.danger)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            } else {
                Label("Locked in until \(session.end.formatted(date: .omitted, time: .shortened))", systemImage: "lock.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.6))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 26)
            }
        }
        .padding(.horizontal, 22)
        .padding(.bottom, 6)
    }

    private func breakPanel(_ session: FocusSession, now: Date) -> some View {
        let left = session.breakRemaining(at: now)
        let fraction = left / max(1, session.breakLength)
        return VStack(spacing: 22) {
            ZStack {
                Circle().stroke(.white.opacity(0.12), lineWidth: 8)
                Circle()
                    .trim(from: 0, to: fraction)
                    .stroke(Theme.accent, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .shadow(color: Theme.accent.opacity(0.7), radius: 10)
                VStack(spacing: 4) {
                    SectionLabel("Break")
                    Text(FocusSession.clock(left))
                        .font(.fzHero(52))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .contentTransition(.numericText())
                }
            }
            .frame(width: 220, height: 220)
            Text("Stretch, drink some water, look outside.\nYour apps stay blocked.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.7))
            Button("Back to focus") { withAnimation(.smooth) { model.endBreak() } }
                .buttonStyle(.beam)
        }
        .padding(.horizontal, 22)
        .padding(.bottom, 30)
    }

    private func card<Content: View>(title: String, action: @escaping () -> Void, @ViewBuilder content: () -> Content) -> some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 8) {
                    Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    content()
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(.white.opacity(0.5))
            }
            .padding(14)
            .frame(maxWidth: .infinity)
            .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(0.12)))
        }
        .buttonStyle(.plain)
    }
}

/// The background of a session: your photo or a scene, blurring progressively into black.
struct SessionBackdrop: View {
    @Environment(AppModel.self) private var model
    var progress: Double = 0

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                content
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped()
                // Progressive blur: the same picture, blurred, fading in toward the bottom.
                content
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped()
                    .blur(radius: 30)
                    .mask(LinearGradient(stops: [.init(color: .clear, location: 0.38), .init(color: .black, location: 0.6)], startPoint: .top, endPoint: .bottom))
                LinearGradient(stops: [
                    .init(color: .clear, location: 0.3),
                    .init(color: .black.opacity(0.45), location: 0.55),
                    .init(color: .black.opacity(0.9), location: 1),
                ], startPoint: .top, endPoint: .bottom)
            }
        }
        .ignoresSafeArea()
    }

    @ViewBuilder
    private var content: some View {
        switch model.sessionBackground {
        case .photo:
            if let photo = model.backgroundPhoto {
                Image(uiImage: photo).resizable().scaledToFill()
            } else {
                LandscapeScene(kind: .nightLake, progress: progress)
            }
        case .scene(let kind):
            LandscapeScene(kind: kind, progress: progress)
        }
    }
}

/// The countdown, in the style picked in Customize.
struct SessionClock: View {
    let remaining: TimeInterval
    let progress: Double
    let style: TimerStyle

    var body: some View {
        switch style {
        case .big:
            Text(FocusSession.clock(remaining))
                .font(.system(size: 64, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.white)
                .contentTransition(.numericText(countsDown: true))
        case .minimal:
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("Remaining").font(.title3).foregroundStyle(.white.opacity(0.55))
                Text(FocusSession.clock(remaining))
                    .font(.fzNumber(28))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                    .contentTransition(.numericText(countsDown: true))
            }
        case .ring:
            HStack(spacing: 16) {
                ZStack {
                    Circle().stroke(.white.opacity(0.14), lineWidth: 6)
                    Circle()
                        .trim(from: 0, to: 1 - progress)
                        .stroke(Theme.accent, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }
                .frame(width: 58, height: 58)
                Text(FocusSession.clock(remaining))
                    .font(.fzNumber(40))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                    .contentTransition(.numericText(countsDown: true))
            }
        }
    }
}

/// One clean track: the filled part in the accent light, a glowing head at "now". No ticks under it.
struct SessionProgress: View {
    let progress: Double

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let filled = max(6, width * min(1, max(0, progress)))
            ZStack(alignment: .leading) {
                Capsule().fill(.white.opacity(0.14)).frame(height: 6)
                Capsule().fill(Theme.accent).frame(width: filled, height: 6)
                Circle()
                    .fill(.white)
                    .frame(width: 14, height: 14)
                    .shadow(color: Theme.accent.opacity(0.9), radius: 8)
                    .offset(x: min(width - 14, max(0, filled - 7)))
            }
            .frame(height: 14)
        }
        .frame(height: 14)
        .accessibilityElement()
        .accessibilityLabel("Session progress")
        .accessibilityValue("\(Int(progress * 100)) percent")
    }
}

private struct EditSessionSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Edit session").font(.title2.weight(.bold))
            SectionLabel("Add time")
            HStack(spacing: 10) {
                ForEach([5, 10, 15, 30], id: \.self) { minutes in
                    Button("+\(minutes) min") {
                        model.extendSession(minutes: minutes)
                        dismiss()
                    }
                    .buttonStyle(.glassPill)
                }
            }
            if model.session?.difficulty == .lockedIn {
                Label("Locked in: you can add time, not take it away.", systemImage: "lock.fill")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(24)
        .presentationBackground(.ultraThinMaterial)
    }
}

private struct BreakSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var minutes = 5

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Breaks").font(.title2.weight(.bold))
            HStack {
                Text("\(minutes) min")
                    .font(.fzNumber(44))
                    .contentTransition(.numericText())
                Spacer()
                Stepper("", value: $minutes, in: 1...30)
                    .labelsHidden()
            }
            Button("Save") {
                model.setBreakLength(minutes: minutes)
                dismiss()
            }
            .buttonStyle(.beam)
            .disabled(model.session?.difficulty == .lockedIn)
            Spacer()
        }
        .padding(24)
        .presentationBackground(.ultraThinMaterial)
        .onAppear { minutes = Int((model.session?.breakLength ?? 300) / 60) }
        .animation(.snappy, value: minutes)
    }
}

struct SessionCompleteView: View {
    let result: CompletedSession
    let close: () -> Void
    let again: () -> Void

    @State private var focus = 0.2

    var body: some View {
        ZStack {
            SkyBackground(mood: .night, intensity: 1.4)
            VStack(spacing: 18) {
                Spacer()
                FocusField(focus: focus)
                    .frame(width: 280, height: 280)
                VStack(spacing: 6) {
                    Text("\(result.minutes) minutes")
                        .font(.fzHero(52))
                        .foregroundStyle(.white)
                        .riseIn(delay: 0.9)
                    Text("of \(result.title.lowercased()), in focus.")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.7))
                        .riseIn(delay: 1.1)
                }
                HStack(spacing: 10) {
                    if result.coins > 0 {
                        Chip(title: "+\(result.coins) coins", symbol: "circle.hexagongrid.fill")
                        Chip(title: "A tree grew", symbol: "tree.fill")
                    }
                    Chip(title: String(format: "Score %.1f → %.1f", result.scoreBefore, result.scoreAfter), symbol: "sparkles")
                }
                .riseIn(delay: 1.4)
                Spacer()
                HStack(spacing: 12) {
                    Button("Done", action: close).buttonStyle(.glassPill)
                    Button("Another", action: again).buttonStyle(.beam)
                }
                .frame(maxWidth: 520)
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
                .riseIn(delay: 1.7)
            }
        }
        .sensoryFeedback(.success, trigger: focus)
        .onAppear { withAnimation(.smooth(duration: 1.6)) { focus = 1 } }
    }
}
