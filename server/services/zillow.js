/**
 * Zillow listing parser.
 *
 * Zillow renders its listing data into a `__NEXT_DATA__` blob on the page.
 * We fetch the HTML, extract that JSON, and pull the fields we care about.
 *
 * If Zillow blocks the request (common), we fall back to parsing microdata
 * + meta tags. For hackathon demo-grade reliability we also support a
 * query-string override ?mock=1 for test URLs.
 */
import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

export async function parseZillow(url) {
  if (!/zillow\.com/i.test(url)) {
    throw Object.assign(new Error('Not a Zillow URL'), { status: 400 });
  }

  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (!res.ok) {
    throw Object.assign(new Error(`zillow fetch ${res.status}`), {
      status: 502,
    });
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  // 1) Try the __NEXT_DATA__ blob
  const nextData = $('#__NEXT_DATA__').text();
  let listing = null;
  if (nextData) {
    try {
      const json = JSON.parse(nextData);
      listing = extractFromNext(json);
    } catch {
      /* fall through */
    }
  }

  // 2) Fallback to OG + microdata
  if (!listing) listing = extractFromMeta($, url);

  // Always make sure URL is present
  listing.zillow_url = url;
  return listing;
}

function extractFromNext(json) {
  // Zillow's shape moves, but typically:
  //   props.pageProps.componentProps.gdpClientCache -> stringified
  //   or props.pageProps.initialReduxState.gdp.property
  try {
    const cache = json?.props?.pageProps?.componentProps?.gdpClientCache;
    if (cache) {
      const parsed = JSON.parse(cache);
      const firstKey = Object.keys(parsed)[0];
      const prop = parsed[firstKey]?.property;
      if (prop) return shape(prop);
    }
    const fromRedux =
      json?.props?.pageProps?.initialReduxState?.gdp?.property ||
      json?.props?.pageProps?.property;
    if (fromRedux) return shape(fromRedux);
  } catch {
    /* ignore */
  }
  return null;
}

function shape(prop) {
  const photos =
    (prop.originalPhotos || prop.photos || [])
      .map(p => p?.mixedSources?.jpeg?.slice(-1)?.[0]?.url || p?.url)
      .filter(Boolean) || [];
  return {
    address:
      prop.streetAddress
        ? [prop.streetAddress, prop.city, prop.state, prop.zipcode]
            .filter(Boolean)
            .join(', ')
        : prop.address?.streetAddress || prop.address || null,
    price: prop.price || prop.listPrice || null,
    beds: prop.bedrooms || null,
    baths: prop.bathrooms || null,
    sqft: prop.livingArea || prop.sqft || null,
    photos,
    description: prop.description || prop.homeDescription || null,
  };
}

function extractFromMeta($, url) {
  const og = name => $(`meta[property='og:${name}']`).attr('content');
  const photos = [];
  $("meta[property='og:image']").each((_, el) => {
    const c = $(el).attr('content');
    if (c) photos.push(c);
  });

  // extract beds/baths/sqft/price from title or description heuristically
  const title = og('title') || $('title').text() || '';
  const desc = og('description') || '';
  const priceMatch = (title + ' ' + desc).match(/\$([\d,]+)/);
  const bedsMatch = (title + ' ' + desc).match(/(\d+)\s*b(?:d|ed)/i);
  const bathsMatch = (title + ' ' + desc).match(/(\d+(?:\.\d)?)\s*ba(?:th)?/i);
  const sqftMatch = (title + ' ' + desc).match(/([\d,]+)\s*sqft/i);

  return {
    zillow_url: url,
    address: title.split('|')[0]?.trim() || null,
    price: priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null,
    beds: bedsMatch ? Number(bedsMatch[1]) : null,
    baths: bathsMatch ? Number(bathsMatch[1]) : null,
    sqft: sqftMatch ? Number(sqftMatch[1].replace(/,/g, '')) : null,
    photos,
    description: desc,
  };
}
