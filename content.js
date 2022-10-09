(Element.prototype.appendAfter = function (element) {
  element.parentNode.insertBefore(this, element.nextSibling);
}),
  false;

let checkedProducts = [];

let bestProduct;

const getTLD = () => {
  const isUK = window.location.origin.endsWith('.co.uk');
  if (isUK) return 'co.uk';
  return window.location.origin.split('.').pop();
};

const numberWithCommas = (x) => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/*
	  Tested pages:
	  Type 1: https://www.amazon.co.uk/s?k=tent&rh=n%3A3147471&ref=nb_sb_noss
	  Type 2: https://www.amazon.com/b/ref=dp_bc_aui_C_2?ie=UTF8&node=18457661011
	Type 3: https://www.amazon.com/b?node=18854668011
  */

/*
	  Constants & Variables
  */
('use strict');

let pageType = 1;

const sortAmazonResults = async () => {
  // function sortAmazonResults() {
  // List page: https://www.amazon.co.uk/s?k=rice+cooker&ref=nb_sb_noss_2
  // Block page: https://www.amazon.co.uk/s?k=ten+pegs&ref=nb_sb_noss_1

  const itemsArr = []; // to contain items [reviewcount, itemHtml] sorted by reviewcount
  let counter = 0;
  let items;

  if (pageType == 1) {
    items = document.querySelectorAll('[data-asin]:not([data-asin=""])');
  } else {
    items = document.querySelectorAll('.s-result-list .s-result-item');
  }

  for (let item of items) {
    // get the rating count
    let numberOfRatingsElement;
    let celWidget;

    if (pageType == 1) {
      //*[@id="search"]/div[1]/div[2]/div/span[4]/div[1]/div[3]/div/span/div/div/div[2]/div[2]/div/div[1]/div/div/div[2]/div/span[2]/a/span
      //*[@id="search"]/div[1]/div[2]/div/span[4]/div[1]/div[7]/div/span/div/div/div[2]/div[2]/div/div[1]/div/div/div[2]/div/span[2]/a/span

      numberOfRatingsElement = item.querySelector(
        '.sg-row .a-spacing-top-micro .a-link-normal span.a-size-base'
      );

      // make sure it's not an widget block
      celWidget = item.querySelector('.s-shopping-adviser');
    } else {
      // type 2
      numberOfRatingsElement = item.querySelector(
        'div.a-row.a-spacing-top-micro > a.a-link-normal'
      );

      // Haven't seen a widgetblock, but kept in
      celWidget = item.querySelector('.s-shopping-adviser');
    }

    if (!numberOfRatingsElement) {
      // Another page type!
      // https://www.amazon.com/b?node=18854668011
      // @MO: Left this here rather in the if/else as it's a final catch attempt
      numberOfRatingsElement = item.querySelector('div.a-row.a-spacing-mini > a.a-link-normal');
    }

    if (numberOfRatingsElement && !celWidget) {
      const productSIN = item.getAttribute('data-asin');

      if (!productSIN) {
        continue;
      }

      if (checkedProducts.includes(productSIN)) continue;

      numberOfRatings = numberOfRatingsElement.innerHTML.match(/\d/g).join('');
      numberOfRatings = parseInt(numberOfRatings);
      const { calculatedScore } = await getRatingScores(
        productSIN,
        numberOfRatingsElement,
        numberOfRatings
      );

      itemsArr.push([calculatedScore, item]);
    } else {
      // keeps each one unique
      counter--;
      // stick it to the bottom if a content block
      const position = celWidget ? -1000 : counter;
      itemsArr.push([position, item]);
    }
  }

  // sort the items by review count
  itemsArr.sort(sortFunction);

  // Delete existing items

  // Type 1
  // https://www.amazon.co.uk/s?k=tent&rh=n%3A3147471&ref=nb_sb_noss
  let searchResults = document.querySelectorAll('.s-result-list.s-search-results')[1];

  if (!searchResults) {
    // Type 2
    // https://www.amazon.com/b/ref=dp_bc_aui_C_2?ie=UTF8&node=18457661011
    searchResults = document.querySelector('#mainResults .s-result-list');
  }

  // Let's not blank anything out if there are no items or no container
  if (searchResults && itemsArr.length > 0) {
    searchResults.innerHTML = '';

    // Append in order to the page
    for (let item of itemsArr) {
      searchResults.insertAdjacentHTML('beforeend', item[1].outerHTML);
    }
  }

  // reset
  searchResults = null;
  counter = 0;
  pageType = 1;
};

function sortFunction(a, b) {
  if (a[0] === b[0]) {
    return 0;
  } else {
    return a[0] < b[0] ? 1 : -1;
  }
}

function htmlToElement(html) {
  var template = document.createElement('template');
  html = html.trim(); // Never return a text node of whitespace as the result
  template.innerHTML = html;
  return template.content.firstChild;
}

const getRatingPercentage = (ratingText) => {
  const template = htmlToElement(ratingText);
  const fiveStarRatingsText = template.getElementsByClassName('5star')?.[0]?.getAttribute('title');
  const oneStarRatingsText = template.getElementsByClassName('1star')?.[0]?.getAttribute('title');
  const oneStars = oneStarRatingsText?.match(/\d+(?=%)/g)?.[0] || 0;
  const fiveStars = fiveStarRatingsText?.match(/\d+(?=%)/g)?.[0] || 0;
  return {
    fiveStars,
    oneStars,
  };

  // fiveMatches = ratingText.match(/(?<=5 stars represent )(\d+)/g);
  // oneMatches = ratingText.match(/(?<=1 stars represent )(\d+)/g);

  // return {
  //   fiveStars: fiveMatches ? fiveMatches[0] : 0,
  //   oneStars: oneMatches ? oneMatches[0] : 0,
  // };
};

const getRatingScores = async (productSIN, elementToReplace, numOfRatings) => {
  const ratingDetails = await fetch(
    `https://www.amazon.${getTLD()}/gp/customer-reviews/widgets/average-customer-review/popover/ref=dpx_acr_pop_?contextId=dpx&asin=${productSIN}`,
    {
      body: null,
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
    }
  );

  const text = await ratingDetails.text();
  const { fiveStars, oneStars } = getRatingPercentage(text);

  if (!fiveStars && !oneStars) {
    throw new Error('No ratings found');
  }

  const scorePercentage = fiveStars - oneStars;
  const scoreAbsolute = Math.round(parseInt(numOfRatings) * (scorePercentage / 100));

  const calculatedScore = Math.round(scoreAbsolute * (scorePercentage / 100), 2);

  elementToReplace.innerHTML = ` ${numberWithCommas(calculatedScore)} ratio: (${scorePercentage}%)`;
  checkedProducts.push(productSIN);

  return { calculatedScore };
};

(async function main() {
  if (
    window.location.href.includes('s?k') ||
    window.location.href.includes('s?i') ||
    window.location.href.includes('s?') ||
    window.location.href.includes('/b/') ||
    window.location.href.includes('/b?')
  ) {
    await sortAmazonResults();
  }
})();
