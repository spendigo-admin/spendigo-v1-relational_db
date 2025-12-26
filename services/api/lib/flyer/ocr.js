"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlyerOCRService = void 0;
const tesseract_js_1 = require("tesseract.js");
// Mock normalization function
const normalizePrice = (text) => {
    const match = text.match(/\\$?(\\d+\\.\\d{2})/);
    return match ? Math.round(parseFloat(match[1]) * 100) : null;
};
class FlyerOCRService {
    async processPage(imageUrl, pageId, flyerId) {
        const worker = await (0, tesseract_js_1.createWorker)('eng');
        const ret = await worker.recognize(imageUrl);
        const { data } = ret;
        await worker.terminate();
        // Naive Heuristic: Iterate lines, look for price patterns
        // In production, we'd use 'lines' or 'words' with bbox location clustering
        const deals = [];
        data.lines.forEach((line) => {
            const price = normalizePrice(line.text);
            if (price) {
                // Assume the text before the price is the product name (very naive)
                const productName = line.text.replace(/\\$?(\\d+\\.\\d{2})/, '').trim();
                if (productName.length > 3) {
                    deals.push({
                        id: crypto.randomUUID(), // Temp ID until DB persist
                        flyerId,
                        pageId,
                        productName,
                        priceCents: price,
                        confidenceScore: line.confidence / 100,
                        isVerified: line.confidence > 90,
                        bbox: line.bbox ? {
                            x: line.bbox.x0,
                            y: line.bbox.y0,
                            w: line.bbox.x1 - line.bbox.x0,
                            h: line.bbox.y1 - line.bbox.y0
                        } : undefined
                    });
                }
            }
        });
        return deals;
    }
}
exports.FlyerOCRService = FlyerOCRService;
//# sourceMappingURL=ocr.js.map