import SwiftUI

struct TodayView: View {
    @Binding var showYou: Bool
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        ScrollView {
            // iPhone: one column. iPad (regular width): a dashboard grid, like the web dashboard.
            LazyVGrid(columns: sizeClass == .regular ? [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)] : [GridItem(.flexible())], spacing: 16) {
                FZCard {
                    Text("Today's focus").font(.headline).foregroundStyle(Color.fzText2)
                    Text("0 min").font(.system(size: 44, weight: .bold, design: .rounded)).foregroundStyle(Color.fzText1)
                    Text("Goal 2 h · streak 0 days").font(.subheadline).foregroundStyle(Color.fzText3)
                }
                FZCard {
                    Text("Up next").font(.headline).foregroundStyle(Color.fzText2)
                    Label("Calendar and to-dos sync in Phase 3", systemImage: "calendar").foregroundStyle(Color.fzText3)
                }
            }
            .padding(16)
        }
        .background(Color.fzBg)
        .safeAreaInset(edge: .bottom) {
            Button {
                // Phase 2: start a focus session.
            } label: {
                Label("Start focus", systemImage: "bolt.fill")
                    .font(.headline)
                    .frame(maxWidth: 360)
                    .padding(.vertical, 6)
            }
            .fzGlassButton(prominent: true)
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
        .navigationTitle("Today")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { showYou = true } label: {
                    Image(systemName: "person.crop.circle").font(.title3)
                }
                .accessibilityLabel("You")
            }
        }
    }
}
