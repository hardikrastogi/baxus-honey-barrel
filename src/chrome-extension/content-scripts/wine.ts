console.log("Wine Searcher Content Script loaded");

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
  const spiritType = findSpiritType();

  return {
    success: true,
    h1Content,
    priceInfo,
    spiritType,
  };
}

function findPriceInformation() {
  const priceSelectors = [
    ".price",
  ];

  for (const selector of priceSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      for (const el of elements) {
        const mainPriceElement = el.querySelector('.price__detail_main');
        if (mainPriceElement) {
          const currencySymbol = mainPriceElement.querySelector('.price__currency-symbol');
          const integerPart = mainPriceElement.querySelector('.price__integer-part');
          const fractionalPart = mainPriceElement.querySelector('.price__fractional-part');
          
          if (integerPart && integerPart.textContent) {
            let priceText = '';
            
            if (currencySymbol && currencySymbol.textContent) {
              priceText += currencySymbol.textContent.trim();
            }
            
            priceText += integerPart.textContent.trim();
            
            if (fractionalPart && fractionalPart.textContent) {
              priceText += fractionalPart.textContent.trim();
            }
            
            return {
              selector: `${selector} .price__detail_main`,
              text: priceText.replace(/\s+/g, " "),
            };
          }
        }
        
        if (el.textContent && el.textContent.trim()) {
          return {
            selector: selector,
            text: el.textContent.trim().replace(/\s+/g, " "),
          };
        }
      }
    }
  }

  const priceTextPatterns = ["Price:", "Total:", "Cost:", "Sale Price:"];

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

function findSpiritType() {
  const spiritElement = document.querySelector('.prod-profile__grape');
  
  if (spiritElement) {
    const spiritTypeElement = spiritElement.querySelector('.font-light-bold');
    
    if (spiritTypeElement && spiritTypeElement.textContent) {
      return {
        selector: '.prod-profile__grape .font-light-bold',
        text: spiritTypeElement.textContent.trim(),
      };
    }
  }
  
  return null;
}

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  console.log("Wine content script received message:", message);

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
    isActive = message.domain === "wine-searcher.com";
    console.log(`Wine Searcher script is now ${isActive ? 'active' : 'inactive'}`);
    sendResponse({ received: true });
    return true;
  }
});

chrome.runtime.sendMessage({ 
  action: "contentScriptReady", 
  domain: "wine-searcher.com" 
}).catch(error => {
  console.log("Could not connect to background script yet, which is expected on initial load",error);
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
      'h1, .price, [itemprop="price"], [data-price], .prod-profile__grape'
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
