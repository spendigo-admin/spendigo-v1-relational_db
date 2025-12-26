"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxService = void 0;
const PROVINCIAL_RATES = {
    AB: { gst: 0.05, pst: 0.00, hst: 0.00, qst: 0.00 },
    BC: { gst: 0.05, pst: 0.07, hst: 0.00, qst: 0.00 },
    MB: { gst: 0.05, pst: 0.07, hst: 0.00, qst: 0.00 },
    NB: { gst: 0.00, pst: 0.00, hst: 0.15, qst: 0.00 },
    NL: { gst: 0.00, pst: 0.00, hst: 0.15, qst: 0.00 },
    NS: { gst: 0.00, pst: 0.00, hst: 0.15, qst: 0.00 },
    NT: { gst: 0.05, pst: 0.00, hst: 0.00, qst: 0.00 },
    NU: { gst: 0.05, pst: 0.00, hst: 0.00, qst: 0.00 },
    ON: { gst: 0.00, pst: 0.00, hst: 0.13, qst: 0.00 }, // HST 13%
    PE: { gst: 0.00, pst: 0.00, hst: 0.15, qst: 0.00 },
    QC: { gst: 0.05, pst: 0.00, hst: 0.00, qst: 0.09975 }, // GST + QST
    SK: { gst: 0.05, pst: 0.06, hst: 0.00, qst: 0.00 },
    YT: { gst: 0.05, pst: 0.00, hst: 0.00, qst: 0.00 },
};
class TaxService {
    calculateTax(amountCents, province, isZeroRated = false) {
        if (isZeroRated) {
            return { gst: 0, pst: 0, hst: 0, qst: 0, totalTaxCents: 0 };
        }
        const rates = PROVINCIAL_RATES[province] || PROVINCIAL_RATES['ON']; // Default to ON if unknown
        const gst = Math.round(amountCents * rates.gst);
        const pst = Math.round(amountCents * rates.pst);
        const hst = Math.round(amountCents * rates.hst);
        const qst = Math.round(amountCents * rates.qst);
        return {
            gst, pst, hst, qst,
            totalTaxCents: gst + pst + hst + qst
        };
    }
}
exports.TaxService = TaxService;
//# sourceMappingURL=tax.js.map