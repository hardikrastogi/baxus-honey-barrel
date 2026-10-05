// Map of domains to content script files
const domainScriptMap = {
  'unicornauctions.com': 'content-scripts/unicorn.js',
  'reservebar.com': 'content-scripts/reserve.js',
  'sothebys.com': 'content-scripts/sothebys.js',
  'wine-searcher.com': 'content-scripts/wine.js'
};

// MV3 service workers are suspended when idle, which wipes in-memory variables.
// Tracking state is kept in chrome.storage.session so it survives restarts:
//   currentTabId, currentDomain - the active supported tab and its domain
//   readyTabs - { [tabId]: domain[] } of content scripts that reported ready
async function loadState() {
  const { currentTabId = null, currentDomain = null, readyTabs = {} } =
    await chrome.storage.session.get(['currentTabId', 'currentDomain', 'readyTabs']);
  return { currentTabId, currentDomain, readyTabs };
}

function saveState(changes) {
  return chrome.storage.session.set(changes);
}

// Listen for content script ready messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "contentScriptReady" && sender.tab) {
    // Respond to the content script right away; tracking is updated async
    sendResponse({ received: true });
    handleContentScriptReady(sender.tab.id, message.domain);
    return false;
  }

  // Handle other messages here if needed
  return false;
});

async function handleContentScriptReady(tabId, domain) {
  console.log(`Content script for ${domain} is ready on tab ${tabId}`);

  try {
    const { currentTabId, currentDomain, readyTabs } = await loadState();

    // Mark this script as ready
    const domains = new Set(readyTabs[tabId] || []);
    domains.add(domain);
    readyTabs[tabId] = [...domains];
    await saveState({ readyTabs });

    // If we're already tracking a current domain, update the content scripts
    if (currentTabId === tabId && currentDomain) {
      notifyDomainChange(tabId, currentDomain, readyTabs);
    }
  } catch (error) {
    console.error('Error registering content script:', error);
  }
}

// Listen for tab updates (including URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    handleTabUpdate(tabId, tab.url);
  }
});

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      handleTabUpdate(tab.id, tab.url);
    }
  } catch (error) {
    console.error('Error getting tab:', error);
  }
});

// Listen for tab removal to clean up our tracking
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const { currentTabId, readyTabs } = await loadState();
    const changes = {};

    if (readyTabs[tabId]) {
      delete readyTabs[tabId];
      changes.readyTabs = readyTabs;
      console.log(`Cleaned up tracking for closed tab ${tabId}`);
    }

    if (currentTabId === tabId) {
      changes.currentTabId = null;
      changes.currentDomain = null;
    }

    await saveState(changes);
  } catch (error) {
    console.error('Error cleaning up tab:', error);
  }
});

// Handle tab URL updates
async function handleTabUpdate(tabId, url) {
  try {
    // Extract domain from URL
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Find matching domain from our map (partial match)
    const matchedDomain = Object.keys(domainScriptMap).find(domain =>
      hostname.includes(domain)
    );

    const { currentTabId, currentDomain, readyTabs } = await loadState();

    // If domain changed, update current domain
    if (matchedDomain && (tabId !== currentTabId || matchedDomain !== currentDomain)) {
      console.log(`Switching to domain: ${matchedDomain} on tab ${tabId}`);
      await saveState({ currentTabId: tabId, currentDomain: matchedDomain });

      // Notify all content scripts about the domain change
      notifyDomainChange(tabId, matchedDomain, readyTabs);
    }
  } catch (error) {
    console.error('Error handling tab update:', error);
  }
}

// Function to notify content scripts about domain changes
async function notifyDomainChange(tabId, domain, readyTabs) {
  // Only notify if we know content scripts are ready
  if (!readyTabs[tabId]) {
    console.log(`No ready content scripts for tab ${tabId}`);
    return;
  }

  console.log(`Notifying content scripts in tab ${tabId} that domain is now ${domain}`);

  // Send the message to the tab
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'domainChanged',
      domain: domain
    });
  } catch (error) {
    console.log(`Error sending domain change notification: ${error.message}`);
  }
}
