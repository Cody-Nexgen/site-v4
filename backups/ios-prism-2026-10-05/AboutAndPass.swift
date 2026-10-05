import SwiftUI

// MARK: Guest pass

/// Two weeks of Pro for a friend, as a pass you can pick up and tilt. The lighthouse lives inside it.
struct GuestPassView: View {
    @Environment(AppModel.self) private var model
    @State private var appeared = false
    @State private var sent = 0

    /// Stable for a name (Swift's hashValue changes every launch).
    private var passNumber: String {
        let hash = model.userName.lowercased().unicodeScalars.reduce(5381) { ($0 << 5) &+ $0 &+ Int($1.value) }
        return String(format: "%04d", hash.magnitude % 10000)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 26) {
                VStack(spacing: 8) {
                    SectionLabel("Guest pass")
                    Text("Give a friend two\nweeks of Pro.")
                        .font(.fzDisplay(32))
                        .fzTight(32)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Color.fzInk)
                }
                .padding(.top, 10)
                .riseIn()

                pass
                    .frame(width: 300, height: 430)
                    .tilt3D(maxAngle: 18)
                    .frame(width: 300, height: 430)
                    .rotation3DEffect(.degrees(appeared ? 0 : 75), axis: (x: 1, y: 0, z: 0), anchor: .bottom, perspective: 0.5)
                    .offset(y: appeared ? 0 : 80)
                    .opacity(appeared ? 1 : 0)
                    .phaseAnimator([0.0, 1.0]) { card, phase in
                        card.offset(y: phase * -6)
                    } animation: { _ in .easeInOut(duration: 2.4) }

                Text("Drag the pass to tilt it.")
                    .font(.footnote)
                    .foregroundStyle(Color.fzInk3)

                ShareLink(item: "\(model.userName) sent you two weeks of FocuzNow Pro. Open FocuzNow and enter pass code FZ-\(passNumber). Everything else can wait.") {
                    Label("Send the pass", systemImage: "paperplane.fill")
                }
                .buttonStyle(.beam)
                .simultaneousGesture(TapGesture().onEnded { sent += 1 })
                .padding(.horizontal, 24)
                .frame(maxWidth: 440)
            }
            .padding(.bottom, 30)
            .frame(maxWidth: .infinity)
        }
        .background(SkyBackground())
        .navigationTitle("Guest pass")
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.impact(weight: .medium), trigger: sent)
        .onAppear { withAnimation(.spring(duration: 0.9, bounce: 0.3).delay(0.15)) { appeared = true } }
    }

    private var pass: some View {
        VStack(spacing: 0) {
            LighthouseView(scene: LighthouseScene(power: 1.1, phase: 3.2, speed: 0.8, x: 0.62, waterline: 0.16, horizon: 0.22, scale: 0.95))
                .frame(height: 230)
                .overlay(alignment: .topLeading) {
                    HStack(spacing: 8) {
                        ZMark(size: 26).environment(\.colorScheme, .dark)
                        Text("FocuzNow").font(.fzDisplay(15, weight: .bold)).foregroundStyle(.white)
                    }
                    .padding(16)
                }
            // Perforation
            HStack(spacing: 6) {
                ForEach(0..<22, id: \.self) { _ in Circle().fill(Color.black.opacity(0.18)).frame(width: 4, height: 4) }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 14)
            .background(Color.fzBone)
            VStack(alignment: .leading, spacing: 6) {
                Text("GUEST PASS · NO. \(passNumber)")
                    .font(.caption2.weight(.semibold))
                    .tracking(1.6)
                    .foregroundStyle(Color.fzOnBone2)
                Text("Two weeks of Pro")
                    .font(.fzDisplay(28))
                    .fzTight(28)
                    .foregroundStyle(Color.fzOnBone)
                Text("Every scene, Coach Pro, and FocuzPass everywhere.")
                    .font(.footnote)
                    .foregroundStyle(Color.fzOnBone2)
                Spacer(minLength: 0)
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("FROM").font(.caption2.weight(.semibold)).tracking(1.4).foregroundStyle(Color.fzOnBone2)
                        Text(model.userName).font(.fzSignature(30)).foregroundStyle(Color.fzOnBone)
                    }
                    Spacer()
                    Text("VALID 14 DAYS").font(.caption2.weight(.semibold)).tracking(1.4).foregroundStyle(Color.fzOnBone2)
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Color.fzBone)
        }
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .shadow(color: .black.opacity(0.35), radius: 24, y: 18)
    }
}

// MARK: About

/// Who makes FocuzNow and why. Features rise in as you scroll; the team's signature writes itself.
struct AboutView: View {
    @State private var signed = false

    private let features: [(symbol: String, title: String, detail: String)] = [
        ("shield.lefthalf.filled", "Block", "Apps and sites stay out of the way while you work."),
        ("timer", "Focus", "Sessions with real breaks, and an orb that charges while you work."),
        ("checklist", "Plan", "Your day, your lists, your deadlines, in one place."),
        ("key.fill", "FocuzPass", "Passwords and passkeys, encrypted so only you can read them."),
        ("sparkles", "Coach", "Ask anything. It's especially good at plans."),
        ("tree.fill", "Forest", "Every finished session grows a tree."),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                GeometryReader { proxy in
                    let minY = proxy.frame(in: .scrollView).minY
                    LighthouseView(scene: LighthouseScene(power: 1, phase: 3.3, x: 0.7, waterline: 0.2, horizon: 0.26, scale: 0.85))
                        .frame(height: 320 + max(0, minY))
                        .offset(y: minY > 0 ? -minY : -minY * 0.4)
                        .mask(LinearGradient(stops: [.init(color: .black, location: 0.65), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))
                }
                .frame(height: 320)

                VStack(alignment: .leading, spacing: 14) {
                    Text("Made for people with ten things pulling at them.")
                        .font(.fzDisplay(34))
                        .fzTight(34)
                        .foregroundStyle(Color.fzInk)
                    Text("Phones are built to keep you looking. FocuzNow is built to help you look away, get the thing done, and enjoy the rest of your day.")
                        .foregroundStyle(Color.fzInk2)
                }
                .padding(.horizontal, 22)
                .padding(.top, -20)
                .riseIn()

                VStack(spacing: 12) {
                    ForEach(features, id: \.title) { feature in
                        FeatureRow(symbol: feature.symbol, title: feature.title, detail: feature.detail)
                            .scrollRise()
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 30)

                VStack(alignment: .leading, spacing: 10) {
                    SectionLabel("From us")
                    Text("We made FocuzNow because we needed it too. Thanks for giving it a try. Now go do the thing.")
                        .font(.title3.weight(.medium))
                        .foregroundStyle(Color.fzOnBone)
                    Text("The FocuzNow team")
                        .font(.fzSignature(40))
                        .foregroundStyle(Color.fzOnBone)
                        .padding(.top, 6)
                        .writeOn(delay: 0.2, duration: 1.8)
                        .id(signed)
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fzBoneCard(cornerRadius: 24, padding: 6)
                .padding(.horizontal, 20)
                .padding(.top, 30)
                .onScrollVisibilityChange(threshold: 0.6) { visible in if visible { signed.toggle() } }

                Text("FocuzNow \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "") · Everything else can wait.")
                    .font(.footnote)
                    .foregroundStyle(Color.fzInk3)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 30)
            }
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .background(Color.fzBg)
        .ignoresSafeArea(edges: .top)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct FeatureRow: View {
    let symbol: String
    let title: String
    let detail: String
    @State private var bounce = false

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.fzBone)
                .frame(width: 42, height: 42)
                .background(Color.fzOnBone, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .symbolEffect(.bounce, value: bounce)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline).foregroundStyle(Color.fzInk)
                Text(detail).font(.subheadline).foregroundStyle(Color.fzInk2)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .fzSurface(cornerRadius: 20)
        .onScrollVisibilityChange(threshold: 0.8) { visible in if visible { bounce.toggle() } }
    }
}
