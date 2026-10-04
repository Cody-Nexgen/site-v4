import ActivityKit
import AppIntents
import SwiftUI
import UIKit
import WidgetKit

/// A running focus session in the Dynamic Island and on the Lock Screen. Black like the island,
/// white type, a bone progress line. The countdown runs by itself (`Text(timerInterval:)`).
struct FocusLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FocusActivityAttributes.self) { context in
            LockScreenFocusView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(.black)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let state = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text(state.phase == .onBreak ? "Break" : context.attributes.title)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)
                    } icon: {
                        Image(systemName: state.phase == .onBreak ? "cup.and.saucer.fill" : context.attributes.symbol)
                    }
                    .foregroundStyle(.white)
                    .padding(.leading, 6)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if state.locked > 0, state.phase == .focusing {
                        Label("\(state.locked) locked", systemImage: "lock.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.7))
                            .padding(.trailing, 6)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 10) {
                        FocusCountdown(state: state, size: 40)
                        if state.phase != .done {
                            FocusProgress(state: state)
                            FocusButtons()
                        }
                    }
                    .padding(.horizontal, 6)
                    .padding(.top, 4)
                }
            } compactLeading: {
                Image(systemName: state.phase == .done ? "checkmark" : state.phase == .onBreak ? "cup.and.saucer.fill" : context.attributes.symbol)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
            } compactTrailing: {
                if state.phase == .done {
                    Text("\(state.minutes)m")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white)
                } else {
                    Text(timerInterval: state.start...state.end, countsDown: true)
                        .font(.caption.weight(.bold))
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .frame(width: 44)
                        .foregroundStyle(.white)
                }
            } minimal: {
                if state.phase == .done {
                    Image(systemName: "checkmark").font(.caption.weight(.bold)).foregroundStyle(.white)
                } else {
                    ProgressView(timerInterval: state.start...state.end, countsDown: true) {
                        EmptyView()
                    } currentValueLabel: {
                        Image(systemName: context.attributes.symbol).font(.system(size: 9, weight: .bold))
                    }
                    .progressViewStyle(.circular)
                    .tint(Color(red: 0.925, green: 0.910, blue: 0.875))
                }
            }
            .keylineTint(.white)
        }
    }
}

// MARK: Lock Screen

private struct LockScreenFocusView: View {
    let attributes: FocusActivityAttributes
    let state: FocusActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: state.phase == .done ? "checkmark" : state.phase == .onBreak ? "cup.and.saucer.fill" : attributes.symbol)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.black)
                    .frame(width: 34, height: 34)
                    .background(Bone.card, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                VStack(alignment: .leading, spacing: 0) {
                    Text(caption.uppercased())
                        .font(.caption2.weight(.semibold))
                        .tracking(1.2)
                        .foregroundStyle(.white.opacity(0.55))
                    FocusCountdown(state: state, size: 30)
                }
                Spacer(minLength: 0)
                if state.locked > 0, state.phase == .focusing {
                    Label("\(state.locked)", systemImage: "lock.fill")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(.white.opacity(0.12), in: Capsule())
                }
            }
            if state.phase != .done {
                FocusProgress(state: state)
                FocusButtons()
            } else {
                Text("Everything else can come back now.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
        .padding(16)
    }

    private var caption: String {
        switch state.phase {
        case .focusing: "Focusing · \(attributes.title)"
        case .onBreak: "Break"
        case .done: "Done · \(attributes.title)"
        }
    }
}

// MARK: Pieces

private enum Bone {
    static let card = Color(red: 0.925, green: 0.910, blue: 0.875)
}

/// Satoshi when the font is in the extension, otherwise a heavy system face.
private func displayFont(_ size: CGFloat) -> Font {
    UIFont(name: "Satoshi-Black", size: size) != nil ? .custom("Satoshi-Black", size: size) : .system(size: size, weight: .heavy)
}

private struct FocusCountdown: View {
    let state: FocusActivityAttributes.ContentState
    let size: CGFloat

    var body: some View {
        Group {
            if state.phase == .done {
                Text("\(state.minutes) min")
            } else {
                Text(timerInterval: state.start...state.end, countsDown: true)
                    .monospacedDigit()
            }
        }
        .font(displayFont(size))
        .tracking(-size * 0.03)
        .foregroundStyle(.white)
        .lineLimit(1)
    }
}

private struct FocusProgress: View {
    let state: FocusActivityAttributes.ContentState

    var body: some View {
        ProgressView(timerInterval: state.start...state.end, countsDown: false) {
            EmptyView()
        } currentValueLabel: {
            EmptyView()
        }
        .progressViewStyle(.linear)
        .tint(Bone.card)
    }
}

private struct FocusButtons: View {
    var body: some View {
        HStack(spacing: 8) {
            Button(intent: EndFocusIntent()) {
                Text("End")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
            }
            .tint(.white.opacity(0.16))
            .foregroundStyle(.white)
            Button(intent: AddFiveMinutesIntent()) {
                Text("+5 min")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
            }
            .tint(.white)
            .foregroundStyle(.black)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.capsule)
    }
}
