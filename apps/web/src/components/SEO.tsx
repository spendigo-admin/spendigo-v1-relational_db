import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title: string;
    description?: string;
    path?: string;
    ogImage?: string;
    noIndex?: boolean;
}

const BASE_URL = 'https://spendigo.ca';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

/**
 * Per-page SEO component using react-helmet-async.
 * Sets <title>, <meta description>, Open Graph, and Twitter Card tags.
 * Admin and merchant pages use noIndex to prevent search engine indexing.
 */
const SEO: React.FC<SEOProps> = ({
    title,
    description = 'Spendigo SmartCart helps you compare prices across local stores, build your shopping list, and save money on every grocery run.',
    path = '',
    ogImage = DEFAULT_OG_IMAGE,
    noIndex = false,
}) => {
    const fullTitle = title === 'Home' ? 'Spendigo — Shop Smarter, Save More' : `${title} | Spendigo`;
    const url = `${BASE_URL}${path}`;

    return (
        <Helmet>
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={url} />
            {noIndex && <meta name="robots" content="noindex, nofollow" />}

            {/* Open Graph */}
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="Spendigo" />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={ogImage} />
            <meta property="og:url" content={url} />

            {/* Twitter Card */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={ogImage} />
        </Helmet>
    );
};

export default SEO;
