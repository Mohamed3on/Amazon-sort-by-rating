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

/*
	@desc 	Add a button to the page to sort options
	@return	nada
*/
const injectSortButton = async (ele) => {
  const button = document.createElement('button');
  button.innerHTML = `<i class="a-icon a-icon-dropdown"></i> Sort by Rating Count`;
  button.id = 'sort-by-rating-count';
  button.className = 'sort-by-rating-count';
  //   button.style.padding = "5px";
  ele.insertAdjacentHTML('beforeend', button.outerHTML);
  document.getElementById('sort-by-rating-count').addEventListener('click', async function (e) {
    e.preventDefault();
    await sortAmazonResults();
  });
};

/*
	  @desc 	See if we have a dropdown counter
	  @return	Element to attach to
  */
const checkForDropdown = () => {
  // type 1 pages
  // https://www.amazon.co.uk/s?k=tent&rh=n%3A3147471&ref=nb_sb_noss
  let dropdown = document.querySelector('.s-desktop-toolbar .a-dropdown-container');

  if (!dropdown) {
    //   type 2 pages
    // https://www.amazon.com/b/ref=dp_bc_aui_C_2?ie=UTF8&node=18457661011
    dropdown = document.getElementById('searchSortForm');

    if (dropdown) {
      pageType = 2;
    }
  }
  return dropdown;
};

const addCss = () => {
  const head = document.getElementsByTagName('head');
  let style = document.createElement('style');
  style.setAttribute('type', 'text/css');

  let css = `
  .sort-by-rating-count {
	  background: #f0c14b;
	  border-color: #a88734 #9c7e31 #846a29;
	  color: #111;
	  border-radius: 3px;
	  border-width: 1px;
	  cursor: pointer;
	  display: inline-block;
	  text-align: center;
	  text-decoration: none!important;
	  vertical-align: middle;
	  margin-left: 5px;
	  padding: 3px 5px;
  }
  #sort-by-rating-count .a-icon-dropdown {
	  margin-top: 4px;
  }
  .sbrc-highlight {
	  background-color: #fff686;
  }
  .sbrc-fade {
	  opacity: 60%;
  }
  .sbrc-highlight .s-item-container {
	  background-image: none !important;
	  background-size: 0 !important;
  }
  `;
  style.innerHTML = css;
  head[0].insertAdjacentElement('beforeend', style);
};

const sortAmazonResults = async () => {
  // function sortAmazonResults() {
  // List page: https://www.amazon.co.uk/s?k=rice+cooker&ref=nb_sb_noss_2
  // Block page: https://www.amazon.co.uk/s?k=ten+pegs&ref=nb_sb_noss_1

  const itemsArr = []; // to contain items [reviewcount, itemHtml] sorted by reviewcount
  let counter = 0;
  let items;

  if (pageType == 1) {
    items = document.querySelectorAll('.s-search-results .s-result-item');
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

      if (checkedProducts.includes(productSIN)) break;

      numberOfRatings = numberOfRatingsElement.innerHTML.split(',').join('');
      numberOfRatings = parseInt(numberOfRatings);
      const { scoreAbsolute, scorePercentage } = await getRatingScores(
        productSIN,
        numberOfRatingsElement,
        numberOfRatings
      );

      item.setAttribute('ratio', scorePercentage);

      itemsArr.push([scoreAbsolute, item]);
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

  bestProduct = { score: itemsArr[0][0], ratio: itemsArr[0][1].getAttribute('ratio') };

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
      let itemScore = item[0];
      let itemRatio = item[1].getAttribute('ratio');
      if (itemScore > bestProduct.score / 2 && itemRatio > bestProduct.ratio) {
        // highlight better products
        item[1].classList.add('sbrc-highlight');
        bestProduct = { score: itemScore, ratio: itemRatio };
      } else if (itemScore < bestProduct.score / 2) item[1].classList.add('sbrc-fade');

      searchResults.insertAdjacentHTML('beforeend', item[1].outerHTML);
    }
  }

  // reset
  searchResults = null;
  counter = 0;
  pageType = 1;
};

// https://stackoverflow.com/questions/16096872/how-to-sort-2-dimensional-array-by-column-value
function sortFunction(a, b) {
  if (a[0] === b[0]) {
    return 0;
  } else {
    return a[0] < b[0] ? 1 : -1;
  }
}

const getRatingPercentage = (ratingText) => {
  let matches = ratingText.match(/\d+(?=% of reviews have 5 stars)/g);
  let oneMatches;
  if (matches) {
    oneMatches = ratingText.match(/\d+(?=% of reviews have 1 stars)/g);
    return {
      fiveStars: ratingText.match(/\d+(?=% of reviews have 5 stars)/g)[0],
      oneStars: oneMatches ? oneMatches[0] : 0,
    };
  }

  fiveMatches = ratingText.match(/(?<=5 stars represent )(\d+)/g);
  oneMatches = ratingText.match(/(?<=1 stars represent )(\d+)/g);

  return {
    fiveStars: fiveMatches ? fiveMatches[0] : 0,
    oneStars: oneMatches ? oneMatches[0] : 0,
  };
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

  const scorePercentage = fiveStars - oneStars;
  const scoreAbsolute = Math.round(parseInt(numOfRatings) * (scorePercentage / 100));

  elementToReplace.innerHTML = ` ${numberWithCommas(scoreAbsolute)} ratio: (${scorePercentage}%)`;
  checkedProducts.push(productSIN);

  return { scorePercentage, scoreAbsolute };
};

(async function main() {
  if (
    window.location.href.includes('s?k') ||
    window.location.href.includes('s?') ||
    window.location.href.includes('/b/') ||
    window.location.href.includes('/b?')
  ) {
    // See if the page has a dropdown container for ordering options
    const dropdown = checkForDropdown();

    if (dropdown) {
      addCss();
      injectSortButton(dropdown);

      await sortAmazonResults();
    }
  }
})();
