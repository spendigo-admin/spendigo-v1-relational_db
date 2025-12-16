export interface Flyer {
    id: string;
    storeId: string;
    status: 'processing' | 'review_required' | 'active' | 'expired';
    activeFrom: string;
    activeUntil: string;
    pages: FlyerPage[];
}

export interface FlyerPage {
    id: string;
    flyerId: string;
    pageNumber: number;
    imageUrl: string;
    ocrRawText?: string;
}

export interface ExtractedDeal {
    id: string;
    flyerId: string;
    pageId: string;
    productName: string;
    priceCents: number;
    unit?: string;
    bbox?: { x: number; y: number; w: number; h: number };
    confidenceScore: number;
    isVerified: boolean;
}
