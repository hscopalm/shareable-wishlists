const express = require('express');
const router = express.Router();
const ogs = require('open-graph-scraper');
const cheerio = require('cheerio');

// POST /api/scrape/url
// Scrapes Open Graph and JSON-LD metadata from a URL
router.post('/url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ message: 'Invalid URL format' });
    }

    const options = {
      url,
      timeout: 10000,
      fetchOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    };

    const { result, html } = await ogs(options);

    // Parse JSON-LD from the HTML
    const jsonLd = parseJsonLd(html);

    // Extract relevant metadata, preferring JSON-LD for product data
    const metadata = {
      title: jsonLd.title || result.ogTitle || result.twitterTitle || result.dcTitle || '',
      imageUrl: jsonLd.imageUrl || result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url || '',
      price: jsonLd.price || extractPriceFromOg(result),
      link: url
    };

    res.json(metadata);
  } catch (error) {
    console.error('Error scraping URL:', error);
    res.status(500).json({
      message: 'Failed to fetch product information',
      error: error.message
    });
  }
});

// Parse JSON-LD structured data from HTML
function parseJsonLd(html) {
  const result = { title: '', imageUrl: '', price: '' };

  if (!html) return result;

  try {
    const $ = cheerio.load(html);
    const scripts = $('script[type="application/ld+json"]');

    scripts.each((_, script) => {
      try {
        const content = $(script).html();
        if (!content) return;

        let data = JSON.parse(content);

        // Handle @graph arrays (common pattern)
        if (data['@graph']) {
          data = data['@graph'];
        }

        // Normalize to array
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          // Look for Product schema
          if (item['@type'] === 'Product' || item['@type']?.includes?.('Product')) {
            if (item.name && !result.title) {
              result.title = item.name;
            }

            if (item.image && !result.imageUrl) {
              result.imageUrl = Array.isArray(item.image) ? item.image[0] : item.image;
              // Handle image objects
              if (typeof result.imageUrl === 'object') {
                result.imageUrl = result.imageUrl.url || result.imageUrl.contentUrl || '';
              }
            }

            // Extract price from offers
            if (item.offers && !result.price) {
              const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              if (offers.price) {
                result.price = parseFloat(offers.price);
              } else if (offers.lowPrice) {
                result.price = parseFloat(offers.lowPrice);
              }
            }
          }
        }
      } catch {
        // Skip malformed JSON-LD blocks
      }
    });
  } catch {
    // Skip if cheerio fails
  }

  return result;
}

// Extract price from Open Graph metadata
function extractPriceFromOg(result) {
  if (result.ogPriceAmount) {
    return parseFloat(result.ogPriceAmount);
  }

  if (result.productPriceAmount) {
    return parseFloat(result.productPriceAmount);
  }

  if (result.customMetaTags) {
    const priceTag = result.customMetaTags.find(tag =>
      tag.property?.includes('price') || tag.name?.includes('price')
    );
    if (priceTag?.content) {
      const priceMatch = priceTag.content.match(/[\d.]+/);
      if (priceMatch) {
        return parseFloat(priceMatch[0]);
      }
    }
  }

  return '';
}

module.exports = router;
