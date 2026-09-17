import SwiftUI

/// Two-tier step mark. 64-unit grid. Square caps, mitered joints, system-blue bead in the riser notch.
/// Web launch overlay (~1.55s mark + wordmark, then fade) should be a SwiftUI overlay on the
/// already-mounted root — do not unmount the tab stack behind a LaunchScreen storyboard.
struct CatalystMark: View {
    var body: some View {
        Canvas { ctx, size in
            let s = min(size.width, size.height) / 64
            var path = Path()
            path.move(to: CGPoint(x: 6 * s, y: 52 * s))
            path.addLine(to: CGPoint(x: 28 * s, y: 52 * s))
            path.addLine(to: CGPoint(x: 28 * s, y: 44.5 * s))
            var path2 = Path()
            path2.move(to: CGPoint(x: 28 * s, y: 23.5 * s))
            path2.addLine(to: CGPoint(x: 28 * s, y: 16 * s))
            path2.addLine(to: CGPoint(x: 58 * s, y: 16 * s))
            let stroke = StrokeStyle(lineWidth: 5 * s, lineCap: .square, lineJoin: .miter)
            ctx.stroke(path, with: .color(.primary), style: stroke)
            ctx.stroke(path2, with: .color(.primary), style: stroke)
            let dot = Path(ellipseIn: CGRect(
                x: 28 * s - 6.5 * s,
                y: 34 * s - 6.5 * s,
                width: 13 * s,
                height: 13 * s
            ))
            ctx.fill(dot, with: .color(CatalystColor.accent))
        }
        .aspectRatio(1, contentMode: .fit)
    }
}

#Preview {
    CatalystMark()
        .frame(width: 64, height: 64)
        .padding()
        .background(CatalystColor.darkSurface)
        .foregroundStyle(CatalystColor.ink)
}
