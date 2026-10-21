// Example iOS native target source. Compile with Xcode on macOS; not part of Vercel.
// Required: HealthKit capability, NSHealthShareUsageDescription, WKAppBoundDomains.
import SwiftUI
import WebKit
import HealthKit

@main
struct ForgeFitNativeApp: App {
    var body: some Scene {
        WindowGroup { ForgeFitHealthWebView().ignoresSafeArea() }
    }
}

struct ForgeFitHealthWebView: UIViewRepresentable {
    private static let allowedHost = "forgefit-8tc9.vercel.app"

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.limitsNavigationsToAppBoundDomains = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.userContentController.addScriptMessageHandler(
            context.coordinator, contentWorld: .page, name: "forgefitHealth"
        )
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        if let url = URL(string: "https://\(Self.allowedHost)") { view.load(URLRequest(url: url)) }
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandlerWithReply {
        private let reader = HealthKitStepsReader()

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            if url.scheme == "https" && url.host == ForgeFitHealthWebView.allowedHost {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
                if url.scheme == "https" { UIApplication.shared.open(url) }
            }
        }

        func userContentController(_ controller: WKUserContentController,
                                   didReceive message: WKScriptMessage,
                                   replyHandler: @escaping (Any?, String?) -> Void) {
            guard message.frameInfo.isMainFrame,
                  message.frameInfo.securityOrigin.protocol == "https",
                  message.frameInfo.securityOrigin.host == ForgeFitHealthWebView.allowedHost,
                  let request = message.body as? [String: Any],
                  let operation = request["action"] as? String else {
                replyHandler(["ok": false, "error": "Untrusted health request."], nil)
                return
            }
            Task { @MainActor in
                do {
                    switch operation {
                    case "requestPermission":
                        try await reader.requestReadPermission()
                        // HealthKit does not disclose whether read authorization was actually granted.
                        replyHandler(["ok": true], nil)
                    case "getDailySteps":
                        guard let dateString = request["date"] as? String,
                              dateString.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil
                        else { replyHandler(["ok": false, "error": "Invalid date."], nil); return }
                        let formatter = DateFormatter()
                        formatter.locale = Locale(identifier: "en_US_POSIX")
                        formatter.timeZone = .current
                        formatter.dateFormat = "yyyy-MM-dd"
                        formatter.isLenient = false
                        guard let date = formatter.date(from: dateString),
                              formatter.string(from: date) == dateString,
                              date <= Date() else {
                            replyHandler(["ok": false, "error": "Invalid date."], nil); return
                        }
                        let count = try await reader.steps(on: date)
                        replyHandler(["ok": true, "steps": count], nil)
                    default:
                        replyHandler(["ok": false, "error": "Unsupported health request."], nil)
                    }
                } catch {
                    replyHandler(["ok": false, "error": "HealthKit access failed. Check iPhone Health permissions and retry."], nil)
                }
            }
        }
    }
}
