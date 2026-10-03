import SwiftUI

/// The running session, full screen (spec §4.7), and the celebration when it ends (§4.8).
struct ActiveSessionView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var confirmEnd = false
    @State private var holdingBreak = false

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
                .transition(.opacity.combined(with: .scale(scale: 1.04)))
            } else {
                Color.black.onAppear { dismiss() }
            }
        }
        .animation(.smooth(duration: 0.6), value: model.session == nil)
        .preferredColorScheme(.dark)
        .statusBarHidden(false)
    }

    private func running(_ session: FocusSession) -> some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let now = context.date
            let onBreak = session.isOnBreak(at: now)
            ZStack {
                LandscapeScene(kind: onBreak ? .desertDusk : model.scene, progress: session.progress(at: now))
                LinearGradient(colors: [.clear, .black.opacity(0.25), .black.opacity(0.78)], startPoint: .top, endPoint: .bottom)
                    .ignoresSafeArea()

                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        GlassCircleButton(symbol: "chevron.down", size: 42) { dismiss() }
                        Spacer()
                        GlassCircleButton(symbol: "questionmark", size: 42) {}
                    }
                    Spacer()

                    if onBreak {
                        breakPanel(session, now: now)
                    } else {
                        HStack {
                            Spacer()
                            Label("Edit session", systemImage: "pencil")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 9)
                                .fzGlass(in: Capsule())
                        }
                        .padding(.bottom, 14)

                        Label(session.title, systemImage: session.symbol)
                            .font(.system(size: 30, weight: .bold))
                            .foregroundStyle(.white)
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("Remaining").font(.title3).foregroundStyle(.white.opacity(0.6))
                            Text(FocusSession.clock(session.remaining(at: now)))
                                .font(.fzNumber(30, weight: .heavy))
                                .monospacedDigit()
                                .foregroundStyle(.white)
                                .contentTransition(.numericText())
                        }
                        .padding(.top, 2)

                        TickTimeline(progress: session.progress(at: now))
                            .frame(height: 30)
                            .padding(.top, 18)
                        HStack {
                            Text(session.start, style: .time)
                            Spacer()
                            Text(session.end, style: .time)
                        }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white.opacity(0.75))
                        .padding(.top, 6)

                        HStack(spacing: 12) {
                            infoCard(title: "Block list") {
                                AppStack(apps: model.blockedApps, size: 26, limit: 4)
                            }
                            infoCard(title: "Difficulty") {
                                Label(session.difficulty.title, systemImage: session.difficulty.symbol)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.white)
                            }
                        }
                        .padding(.top, 22)

                        if session.difficulty != .lockedIn {
                            Button {
                                withAnimation(.smooth) { model.takeBreak() }
                            } label: {
                                Text(session.difficulty == .normal && holdingBreak ? "Hold on…" : "Take a break")
                            }
                            .buttonStyle(.beam)
                            .padding(.top, 22)

                            Button("End early") { confirmEnd = true }
                                .font(.headline)
                                .foregroundStyle(Theme.danger)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                        } else {
                            Label("Locked in until \(session.end.formatted(date: .omitted, time: .shortened))", systemImage: "lock.fill")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white.opacity(0.7))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 26)
                        }
                    }
                }
                .frame(maxWidth: 560)
                .padding(.horizontal, 22)
                .padding(.bottom, 8)
            }
        }
        .confirmationDialog("End this session early?", isPresented: $confirmEnd, titleVisibility: .visible) {
            Button("End session", role: .destructive) { withAnimation { model.endSession(completedFully: false) } }
            Button("Keep focusing", role: .cancel) {}
        } message: {
            Text("Your focused time so far still counts, but you won't grow a tree.")
        }
    }

    private func breakPanel(_ session: FocusSession, now: Date) -> some View {
        let left = session.breakRemaining(at: now)
        let fraction = left / max(1, session.breakLength)
        return VStack(spacing: 22) {
            ZStack {
                Circle().stroke(.white.opacity(0.15), lineWidth: 10)
                Circle()
                    .trim(from: 0, to: fraction)
                    .stroke(Theme.goldGradient, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 4) {
                    SectionLabel("On a break")
                    Text(FocusSession.clock(left))
                        .font(.fzHero(54))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .contentTransition(.numericText())
                }
            }
            .frame(width: 230, height: 230)
            Text("Stretch, drink some water, look outside. Your apps stay blocked.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.75))
            Button("Back to focus") { withAnimation(.smooth) { model.endBreak() } }
                .buttonStyle(.beam)
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, 30)
    }

    private func infoCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 8) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                content()
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(.white.opacity(0.6))
        }
        .padding(14)
        .frame(maxWidth: .infinity)
        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(0.14)))
    }
}

/// A timeline of ticks with a glowing fill and a knob at "now".
struct TickTimeline: View {
    let progress: Double

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let knobX = max(6, min(width - 6, width * progress))
            ZStack(alignment: .leading) {
                Capsule().fill(.white.opacity(0.10)).frame(height: 22)
                HStack(spacing: 0) {
                    ForEach(0..<12, id: \.self) { index in
                        Rectangle().fill(.white.opacity(0.18)).frame(width: 1, height: 12)
                        if index < 11 { Spacer(minLength: 0) }
                    }
                }
                .padding(.horizontal, 14)
                Capsule()
                    .fill(Theme.beamGradient)
                    .frame(width: max(22, width * progress), height: 22)
                    .shadow(color: Theme.violet.opacity(0.6), radius: 8)
                Capsule()
                    .fill(.white)
                    .frame(width: 4, height: 30)
                    .shadow(color: .white.opacity(0.8), radius: 6)
                    .offset(x: knobX - 2)
            }
            .frame(maxHeight: .infinity)
        }
        .accessibilityElement()
        .accessibilityLabel("Session progress")
        .accessibilityValue("\(Int(progress * 100)) percent")
    }
}

struct SessionCompleteView: View {
    let result: CompletedSession
    let close: () -> Void
    let again: () -> Void

    @State private var fill = 0.3
    @State private var burst = false

    var body: some View {
        ZStack {
            SkyBackground(mood: .violet)
            VStack(spacing: 22) {
                Spacer()
                ZStack {
                    ForEach(0..<18, id: \.self) { index in
                        let angle = Double(index) / 18 * 2 * .pi
                        Image(systemName: "sparkle")
                            .font(.system(size: index.isMultiple(of: 3) ? 16 : 10))
                            .foregroundStyle(index.isMultiple(of: 2) ? Theme.coral : Theme.gold)
                            .offset(x: cos(angle) * (burst ? 170 : 20), y: sin(angle) * (burst ? 170 : 20))
                            .opacity(burst ? 0 : 1)
                    }
                    BeamView(fill: fill, score: result.scoreAfter, active: true)
                }
                VStack(spacing: 6) {
                    Text("\(result.minutes) minutes")
                        .font(.fzHero(54))
                        .foregroundStyle(.white)
                    Text("of \(result.title.lowercased()) 🎉")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.8))
                }
                HStack(spacing: 10) {
                    if result.coins > 0 {
                        Chip(title: "+\(result.coins) coins", symbol: "circle.hexagongrid.fill")
                        Chip(title: "A tree grew", symbol: "tree.fill")
                    }
                    Chip(title: String(format: "Score %.1f → %.1f", result.scoreBefore, result.scoreAfter), symbol: "sparkles")
                }
                .environment(\.colorScheme, .dark)
                Spacer()
                HStack(spacing: 12) {
                    Button("Done", action: close).buttonStyle(.glassPill)
                    Button("Another", action: again).buttonStyle(.beam)
                }
                .frame(maxWidth: 520)
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
            }
        }
        .sensoryFeedback(.success, trigger: burst)
        .onAppear {
            withAnimation(.smooth(duration: 1.2)) { fill = 0.9 }
            withAnimation(.easeOut(duration: 1.3).delay(0.3)) { burst = true }
        }
    }
}
