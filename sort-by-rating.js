let checkedProducts = [];

const getTLD = () =>
  window.location.origin.endsWith('.co.uk') ? 'co.uk' : window.location.origin.split('.').pop();

const numberWithCommas = (x) => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const sortFunction = (a, b) => (a[0] === b[0] ? 0 : a[0] < b[0] ? 1 : -1);

const htmlToElement = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
};

const getRatingPercentage = (ratingText) => {
  const template = htmlToElement(ratingText);
  const reviewElement = template.querySelector('.totalRatingCount');
  const totalReviews = parseInt(reviewElement.textContent.replace(/\D/g, ''), 10);
  const fiveStars = template.querySelector('.\\35 star')?.title?.match(/\d+(?=%)/g)?.[0] || 0;
  const oneStars = template.querySelector('.\\31 star')?.title?.match(/\d+(?=%)/g)?.[0] || 0;

  return { fiveStars, oneStars, totalReviews };
};

const getRatingScores = async (productSIN, elementToReplace) => {
  const ratingDetails = await fetch(
    `https://www.amazon.${getTLD()}/gp/customer-reviews/widgets/average-customer-review/popover/ref=dpx_acr_pop_?contextId=dpx&asin=${productSIN}`,
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
  const itemsArr = [];
  const items = document.querySelectorAll('[data-asin]:not([data-asin=""]):not(.AdHolder)');

  for (const item of items) {
    const numberOfRatingsElement = item.querySelector(
      '.sg-row .a-spacing-top-micro .a-link-normal span.a-size-base'
    );
    const celWidget = item.querySelector('.s-shopping-adviser');
    if (!numberOfRatingsElement || celWidget) continue;

    const productSIN = item.getAttribute('data-asin');
    if (!productSIN || checkedProducts.includes(productSIN)) continue;

    const { calculatedScore } = await getRatingScores(productSIN, numberOfRatingsElement);
    itemsArr.push([calculatedScore, item]);
  }

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
