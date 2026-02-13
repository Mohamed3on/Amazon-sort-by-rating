const CACHE_KEY = 'amz-rating-cache';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

const numberWithCommas = (x) => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const sortFunction = (a, b) => (a[0] === b[0] ? 0 : a[0] < b[0] ? 1 : -1);

const htmlToElement = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
};

const getCache = () => {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const now = Date.now();
    for (const key in cache) {
      if (now - cache[key].ts > CACHE_TTL) delete cache[key];
    }
    return cache;
  } catch {
    return {};
  }
};

const saveCache = (cache) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
};

const getRatingPercentage = (ratingText) => {
  try {
    const template = htmlToElement(ratingText);

    const totalReviews = parseInt(
      template
        .querySelector('[data-hook="total-review-count"]')
        ?.textContent.trim()
        .replace(/\D/g, '') || '0',
      10
    );
    const fiveStars = parseInt(
      template
        .querySelector('#histogramTable li:first-child .a-section.a-spacing-none.a-text-right')
        ?.textContent.trim()
        .replace('%', '') || '0',
      10
    );
    const oneStars = parseInt(
      template
        .querySelector(
          '#histogramTable li:last-child .a-section.a-spacing-none.a-text-right span:last-child'
        )
        ?.textContent.trim()
        .replace('%', '') || '0',
      10
    );

    return { fiveStars, oneStars, totalReviews };
  } catch (e) {
    console.error('Error parsing rating:', e);
    return { fiveStars: 0, oneStars: 0, totalReviews: 0 };
  }
};

const getRatingScores = async (productSIN, elementToReplace, cache) => {
  try {
    const now = Date.now();
    let ratings = cache[productSIN];

    if (!ratings || now - ratings.ts > CACHE_TTL) {
      const resp = await fetch(
        `/gp/customer-reviews/widgets/average-customer-review/popover/ref=dpx_acr_pop_?contextId=dpx&asin=${productSIN}`,
        { method: 'GET', mode: 'cors', credentials: 'include' }
      );
      if (!resp.ok) throw new Error('Failed to fetch ratings');

      const text = await resp.text();
      const parsed = getRatingPercentage(text);
      ratings = { ...parsed, ts: now };
      if (parsed.totalReviews > 0) cache[productSIN] = ratings;
    }

    const scorePercentage = ratings.fiveStars - ratings.oneStars;
    const scoreAbsolute = Math.round(ratings.totalReviews * (scorePercentage / 100));
    const calculatedScore = Math.round(scoreAbsolute * (scorePercentage / 100)) || 0;

    elementToReplace.textContent = ` ${numberWithCommas(calculatedScore)} ratio: (${scorePercentage}%)`;

    return { calculatedScore };
  } catch (e) {
    console.error(`Failed to get rating for ${productSIN}:`, e);
    return { calculatedScore: 0 };
  }
};

const sortAmazonResults = async () => {
  const items = document.querySelectorAll('.s-result-item[data-asin]:not([data-asin=""]):not(.AdHolder)');
  const seenASINs = new Set();
  const fetchPromises = [];
  const noRatingItems = [];
  const cache = getCache();

  for (const item of items) {
    const celWidget = item.querySelector('.s-shopping-adviser');
    if (celWidget) continue;

    const productSIN = item.getAttribute('data-asin');
    if (!productSIN || seenASINs.has(productSIN)) continue;

    seenASINs.add(productSIN);

    const numberOfRatingsElement =
      item.querySelector('[data-cy="reviews-block"] a span.a-size-mini') ||
      item.querySelector('[data-cy="reviews-block"] .a-row.a-size-small a span.a-size-small') ||
      item.querySelector('.sg-row .a-spacing-top-micro .a-link-normal span.a-size-base');

    if (!numberOfRatingsElement) {
      noRatingItems.push([0, item]);
      continue;
    }

    fetchPromises.push(
      getRatingScores(productSIN, numberOfRatingsElement, cache).then(({ calculatedScore }) => [
        calculatedScore,
        item,
      ])
    );
  }

  const results = await Promise.allSettled(fetchPromises);
  saveCache(cache);

  const itemsArr = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .concat(noRatingItems);

  itemsArr.sort(sortFunction);

  const searchResults =
    document.querySelector('.s-result-list.s-search-results') ||
    document.querySelector('#mainResults .s-result-list');

  if (searchResults && itemsArr.length > 0) {
    for (const [, item] of itemsArr) item.remove();
    const refNode = searchResults.firstChild;
    for (const [, item] of itemsArr) searchResults.insertBefore(item, refNode);
  }
};

(async function main() {
  const isSearchPage = () => /s\?k|s\?i|s\?|\/b\//.test(location.href);

  if (isSearchPage()) await sortAmazonResults();

  let navObs, navTimer;
  const onNavigate = () => {
    if (!isSearchPage()) return;
    clearTimeout(navTimer);
    if (navObs) navObs.disconnect();
    navObs = new MutationObserver(() => {
      clearTimeout(navTimer);
      navTimer = setTimeout(() => { navObs.disconnect(); sortAmazonResults(); }, 300);
    });
    navObs.observe(document.body, { childList: true, subtree: true });
  };

  const origPush = history.pushState;
  history.pushState = function() { origPush.apply(this, arguments); onNavigate(); };
  const origReplace = history.replaceState;
  history.replaceState = function() { origReplace.apply(this, arguments); onNavigate(); };
  window.addEventListener('popstate', onNavigate);
})();
