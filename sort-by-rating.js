let checkedProducts = [];

const numberWithCommas = (x) => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const sortFunction = (a, b) => (a[0] === b[0] ? 0 : a[0] < b[0] ? 1 : -1);

const htmlToElement = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
};

const getRatingPercentage = (ratingText) => {
  const template = htmlToElement(ratingText);

  const totalReviews = parseInt(
    template
      .querySelector('[data-hook="total-review-count"]')
      .textContent.trim()
      .replace(/\D/g, ''),
    10
  );
  const fiveStars = parseInt(
    template
      .querySelector('#histogramTable li:first-child .a-section.a-spacing-none.a-text-right')
      .textContent.trim()
      .replace('%', ''),
    10
  );
  const oneStars = parseInt(
    template
      .querySelector(
        '#histogramTable li:last-child .a-section.a-spacing-none.a-text-right span:last-child'
      )
      .textContent.trim()
      .replace('%', ''),
    10
  );

  return { fiveStars, oneStars, totalReviews };
};

const getRatingScores = async (productSIN, elementToReplace) => {
  const ratingDetails = await fetch(
    `/gp/customer-reviews/widgets/average-customer-review/popover/ref=dpx_acr_pop_?contextId=dpx&asin=${productSIN}`,
    {
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
    }
  );

  const text = await ratingDetails.text();
  const { fiveStars, oneStars, totalReviews } = getRatingPercentage(text);

  const scorePercentage = fiveStars - oneStars;
  const scoreAbsolute = Math.round(totalReviews * (scorePercentage / 100));
  const calculatedScore = Math.round(scoreAbsolute * (scorePercentage / 100), 2) || 0;

  elementToReplace.innerHTML = ` ${numberWithCommas(calculatedScore)} ratio: (${scorePercentage}%)`;
  checkedProducts.push(productSIN);

  return { calculatedScore };
};

const sortAmazonResults = async () => {
  const items = document.querySelectorAll('[data-asin]:not([data-asin=""]):not(.AdHolder)');
  const fetchPromises = [];

  for (const item of items) {
    const numberOfRatingsElement =
      item.querySelector('[data-cy="reviews-block"] .a-row.a-size-small a span.a-size-small') ||
      item.querySelector('.sg-row .a-spacing-top-micro .a-link-normal span.a-size-base');
    const celWidget = item.querySelector('.s-shopping-adviser');
    if (!numberOfRatingsElement || celWidget) continue;

    const productSIN = item.getAttribute('data-asin');
    if (!productSIN || checkedProducts.includes(productSIN)) continue;

    fetchPromises.push(
      getRatingScores(productSIN, numberOfRatingsElement).then(({ calculatedScore }) => [
        calculatedScore,
        item,
      ])
    );
  }

  const results = await Promise.allSettled(fetchPromises);
  const itemsArr = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  itemsArr.sort(sortFunction);
  let searchResults =
    document.querySelector('.s-result-list.s-search-results') ||
    document.querySelector('#mainResults .s-result-list');

  if (searchResults && itemsArr.length > 0) {
    searchResults.innerHTML = '';
    for (const item of itemsArr) {
      searchResults.insertAdjacentHTML('beforeend', item[1].outerHTML);
    }
  }
};

(async function main() {
  if (window.location.href.match(/s\?k|s\?i|s\?|\/b\//)) {
    await sortAmazonResults();
  }
})();
