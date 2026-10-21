// Reference Swift code for a FUTURE native iOS wrapper. Not wired to the Next.js PWA.
// Requires Xcode on macOS, the HealthKit capability, and NSHealthShareUsageDescription.
import Foundation
import HealthKit

@MainActor
final class HealthKitStepsReader {
    private let healthStore = HKHealthStore()
    private let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount)!

    enum ReadError: LocalizedError {
        case unavailable
        var errorDescription: String? { "HealthKit is not available on this device." }
    }

    func requestReadPermission() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { throw ReadError.unavailable }
        try await healthStore.requestAuthorization(toShare: [], read: [stepType])
        // A completed authorization request is NOT proof that read access was granted.
        // HealthKit intentionally doesn't reveal read-permission status.
    }

    // Read the total HealthKit steps for one device-local calendar day.
    // Apple Health aggregates across its eligible step sources to avoid double counting.
    func steps(on day: Date) async throws -> Int {
        guard HKHealthStore.isHealthDataAvailable() else { throw ReadError.unavailable }
        let interval = Calendar.current.dateInterval(of: .day, for: day)!
        let predicate = HKQuery.predicateForSamples(
            withStart: interval.start,
            end: interval.end,
            options: [.strictStartDate]
        )
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum) { _, result, error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else {
                    let count = result?.sumQuantity()?.doubleValue(for: .count()) ?? 0
                    continuation.resume(returning: Int(count.rounded()))
                }
            }
            healthStore.execute(query)
        }
    }
}
