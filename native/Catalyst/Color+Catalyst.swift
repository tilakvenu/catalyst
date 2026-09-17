import SwiftUI

/// Locked brand palette. Never inline hex in views.
enum CatalystColor {
    static let primary = Color(hex: 0x000000)
    static let accent = Color(hex: 0x0A84FF)
    static let positive = Color(hex: 0x30D158)
    static let negative = Color(hex: 0xFF453A)
    static let warn = Color(hex: 0xFF9F0A)
    static let lightSurface = Color(hex: 0xF2F2F7)
    static let darkSurface = Color(hex: 0x000000)
    static let ink = Color(hex: 0xF5F5F7)
    static let muted = Color(hex: 0x8E8E93)
    static let hairline = Color(hex: 0x38383A)
    static let elevated = Color(hex: 0x1C1C1E)

    /// Filled tint buttons always take white text.
    static let accentInk = Color.white
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}
