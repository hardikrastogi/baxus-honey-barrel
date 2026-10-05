console.log("ReserveBar Content Script loaded");

// Track if this script is active
let isActive = true;

function scrapePageData() {
  const h1Elements = document.querySelectorAll("h1");
  const h1Content: string[] = [];

  if (h1Elements.length > 0) {
    h1Elements.forEach((element) => {
      if (element.textContent) {
        h1Content.push(element.textContent);
      }
    });
  }

  const priceInfo = findPriceInformation();
  const productDetails = findProductDetails();

  return {
    success: true,
    h1Content,
    priceInfo,
    spiritType: productDetails?.spiritType || null,
    productDetails,
  };
}

function findPriceInformation() {
  const priceSelectors = [
    "h3.font-bold.subpixel-antialiased.font-sourceSans3",
    "h3.font-bold.subpixel-antialiased.font-sourceSans3.text-\\[18px\\].md\\:text-\\[22px\\].lg\\:text-\\[24px\\]",
    "[data-sentry-element='Component'][data-sentry-component='Typography']",
  ];

  for (const selector of priceSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      for (const el of elements) {
        if (el.textContent && el.textContent.trim()) {
          return {
            selector: selector,
            text: el.textContent.trim().replace(/\s+/g, " "),
          };
        }
      }
    }
  }

  const priceTextPatterns = [
    "Price:",
    "Total:",
    "Cost:",
    "Sale Price:",
    "Regular Price:",
  ];

  for (const pattern of priceTextPatterns) {
    const xpath = `//*[contains(text(), '${pattern}')]`;
    const elements = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

    for (let i = 0; i < elements.snapshotLength; i++) {
      const element = elements.snapshotItem(i) as Node;
      if (element && element.textContent) {
        const text = element.textContent.trim();

        if (/(\$|€|£|¥)\s*\d+([.,]\d+)?/.test(text)) {
          return {
            selector: `xpath-match:${pattern}`,
            text: text,
          };
        }
      }
    }
  }

  const bodyText = document.body.textContent || "";
  const priceMatch = bodyText.match(/(\$|€|£|¥)\s*\d+([.,]\d+)?/);

  if (priceMatch) {
    return {
      selector: "regex-match",
      text: priceMatch[0].trim(),
    };
  }

  return null;
}

function findProductDetails() {
  const productPropertiesContainer = document.querySelector('div[data-testid="product-properties"][data-sentry-component="ProductProperties"]');
  
  if (!productPropertiesContainer) {
    return { spiritType: null };
  }

  const propertyRows = productPropertiesContainer.querySelectorAll('div.flex.flex-row.gap-\\[10px\\]');
  
  for (const row of propertyRows) {
    const elements = row.querySelectorAll('p[data-sentry-element="Component"][data-sentry-component="Typography"]');
    
    if (elements.length >= 2) {
      const label = elements[0].textContent?.trim().toLowerCase();
      const value = elements[1].textContent?.trim();
      
      if (label === 'type' && value) {
        return { spiritType: {
          selector: 'p[data-sentry-element="Component"][data-sentry-component="Typography"]',
          text: value
        } };
      }
    }
  }

  return { spiritType: null };
}

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  console.log("ReserveBar content script received message:", message);

  if (message.action === "scrapeH1") {
    try {
      const results = scrapePageData();
      sendResponse(results);
    } catch (error) {
      sendResponse({
        success: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true; 
  }
  
  if (message.action === "domainChanged") {
    isActive = message.domain === "reservebar.com";
    console.log(`ReserveBar script is now ${isActive ? 'active' : 'inactive'}`);
    sendResponse({ received: true });
    return true;
  }
});

chrome.runtime.sendMessage({ 
  action: "contentScriptReady", 
  domain: "reservebar.com" 
}).catch(error => {
  console.log("Could not connect to background script yet, which is expected on initial load", error);
});

// Debounced so bursts of DOM changes produce a single re-scrape
let changeTimer: ReturnType<typeof setTimeout> | undefined;

const observer = new MutationObserver((mutations) => {
  if (!isActive) return;

  const hasRelevantChange = mutations.some((mutation) => {
    // characterData mutations target Text nodes, which have no closest()/matches()
    const target =
      mutation.target instanceof Element
        ? mutation.target
        : mutation.target.parentElement;
    return !!target?.closest(
      'h1, .price, [itemprop="price"], [data-price], [data-sentry-component="Typography"]'
    );
  });

  if (hasRelevantChange) {
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => {
      chrome.runtime.sendMessage({ action: "contentChanged" }).catch((error) => {
        console.log("Error sending content changed message:", error);
      });
    }, 300);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

export {};
