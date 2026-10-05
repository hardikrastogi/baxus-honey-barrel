console.log("Sotheby's Content Script loaded");

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
  return {
    success: true,
    h1Content,
    priceInfo,
  };
}

function findPriceInformation() {
  const priceRow = document.querySelector(".information_pdp_priceRow__wwkqL");
  if (priceRow) {
    const priceLabels = priceRow.querySelectorAll(".label-module_label16Medium__Z4VRX");
    if (priceLabels.length >= 2 && priceLabels[1].textContent) {
      return {
        selector: ".information_pdp_priceRow__wwkqL .label-module_label16Medium__Z4VRX",
        text: priceLabels[1].textContent.trim(),
      };
    }
  }

  const primaryPrice = document.querySelector(
    ".label-module_label16Medium__Z4VRX"
  );
  if (primaryPrice && primaryPrice.textContent) {
    return {
      selector: ".label-module_label16Medium__Z4VRX",
      text: primaryPrice.textContent.trim(),
    };
  }

  const sothebysPrice = document.querySelector(
    ".paragraph-module_paragraph14Regular__Zfr98.css-137o4wl"
  );
  if (sothebysPrice && sothebysPrice.textContent) {
    return {
      selector: ".paragraph-module_paragraph14Regular__Zfr98.css-137o4wl",
      text: sothebysPrice.textContent.trim(),
    };
  }

  const alternativePriceElement = document.querySelector(
    ".LotPage-estimatePrice"
  );
  if (alternativePriceElement && alternativePriceElement.textContent) {
    return {
      selector: ".LotPage-estimatePrice",
      text: alternativePriceElement.textContent.trim(),
    };
  }

  return null;
}

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  console.log("Sotheby's content script received message:", message);

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
    isActive = message.domain === "sothebys.com";
    console.log(`Sotheby's script is now ${isActive ? "active" : "inactive"}`);
    sendResponse({ received: true });
    return true;
  }
});

chrome.runtime
  .sendMessage({
    action: "contentScriptReady",
    domain: "sothebys.com",
  })
  .catch((error) => {
    console.log(
      "Could not connect to background script yet, which is expected on initial load",
      error
    );
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
      "h1, .information_pdp_priceRow__wwkqL, .paragraph-module_paragraph14Regular__Zfr98.css-137o4wl, .LotPage-estimatePrice"
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
