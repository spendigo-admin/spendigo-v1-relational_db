export interface OpenFoodFactsResult {
  found: boolean;
  name?: string;
  image?: string;
  brand?: string;
  description?: string;
}

export const searchOpenFoodFacts = async (barcode: string): Promise<OpenFoodFactsResult> => {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await response.json();

    if (data.status === 1 && data.product) {
      const p = data.product;
      return {
        found: true,
        name: p.product_name || p.product_name_en || '',
        image: p.image_url || p.image_front_url || '',
        brand: p.brands || '',
        description: p.generic_name || ''
      };
    }
    return { found: false };
  } catch (error) {
    console.error("OpenFoodFacts API Error:", error);
    return { found: false };
  }
};
