import PhotosUI
import SwiftUI

// The pieces of the You tab (`AccountView`). Night colours throughout: the tab is part of Today's world.

// MARK: Sections and rows

/// A small caps title over a dark glass card of rows.
struct AccountSection<Content: View>: View {
    let title: String
    var footer: String?
    let content: Content

    init(_ title: String, footer: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.footer = footer
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .tracking(1.6)
                .foregroundStyle(.white.opacity(0.45))
                .padding(.leading, 6)
            VStack(spacing: 0) { content }
                .fzGlassCard(cornerRadius: 24, padding: 0)
            if let footer {
                Text(footer)
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.4))
                    .padding(.horizontal, 6)
            }
        }
    }
}

/// The icon tile at the start of a row. Lit (mint, glowing) while its switch is on.
struct AccountIcon: View {
    let symbol: String
    var tint: Color = .white
    var lit = false

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(lit ? Color.black : tint)
            .frame(width: 36, height: 36)
            .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(lit ? Color.fzMint : .white.opacity(0.06)))
            .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).strokeBorder(.white.opacity(lit ? 0 : 0.1)))
            .shadow(color: lit ? Color.fzMint.opacity(0.5) : .clear, radius: 8)
            .animation(.spring(duration: 0.35), value: lit)
    }
}

struct AccountRow: View {
    let symbol: String
    let title: String
    var detail: String?
    var value: String?
    var chevron = true
    var tint: Color = .white
    var busy = false

    var body: some View {
        HStack(spacing: 14) {
            AccountIcon(symbol: symbol, tint: tint)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(tint)
                if let detail {
                    Text(detail)
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.5))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 8)
            if busy {
                ProgressView().tint(.white)
            } else {
                if let value {
                    Text(value)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.5))
                }
                if chevron {
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.35))
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .contentShape(Rectangle())
    }
}

struct AccountToggleRow: View {
    let symbol: String
    let title: String
    var detail: String?
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            HStack(spacing: 14) {
                AccountIcon(symbol: symbol, lit: isOn)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                    if let detail {
                        Text(detail)
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.5))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .tint(Color.fzMint)
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .sensoryFeedback(.selection, trigger: isOn)
    }
}

struct AccountDivider: View {
    var body: some View {
        Rectangle()
            .fill(.white.opacity(0.07))
            .frame(height: 1)
            .padding(.leading, 66)
    }
}

/// A choice in a row of capsules: bone when picked.
struct AccountChip: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(selected ? Color.black : .white.opacity(0.8))
                .padding(.horizontal, 15)
                .frame(height: 36)
                .background(Capsule().fill(selected ? Color(hex: 0xEEF3EC) : .white.opacity(0.06)))
                .overlay(Capsule().strokeBorder(.white.opacity(selected ? 0 : 0.12)))
                .fzBottomGlow(strength: selected ? 0.6 : 0)
        }
        .buttonStyle(.pressable)
        .sensoryFeedback(.selection, trigger: selected)
        .animation(.spring(duration: 0.3), value: selected)
    }
}

// MARK: The profile

/// Your photo in a ring of the orb's light, with a camera badge (it opens the photo picker).
struct ProfilePhoto: View {
    let name: String
    let image: UIImage?
    var size: CGFloat = 104

    var body: some View {
        Avatar(name: name, size: size, image: image)
            .overlay(Circle().strokeBorder(.white.opacity(0.18), lineWidth: 1))
            .padding(5)
            .overlay(Circle().strokeBorder(LinearGradient(colors: [Color.fzMint, Color.fzMint.opacity(0.15)], startPoint: .top, endPoint: .bottom), lineWidth: 2))
            .background(Circle().fill(Color.fzMint.opacity(0.28)).blur(radius: 26))
            .overlay(alignment: .bottomTrailing) {
                Image(systemName: "camera.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.black)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(Color(hex: 0xEEF3EC)))
                    .overlay(Circle().strokeBorder(.black, lineWidth: 3))
            }
    }
}

/// The screen time you started with (the onboarding's first answer) next to today's so far.
struct StartedCard: View {
    let startedHours: Double
    let todayMinutes: Int
    let since: Date

    private var started: Int { Int((startedHours * 60).rounded()) }

    var body: some View {
        let top = Double(max(started, todayMinutes, 1))
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text("Where you started")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Text("Here since \(since.formatted(.dateTime.month(.abbreviated).year()))")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.45))
            }
            bar("When you joined", value: "\(GoalDial.format(started)) a day", fraction: Double(started) / top, fill: .white.opacity(0.3))
            bar("Today so far", value: GoalDial.format(todayMinutes), fraction: Double(todayMinutes) / top, fill: Color.fzMint)
            Text(verdict)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.62))
                .fixedSize(horizontal: false, vertical: true)
        }
        .fzGlassCard()
        .accessibilityElement(children: .combine)
    }

    private var verdict: String {
        let gap = started - todayMinutes
        if gap >= 60 { return "\(GoalDial.format(gap)) under where you started, so far. Past you would be impressed." }
        if gap > 0 { return "A little under where you started. Keep it there and that's a win." }
        return "Today's running past where you started. Tomorrow's a clean slate."
    }

    private func bar(_ title: String, value: String, fraction: Double, fill: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title).foregroundStyle(.white.opacity(0.55))
                Spacer()
                Text(value).fontWeight(.semibold).foregroundStyle(.white)
            }
            .font(.footnote)
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.07))
                    Capsule()
                        .fill(fill)
                        .frame(width: max(6, proxy.size.width * min(1, fraction)))
                        .shadow(color: fill.opacity(0.5), radius: 5)
                }
            }
            .frame(height: 6)
        }
    }
}

// MARK: The emergency pass

/// The emergency pass as a ticket you'd keep in a wallet: three a week, five minutes each.
struct EmergencyPassTicket: View {
    let holder: String
    let left: Int
    let nextBack: Date?
    let activeUntil: Date?
    let use: () -> Void

    /// The stub under the perforation.
    private let stub: CGFloat = 78

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("EMERGENCY PASS")
                        .font(.caption2.weight(.bold))
                        .tracking(1.8)
                        .foregroundStyle(Color.fzOnBone2)
                    Spacer()
                    Image(systemName: "ticket.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.fzOnBone)
                }
                Text("Five minutes.\nEverything.")
                    .font(.fzDisplay(30))
                    .fzTight(30)
                    .foregroundStyle(Color.fzOnBone)
                Text("For the real \"I actually need my phone\" moments. It all unlocks, then locks itself again. No lecture.")
                    .font(.footnote)
                    .foregroundStyle(Color.fzOnBone2)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(alignment: .top, spacing: 20) {
                    field("HOLDER", holder)
                    field("GOOD FOR", "\(EmergencyPass.minutes) min")
                    field("QUESTIONS", "None")
                }
                .padding(.top, 4)
            }
            .padding(18)
            .padding(.bottom, 4)

            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 7) {
                    HStack(spacing: 6) {
                        ForEach(0..<EmergencyPass.perWeek, id: \.self) { index in
                            Circle()
                                .fill(index < left ? Color.fzOnBone : .clear)
                                .overlay(Circle().strokeBorder(Color.fzOnBone.opacity(0.35), lineWidth: 1.5))
                                .frame(width: 12, height: 12)
                        }
                    }
                    Text(status)
                        .font(.caption)
                        .foregroundStyle(Color.fzOnBone2)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                Spacer(minLength: 8)
                Button(action: use) {
                    Text(activeUntil == nil ? "Use one" : "In use")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Color.fzBone)
                        .padding(.horizontal, 20)
                        .frame(height: 42)
                        .background(Capsule().fill(Color.fzOnBone))
                        .fzBottomGlow(Color(hex: 0xF2CC86), strength: left > 0 ? 0.9 : 0)
                }
                .buttonStyle(.pressable)
            }
            .padding(.horizontal, 18)
            .frame(height: stub)
        }
        .background(TicketShape(stubHeight: stub).fill(Color.fzBone))
        .overlay(alignment: .bottom) {
            // The perforation.
            Line()
                .stroke(Color.fzOnBone.opacity(0.2), style: StrokeStyle(lineWidth: 1.5, dash: [4, 5]))
                .frame(height: 1)
                .padding(.horizontal, 20)
                .padding(.bottom, stub)
        }
        .shadow(color: Color(hex: 0xF2CC86).opacity(0.18), radius: 24, y: 10)
        .accessibilityElement(children: .contain)
    }

    private var status: String {
        if let activeUntil { return "Running until \(activeUntil.formatted(date: .omitted, time: .shortened))" }
        if left == EmergencyPass.perWeek { return "\(left) of \(left) left this week" }
        let back = nextBack.map { " · next back \($0.formatted(.dateTime.weekday(.abbreviated)))" } ?? ""
        return "\(left) of \(EmergencyPass.perWeek) left\(back)"
    }

    private func field(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(Color.fzOnBone2)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.fzOnBone)
                .lineLimit(1)
        }
    }
}

/// A rounded ticket with a notch on each side at the top of the stub.
struct TicketShape: Shape {
    var stubHeight: CGFloat
    var radius: CGFloat = 24
    var notch: CGFloat = 11

    func path(in rect: CGRect) -> Path {
        let ticket = Path(roundedRect: rect, cornerRadius: radius, style: .continuous)
        let y = rect.maxY - stubHeight
        var notches = Path()
        notches.addEllipse(in: CGRect(x: rect.minX - notch, y: y - notch, width: notch * 2, height: notch * 2))
        notches.addEllipse(in: CGRect(x: rect.maxX - notch, y: y - notch, width: notch * 2, height: notch * 2))
        return ticket.subtracting(notches)
    }
}

private struct Line: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        return path
    }
}

// MARK: Autofocus

/// What an autofocus nudge looks like on the Lock Screen.
struct NudgePreview: View {
    let title: String
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            BeamZMark(size: 38)
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text("FocuzNow").font(.subheadline.weight(.semibold))
                    Spacer()
                    Text("now").font(.caption).foregroundStyle(.white.opacity(0.5))
                }
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.78))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .foregroundStyle(.white)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(.white.opacity(0.09)))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(.white.opacity(0.1)))
        .accessibilityElement(children: .combine)
    }
}

/// One of autofocus's two ways to step in.
struct AutofocusOption: View {
    let symbol: String
    let title: String
    let detail: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: symbol)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(selected ? Color.black : .white)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(selected ? Color.fzMint : .white.opacity(0.08)))
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(selected ? 0.08 : 0.03)))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(selected ? Color.fzMint.opacity(0.7) : .white.opacity(0.1), lineWidth: selected ? 1.5 : 1))
        }
        .buttonStyle(.pressable)
        .sensoryFeedback(.selection, trigger: selected)
        .animation(.spring(duration: 0.3), value: selected)
    }
}

// MARK: Editing the profile

/// Name, username, what you do, age, and the screen time you started with.
struct ProfileEditor: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var draft = UserProfile()
    @State private var age = ""
    @State private var photoItem: PhotosPickerItem?

    private let jobs = ["Student", "Work full-time", "Part-time", "Freelance", "Creator", "Figuring it out"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(spacing: 10) {
                        PhotosPicker(selection: $photoItem, matching: .images) {
                            ProfilePhoto(name: draft.name, image: model.profilePhoto, size: 88)
                        }
                        .buttonStyle(.pressable)
                        if model.profilePhoto != nil {
                            Button("Remove photo") { withAnimation(.smooth) { model.removeProfilePhoto() } }
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(.white.opacity(0.55))
                        }
                    }
                    .frame(maxWidth: .infinity)

                    field("Name") {
                        TextField("What should we call you?", text: $draft.name)
                            .textContentType(.givenName)
                    }
                    field("Username") {
                        HStack(spacing: 2) {
                            Text("@").foregroundStyle(.white.opacity(0.4))
                            TextField(String(draft.handle.dropFirst()), text: $draft.username)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .onChange(of: draft.username) { _, value in
                                    let clean = String(value.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "." }.prefix(20))
                                    if clean != value { draft.username = clean }
                                }
                        }
                    }
                    VStack(alignment: .leading, spacing: 10) {
                        field("What you do") {
                            TextField("Student, designer, nurse…", text: $draft.occupation)
                        }
                        FlowLayout(spacing: 8) {
                            ForEach(jobs, id: \.self) { job in
                                AccountChip(title: job, selected: draft.occupation == job) { draft.occupation = job }
                            }
                        }
                    }
                    field("Age") {
                        TextField("Optional", text: $age)
                            .keyboardType(.numberPad)
                            .onChange(of: age) { _, value in
                                let digits = String(value.filter(\.isNumber).prefix(3))
                                if digits != value { age = digits }
                            }
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("SCREEN TIME WHEN YOU STARTED")
                            .font(.caption2.weight(.semibold))
                            .tracking(1.6)
                            .foregroundStyle(.white.opacity(0.45))
                        HStack {
                            Text("\(GoalDial.format(Int(draft.phoneHours * 60))) a day")
                                .font(.fzDisplay(24, weight: .bold))
                                .foregroundStyle(.white)
                                .contentTransition(.numericText(value: draft.phoneHours))
                            Spacer()
                            Stepper("Hours a day", value: $draft.phoneHours, in: 0.5...16, step: 0.5)
                                .labelsHidden()
                        }
                        .padding(.horizontal, 16)
                        .frame(height: 60)
                        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.06)))
                        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(.white.opacity(0.12)))
                        Text("Your answer from the start. It's what the You tab measures you against, so be honest.")
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.4))
                    }
                }
                .padding(20)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Color(hex: 0x0B0C0D).ignoresSafeArea())
            .navigationTitle("Edit profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .fontWeight(.semibold)
                        .disabled(draft.name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .environment(\.colorScheme, .dark)
        .tint(Color.fzMint)
        .onAppear {
            draft = model.profile
            age = draft.age.map(String.init) ?? ""
        }
        .onChange(of: photoItem) { _, item in
            Task {
                if let data = try? await item?.loadTransferable(type: Data.self) {
                    withAnimation(.smooth) { model.setProfilePhoto(data) }
                }
            }
        }
    }

    private func save() {
        draft.name = draft.name.trimmingCharacters(in: .whitespaces)
        draft.occupation = draft.occupation.trimmingCharacters(in: .whitespaces)
        draft.age = Int(age).flatMap { (1...120).contains($0) ? $0 : nil }
        model.profile = draft
        dismiss()
    }

    private func field<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label.uppercased())
                .font(.caption2.weight(.semibold))
                .tracking(1.6)
                .foregroundStyle(.white.opacity(0.45))
            content()
                .font(.body)
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .frame(height: 52)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.06)))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(.white.opacity(0.12)))
        }
    }
}
