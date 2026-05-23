const FLYER_ITEMS_URL = 'https://flyers-ng.flippback.com/api/flipp/flyers/{}/flyer_items?locale=en&sid=1234567890123456';

async function test() {
  const flyerId = '7889162'; // Metro
  const url = FLYER_ITEMS_URL.replace('{}', flyerId);
  console.log('Fetching:', url);
  
  const response = await fetch(url);
  if (!response.ok) {
    console.error('Fetch failed:', response.statusText);
    return;
  }
  
  const data = await response.json();
  console.log('Data is array:', Array.isArray(data));
  console.log('Length:', data.length);
  if (data.length > 0) {
    console.log('First item keys:', Object.keys(data[0]));
    console.log('First item sample:', JSON.stringify(data[0], null, 2));
    
    const itemsWithName = data.filter(item => item.name);
    console.log('Items with .name:', itemsWithName.length);
    
    const itemsWithItemName = data.filter(item => item.item_name);
    console.log('Items with .item_name:', itemsWithItemName.length);
  }
}

test().catch(console.error);
