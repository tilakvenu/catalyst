import Foundation
import SwiftData

/// Completion is derived from field presence, never a stored flag.
/// A quick note is this model with conviction and invalidation nil.

@Model
final class Ticker {
    @Attribute(.unique) var symbol: String
    var company: String
    var held: Bool
    var muted: Bool
    var lastPrice: Double
    var change: Double
    var changePct: Double

    init(symbol: String, company: String, held: Bool = false, muted: Bool = false,
         lastPrice: Double = 0, change: Double = 0, changePct: Double = 0) {
        self.symbol = symbol
        self.company = company
        self.held = held
        self.muted = muted
        self.lastPrice = lastPrice
        self.change = change
        self.changePct = changePct
    }
}

@Model
final class MacroItem {
    var name: String
    var shortName: String
    var series: String
    var muted: Bool

    init(name: String, shortName: String, series: String, muted: Bool = false) {
        self.name = name
        self.shortName = shortName
        self.series = series
        self.muted = muted
    }
}

@Model
final class CompanyProfile {
    @Attribute(.unique) var tickerSymbol: String
    var sector: String
    var industry: String
    var profileDescription: String
    var fetchedAt: Date

    init(tickerSymbol: String, sector: String, industry: String, profileDescription: String, fetchedAt: Date) {
        self.tickerSymbol = tickerSymbol
        self.sector = sector
        self.industry = industry
        self.profileDescription = profileDescription
        self.fetchedAt = fetchedAt
    }
}

@Model
final class CatalystEvent {
    var title: String
    var kind: String
    var tickerSymbol: String?
    var macroName: String?
    var startsAt: Date
    var confirmed: Bool
    var session: String
    var details: String
    var notify: Bool

    init(title: String, kind: String, startsAt: Date, confirmed: Bool, session: String,
         details: String, notify: Bool = true, tickerSymbol: String? = nil, macroName: String? = nil) {
        self.title = title
        self.kind = kind
        self.startsAt = startsAt
        self.confirmed = confirmed
        self.session = session
        self.details = details
        self.notify = notify
        self.tickerSymbol = tickerSymbol
        self.macroName = macroName
    }
}

@Model
final class Headline {
    var title: String
    var source: String
    var publishedAt: Date
    var tickerSymbol: String?
    var macroName: String?

    init(title: String, source: String, publishedAt: Date, tickerSymbol: String? = nil, macroName: String? = nil) {
        self.title = title
        self.source = source
        self.publishedAt = publishedAt
        self.tickerSymbol = tickerSymbol
        self.macroName = macroName
    }
}

@Model
final class JournalEntry {
    var eventTitle: String
    var text: String?
    var sentiment: String?
    var direction: String?
    var conviction: Int?
    var reasoning: String?
    var invalidation: String?
    var updatedAt: Date
    var actualDirection: String?
    var actualMovePct: Double?
    var actualMoveDate: Date?
    var actualFigure: String?

    var isComplete: Bool {
        direction != nil && conviction != nil
            && !(reasoning ?? "").isEmpty
            && !(invalidation ?? "").isEmpty
    }

    init(eventTitle: String, updatedAt: Date = .now) {
        self.eventTitle = eventTitle
        self.updatedAt = updatedAt
    }
}

struct TapeMetrics: Codable, Hashable {
    var tickerSymbol: String
    var marketCap: Double?
    var pe: Double?
    var week52High: Double?
    var week52Low: Double?
    var target: Double?
    var fetchedAt: Date
}

struct MacroPrint: Codable, Hashable {
    var macroId: String
    var value: String
    var prior: String?
    var asOf: Date
    var source: String
}

struct QuoteRange: Codable, Hashable {
    var dayHigh: Double?
    var dayLow: Double?
    var dayOpen: Double?
    var prevClose: Double?
}
