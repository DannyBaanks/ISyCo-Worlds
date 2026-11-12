import SwiftUI
import UIKit
import MunderMobileCore

// The app's look, from src/renderer/src/design/tokens.css: the --cth colours in
// light and dark, Press Start 2P for small-caps labels, square corners, 1px ink
// hairlines, a hard drop shadow, square status dots, and the cast's pixel
// portraits (generated from avatar-engine.cjs by scripts/make-assets.cjs).

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(red: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255,
                  blue: CGFloat(hex & 0xff) / 255, alpha: alpha)
    }
}

/// The paired office's world decides the look, the cast and what the boss is
/// called. The office sends it in `overview.office.world`; it is remembered so
/// the next launch starts in the right look, and `-MunderWorld <id>` on launch
/// sets it for CI screenshots (launch arguments land in UserDefaults).
///
/// Mirror of `Skin` in ui/Pixel.kt.
enum Skin {
    private static let key = "MunderWorld"
    private(set) static var world: String = UserDefaults.standard.string(forKey: key) == "monster-trainer" ? "monster-trainer" : "office"
    static var monster: Bool { world == "monster-trainer" }
    static var boss: String { monster ? "Profesor" : "Michael" }
    static var place: String { monster ? "Pueblo" : "Oficina" }

    static func set(_ next: String) {
        world = next == "monster-trainer" ? "monster-trainer" : "office"
        UserDefaults.standard.set(world, forKey: key)
    }
}

/// Square in the office, rounded in Monster Village. Resolved when drawn, so a
/// world change only needs the view tree rebuilt (RootView keys it by world).
struct SkinShape: InsettableShape {
    var radius: CGFloat = 14
    var insetAmount: CGFloat = 0

    func path(in rect: CGRect) -> Path {
        let r = rect.insetBy(dx: insetAmount, dy: insetAmount)
        guard Skin.monster else { return Path(r) }
        return Path(roundedRect: r, cornerRadius: min(radius, min(r.width, r.height) / 2))
    }

    func inset(by amount: CGFloat) -> SkinShape {
        var shape = self
        shape.insetAmount += amount
        return shape
    }
}

extension View {
    /// Fill and outline of a surface in the active world's shape. Monster Village lines are never hairlines.
    func framed(_ fill: Color, _ line: Color, width: CGFloat = 1, radius: CGFloat = 14) -> some View {
        let shape = SkinShape(radius: radius)
        return background(shape.fill(fill))
            .overlay(shape.strokeBorder(line, lineWidth: Skin.monster ? max(width, 2) : width))
    }
}

extension Color {
    static func dyn(_ light: UInt32, _ dark: UInt32, _ monsterLight: UInt32, _ monsterDark: UInt32) -> Color {
        Color(UIColor { traits in
            let isDark = traits.userInterfaceStyle == .dark
            return UIColor(hex: Skin.monster ? (isDark ? monsterDark : monsterLight) : (isDark ? dark : light))
        })
    }
}

enum Px {
    static let cream50 = Color.dyn(0xFFFDF5, 0x17171B, 0xEEF7E2, 0x0E1A26)
    static let cream100 = Color.dyn(0xFFF8E7, 0x1D1D22, 0xE4F1D6, 0x132331)
    static let cream200 = Color.dyn(0xF4E9C7, 0x26262C, 0xDCECC8, 0x1B3042)
    static let cream300 = Color.dyn(0xE8D9A0, 0x313139, 0xC3DBA8, 0x26425A)
    static let paper100 = Color.dyn(0xFCFAF0, 0x1A1A1F, 0xFCFFF8, 0x11202D)
    static let ink900 = Color.dyn(0x1A1320, 0xDEDBD6, 0x1C2B3A, 0xE8F3E6)
    static let ink700 = Color.dyn(0x3D2E4A, 0xB3B0AC, 0x33475C, 0xC2D3C8)
    static let ink500 = Color.dyn(0x6B5878, 0x96919F, 0x536779, 0x9DB0AB)
    static let ink300 = Color.dyn(0xA899B5, 0x787684, 0x7D92A4, 0x6F8792)
    static let ink100 = Color.dyn(0xD9CFE0, 0x3E3D46, 0xCBD8E0, 0x2B4257)
    static let coral = Color.dyn(0xD96A62, 0xE08C82, 0xD9472F, 0xF0806C)
    static let coralLight = Color.dyn(0xF3D3CD, 0x3B2724, 0xFBD9D0, 0x47241F)
    static let mint = Color.dyn(0x5CA97A, 0x74C096, 0x3F9A4B, 0x7FD08A)
    static let lemon = Color.dyn(0xDCAB3C, 0xCFAA57, 0xFFCF3F, 0xFFD866)
    static let lemonLight = Color.dyn(0xF3E4BC, 0x332C1D, 0xFFF1C2, 0x40371A)
    static let sky = Color.dyn(0x4F9FAF, 0x6FB3C4, 0x2F8FC4, 0x74C0EA)
    static let idle = Color.dyn(0xA199AB, 0x6F6C77, 0x7D92A4, 0x6F8792)
    static let onAccent = Color(UIColor(hex: 0x1A1320))
    /// Monster Village's thick outline; in the office it is the usual ink hairline.
    static let outline = Color.dyn(0xA899B5, 0x787684, 0x0B1A28, 0x050D15)
    static let berryDark = Color.dyn(0x6B5878, 0x96919F, 0x7A2318, 0x7A2318)
    static let shadow = Color(UIColor { traits in
        let isDark = traits.userInterfaceStyle == .dark
        if Skin.monster { return UIColor(hex: isDark ? 0x050D15 : 0x0B1A28) }
        return isDark ? UIColor.black.withAlphaComponent(0.45) : UIColor(hex: 0x1A1320, alpha: 0.14)
    })

    static func font(_ size: CGFloat) -> Font { .custom("PressStart2P-Regular", fixedSize: size) }
}

/// Press Start 2P has no accented capitals: pixel labels drop the accent, body text keeps it.
func pixelCaps(_ s: String) -> String {
    s.folding(options: [.diacriticInsensitive], locale: Locale(identifier: "es")).uppercased()
}

struct PixelLabel: View {
    let text: String
    var size: CGFloat = 8
    var color: Color = Px.ink500
    init(_ text: String, size: CGFloat = 8, color: Color = Px.ink500) {
        self.text = text
        self.size = size
        self.color = color
    }
    var body: some View {
        Text(pixelCaps(text)).font(Px.font(size)).foregroundColor(color).lineSpacing(size / 2)
    }
}

struct PixelCard<Content: View>: View {
    var fill: Color = Px.paper100
    var border: Color = Px.ink300
    @ViewBuilder let content: () -> Content
    var body: some View {
        let shape = SkinShape(radius: 16)
        return content()
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(shape.fill(fill))
            .overlay(shape.strokeBorder(Skin.monster ? Px.outline : border, lineWidth: Skin.monster ? 3 : 1))
            .background(shape.fill(Px.shadow).offset(x: Skin.monster ? 0 : 3, y: Skin.monster ? 4 : 3))
    }
}

struct PixelButtonStyle: ButtonStyle {
    enum Kind { case primary, ghost, danger }
    var kind: Kind = .primary
    func makeBody(configuration: Configuration) -> some View {
        PixelButtonBody(kind: kind, pressed: configuration.isPressed, label: configuration.label)
    }
}

private struct PixelButtonBody<Label: View>: View {
    let kind: PixelButtonStyle.Kind
    let pressed: Bool
    let label: Label
    @Environment(\.isEnabled) private var enabled

    var body: some View {
        let monster = Skin.monster
        let shape = SkinShape(radius: 24)
        let fill: Color = !enabled ? Px.cream300
            : kind == .primary ? (monster ? Px.coral : Px.ink900)
            : kind == .danger ? (monster ? Px.paper100 : Px.coral)
            : (monster ? Px.paper100 : Px.cream100)
        let text: Color = !enabled ? Px.ink500
            : kind == .primary ? (monster ? Color.white : Px.cream50)
            : kind == .danger ? (monster ? Px.coral : Px.onAccent)
            : Px.ink900
        let line: Color = monster
            ? (kind == .primary ? Px.berryDark : kind == .danger ? Px.coral : Px.outline)
            : (kind == .primary ? Px.ink900 : Px.ink300)
        let edge: Color = monster
            ? (kind == .ghost ? Px.outline : Px.berryDark)
            : (kind == .primary ? Px.ink500 : Px.ink100)
        let drop: CGFloat = monster ? 4 : 2
        return label
            .font(.system(size: 15, weight: .semibold))
            .frame(maxWidth: .infinity, minHeight: 44)
            .foregroundColor(text)
            .background(shape.fill(fill))
            .overlay(shape.strokeBorder(line, lineWidth: monster ? 2 : 1))
            .offset(y: pressed ? drop : 0)
            .background(shape.fill(edge).offset(y: drop))
    }
}

struct PixelField: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(10)
            .framed(Px.paper100, Px.ink300, radius: 12)
    }
}
extension View { func pixelField() -> some View { modifier(PixelField()) } }

/// A multi-line box with the app's look (TextEditor draws its own background otherwise).
struct PixelEditor: View {
    let placeholder: String
    @Binding var text: String
    var body: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty {
                Text(placeholder).foregroundColor(Px.ink300).padding(.horizontal, 5).padding(.vertical, 8)
            }
            TextEditor(text: $text).scrollContentBackground(.hidden).frame(minHeight: 84)
        }
        .pixelField()
    }
}

struct StatusDot: View {
    let color: Color
    var body: some View { SkinShape(radius: 4).fill(color).frame(width: 8, height: 8) }
}

struct Chip: View {
    let text: String
    var fill: Color = Px.cream200
    var dot: Color?
    var body: some View {
        HStack(spacing: 6) {
            if let dot { StatusDot(color: dot) }
            PixelLabel(text, size: 7, color: Px.ink700)
        }
        .padding(.horizontal, Skin.monster ? 8 : 6).padding(.vertical, 4)
        .background(SkinShape(radius: 12).fill(fill))
        .overlay(SkinShape(radius: 12).strokeBorder(Px.ink100, lineWidth: 1))
    }
}

/// A speech bubble: the question comes out of whoever asked it.
struct Bubble<Content: View>: View {
    @ViewBuilder let content: () -> Content
    var body: some View {
        content()
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .framed(Skin.monster ? Px.paper100 : Px.cream50, Skin.monster ? Px.outline : Px.ink900, width: Skin.monster ? 3 : 2)
    }
}

// MARK: - the cast

enum Cast {
    static let names: [String] = Bundle.main.paths(forResourcesOfType: "png", inDirectory: "Media/Cast")
        .map { URL(fileURLWithPath: $0).deletingPathExtension().lastPathComponent }
        .sorted()

    static func image(_ name: String) -> UIImage? {
        if Skin.monster {
            return Bundle.main.path(forResource: monster(name), ofType: "png", inDirectory: "Media/Monsters").flatMap(UIImage.init(contentsOfFile:))
        }
        return Bundle.main.path(forResource: name, ofType: "png", inDirectory: "Media/Cast").flatMap(UIImage.init(contentsOfFile:))
    }

    static let monsters = ["agua", "fuego", "electricidad", "oscuridad", "luz", "aire"]

    /// Monster Village cast: the Professor coordinates; every worker keeps a stable monster.
    static func monster(_ who: String) -> String {
        if who == "michael" || who == "profesor" { return "profesor" }
        if monsters.contains(who) { return who }
        var h: UInt32 = 0
        for u in who.unicodeScalars { h = h &* 31 &+ u.value }
        return monsters[Int(h % UInt32(monsters.count))]
    }

    /// Same rule as the PWA: the boss is Michael, else the name or id, else a stable pick.
    static func of(_ agent: Agent?) -> String {
        guard let agent else { return "michael" }
        return of(id: agent.id, name: agent.name, god: agent.god == true)
    }

    /// Whoever a card is assigned to, found on the roster when possible.
    static func forAssignee(_ id: String?, in agents: [Agent]?) -> String {
        guard let id else { return "michael" }
        if let a = agents?.first(where: { $0.id == id || $0.name.lowercased() == id.lowercased() }) { return of(a) }
        return of(id: id, name: id, god: false)
    }

    static func of(id: String, name: String, god: Bool) -> String {
        if Skin.monster {
            if god { return "profesor" }
            let named = name.lowercased()
            return monsters.contains(named) ? named : monster(id)
        }
        if god { return "michael" }
        for raw in [name, id] {
            var key = raw.lowercased()
            if key.hasPrefix("worker-") { key.removeFirst("worker-".count) }
            key = String(key.prefix { $0.isLetter && $0.isASCII })
            if names.contains(key) { return key }
        }
        let pool = names.filter { $0 != "michael" }
        guard !pool.isEmpty else { return "michael" }
        var h: UInt32 = 0
        for u in id.unicodeScalars { h = h &* 31 &+ u.value }
        return pool[Int(h % UInt32(pool.count))]
    }
}

struct Portrait: View {
    let name: String
    var scale: CGFloat = 2
    var body: some View {
        Group {
            if let img = Cast.image(name) {
                Image(uiImage: img).interpolation(.none).resizable()
            } else {
                Px.cream200
            }
        }
        // The office cast is 18×28; the monsters are square.
        .frame(width: (Skin.monster ? 26 : 18) * scale, height: (Skin.monster ? 26 : 28) * scale)
        .background(SkinShape(radius: 12).fill(Px.cream200))
        .clipShape(SkinShape(radius: 12))
        .overlay(SkinShape(radius: 12).strokeBorder(Skin.monster ? Px.outline : Px.ink100, lineWidth: Skin.monster ? 2 : 1))
    }
}

// MARK: - pixel icons (12×12, same grids as the PWA)

enum PixelIcon {
    static let office = ["....####....", "...#....#...", "..#......#..", ".#........#.", "############", "#..........#",
                         "#.##....##.#", "#.##....##.#", "#..........#", "#....##....#", "#....##....#", "############"]
    static let ask = ["...######...", "..##....##..", "..##....##..", "........##..", ".......##...", "......##....",
                      ".....##.....", ".....##.....", "............", ".....##.....", ".....##.....", "............"]
    static let board = ["############", "#..........#", "#.##.##.##.#", "#.##.##.##.#", "#..........#", "#.##.##....#",
                        "#.##.##....#", "#..........#", "############", ".#........#.", ".#........#.", "............"]
    static let link = ["............", ".####.......", "#....#......", "#..#####....", "#....#..#...", ".####....#..",
                       "..#....####.", "...#..#....#", "....#####..#", "......#....#", ".......####.", "............"]

    /// A switch on a panel: the machine, not the office.
    static let panel = ["############", "#..........#", "#.##....##.#", "#.##....##.#", "#..........#", "#.###..###.#",
                        "#..........#", "#..........#", "#.##....##.#", "#..........#", "#..........#", "############"]

    static func image(_ grid: [String], cell: CGFloat = 2) -> UIImage {
        let size = CGSize(width: 12 * cell, height: 12 * cell)
        let img = UIGraphicsImageRenderer(size: size).image { ctx in
            UIColor.black.setFill()
            for (y, row) in grid.enumerated() {
                for (x, ch) in row.enumerated() where ch == "#" {
                    ctx.fill(CGRect(x: CGFloat(x) * cell, y: CGFloat(y) * cell, width: cell, height: cell))
                }
            }
        }
        return img.withRenderingMode(.alwaysTemplate)
    }
}

// MARK: - small helpers

enum When {
    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain = ISO8601DateFormatter()

    static func ago(_ iso: String?) -> String? {
        guard let iso, let date = withFraction.date(from: iso) ?? plain.date(from: iso) else { return nil }
        let m = Int(Date().timeIntervalSince(date) / 60)
        if m < 1 { return "ahora" }
        if m < 60 { return "hace \(m) min" }
        let h = m / 60
        if h < 24 { return "hace \(h) h" }
        return "hace \(h / 24) d"
    }
}

/// **bold** and `code` from the ASK ME cards; anything else stays plain text.
func markdown(_ s: String) -> AttributedString {
    (try? AttributedString(markdown: s, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(s)
}

let stateName: [String: String] = ["idle": "libre", "working": "trabajando", "blocked": "bloqueado", "gone": "fuera", "offline": "apagado"]

func stateColor(_ s: String?) -> Color {
    switch s {
    case "idle": return Px.mint
    case "working": return Px.lemon
    case "blocked": return Px.coral
    default: return Px.idle
    }
}
