#!/bin/bash

# Base URL params for consistency
PARAMS_LOGO="?w=400&h=400&fit=crop"
PARAMS_COVER="?w=1200&h=400&fit=crop"

# Output Dir
OUT_DIR="apps/web/public/defaults/branding"

# Function to download
download_asset() {
    TYPE=$1
    NAME=$2
    URL_BASE=$3
    
    echo "Downloading $TYPE for $NAME..."
    curl -L -s "${URL_BASE}${PARAMS_LOGO}" -o "${OUT_DIR}/${NAME}_logo.jpg"
    curl -L -s "${URL_BASE}${PARAMS_COVER}" -o "${OUT_DIR}/${NAME}_cover.jpg"
}

# 1. Grocery (Vegetables/General)
download_asset "Grocery" "grocery" "https://images.unsplash.com/photo-1542838132-92c53300491e"

# 2. Desi Grocery (Spices)
download_asset "Desi Grocery" "desi" "https://images.unsplash.com/photo-1596040033229-a9821ebd058d"

# 3. Asian Market (Street/Stall)
download_asset "Asian Market" "asian" "https://images.unsplash.com/photo-1534483509916-2495b29a287f"

# 4. Bakery (Bread)
download_asset "Bakery" "bakery" "https://images.unsplash.com/photo-1555507036-ab1f4038808a"

# 5. Cafe (Coffee)
download_asset "Cafe" "cafe" "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085"

# 6. Butcher (Meat)
download_asset "Butcher" "butcher" "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f"

# 7. Generic/Other (Storefront) - Fallback
curl -L -s "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=400&fit=crop" -o "${OUT_DIR}/other_logo.jpg"
curl -L -s "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=400&fit=crop" -o "${OUT_DIR}/other_cover.jpg"

echo "Downloads complete."
