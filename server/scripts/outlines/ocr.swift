import Vision
import AppKit
import Foundation
// usage: ocrj img1 img2 ... → one JSON line per image: {"file":..., "lines":[{"t":text,"x":minX,"y":midY,"w":width}]}
for path in CommandLine.arguments.dropFirst() {
  var out: [[String: Any]] = []
  if let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) {
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["ar", "en"]
    req.usesLanguageCorrection = true
    try? VNImageRequestHandler(cgImage: cg).perform([req])
    for o in req.results ?? [] {
      guard let c = o.topCandidates(1).first else { continue }
      let b = o.boundingBox
      out.append(["t": c.string, "x": b.minX, "y": b.midY, "w": b.width])
    }
  }
  let obj: [String: Any] = ["file": path, "lines": out]
  let data = try! JSONSerialization.data(withJSONObject: obj)
  print(String(data: data, encoding: .utf8)!)
  fflush(stdout)
}
