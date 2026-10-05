import { matchedPrducts } from "../../components/matching";
import { Card, CardContent } from "../../components/ui/card";
import "../global.css";
import { ChevronRight, Coins, Droplet, FileText } from "lucide-react";
import { useEffect, useState } from "react";

const LISTINGS_URL = "https://services.baxus.co/api/search/listings";
const PAGE_SIZE = 200;
// Safety cap so a misbehaving API can't make the popup loop forever
const MAX_LISTINGS = 5000;

// Parses the first price in a string, e.g. "$1,299.00", "1.299,00 €",
// "Estimate 1,000 – 2,000 USD" (→ 1000), "US$ 45"
const extractNumericPrice = (priceText: string): number | null => {
  const match = priceText.match(/\d[\d.,]*/);
  if (!match) return null;

  let num = match[0].replace(/[.,]+$/, "");
  const lastComma = num.lastIndexOf(",");
  const lastDot = num.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    // Both separators: whichever comes last is the decimal separator
    num =
      lastComma > lastDot
        ? num.replace(/\./g, "").replace(",", ".")
        : num.replace(/,/g, "");
  } else if (lastComma !== -1) {
    // Only commas: "12,50" is a decimal, "1,000" / "1,000,000" are thousands
    const decimals = num.length - lastComma - 1;
    const singleComma = num.indexOf(",") === lastComma;
    num =
      singleComma && decimals !== 3
        ? num.replace(",", ".")
        : num.replace(/,/g, "");
  } else if (lastDot !== -1 && num.indexOf(".") !== lastDot) {
    // Several dots can only be thousands separators: "1.000.000"
    num = num.replace(/\./g, "");
  }

  const value = parseFloat(num);
  return Number.isFinite(value) ? value : null;
};

// BAXUS prices are in USD, so only compare when the scraped price is too
const isUsdPrice = (priceText: string): boolean =>
  /\$|USD/i.test(priceText) && !/[€£¥]/.test(priceText);

export const Popup = () => {
  const [h1Content, setH1Content] = useState<string>("");
  const [priceInfo, setPriceInfo] = useState<{
    selector: string;
    text: string;
  } | null>(null);
  const [spiritType, setSpiritType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [matchingProducts, setMatchingProducts] = useState<any[]>([]);
  const [scrapedPrice, setScrapedPrice] = useState<number | null>(null);
  const [isloading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    console.log("Current URL:", currentUrl);
    console.log("Scraped price:", scrapedPrice);
  }, [currentUrl, scrapedPrice]);

  const findMatchingProducts = (scrapedName: string, apiData: any[]): any[] => {
    if (!scrapedName || !apiData || apiData.length === 0) {
      return [];
    }

    const cleanedScrapedName = scrapedName.toLowerCase().trim();
    console.log("Searching for matches for:", cleanedScrapedName);

    const matches = apiData.filter((product) => {
      const productName =
        product._source?.attributes?.Name || product._source?.name || "";

      if (!productName) return false;

      return matchedPrducts(cleanedScrapedName, productName.toLowerCase());
    });

    console.log(
      "Matches found:",
      matches.map((p) => p._source?.name || p._source?.attributes?.Name)
    );

    // Cheapest first
    return matches.sort(
      (a, b) =>
        (a._source?.price ?? Infinity) - (b._source?.price ?? Infinity)
    );
  };

  // Pages through the marketplace instead of only reading the first 200 listings
  const fetchAllListings = async (isCancelled: () => boolean) => {
    const listings: any[] = [];

    for (let from = 0; from < MAX_LISTINGS; from += PAGE_SIZE) {
      const response = await fetch(
        `${LISTINGS_URL}?from=${from}&size=${PAGE_SIZE}&listed=true`
      );
      if (!response.ok) {
        throw new Error(`BAXUS API responded with ${response.status}`);
      }

      const page = await response.json();
      if (!Array.isArray(page)) {
        throw new Error("Unexpected response from BAXUS API");
      }
      if (isCancelled()) return listings;

      listings.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    return listings;
  };

  useEffect(() => {
    // Nothing to match until the page has been scraped
    if (!h1Content || !scrapedPrice) {
      setMatchingProducts([]);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      console.log("Fetching data from API...");
      setIsLoading(true);
      setApiError(null);
      setMatchingProducts([]);

      try {
        const data = await fetchAllListings(() => cancelled);
        if (cancelled) return;

        const matches = findMatchingProducts(h1Content, data);
        console.log("Products:", matches);
        setMatchingProducts(matches);
      } catch (error) {
        console.error("Error fetching data:", error);
        if (!cancelled) {
          setApiError(
            error instanceof Error ? error.message : String(error)
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();

    // A newer scrape supersedes this fetch
    return () => {
      cancelled = true;
    };
  }, [h1Content, scrapedPrice]);

  const scrapePageData = () => {
    setLoading(true);
    setError(null);

    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (!activeTab || !activeTab.id) {
          setError("No active tab found");
          setLoading(false);
          return;
        }

        if (activeTab.url) {
          setCurrentUrl(activeTab.url);
        }

        chrome.tabs.sendMessage(
          activeTab.id,
          { action: "scrapeH1" },
          (response) => {
            if (chrome.runtime.lastError) {
              setError("Error: " + chrome.runtime.lastError.message);
              setLoading(false);
              return;
            }

            if (response && response.success) {
              console.log("response", response);

              // Skip empty/whitespace-only <h1> elements
              const productName =
                (response.h1Content as string[])
                  .map((text) => text.replace(/\s+/g, " ").trim())
                  .find((text) => text.length > 0) || "";
              setH1Content(productName);
              setPriceInfo(response.priceInfo || null);
              setScrapedPrice(
                response.priceInfo?.text
                  ? extractNumericPrice(response.priceInfo.text)
                  : null
              );
              setSpiritType(response.spiritType?.text || null);
            } else {
              setError(response?.message || "Failed to scrape content");
            }
            setLoading(false);
          }
        );
      });
    } catch (err) {
      setError("Error: " + (err instanceof Error ? err.message : String(err)));
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleContentChange = (message: any) => {
      if (message.action === "contentChanged") {
        scrapePageData();
      }
    };

    chrome.runtime.onMessage.addListener(handleContentChange);

    return () => {
      chrome.runtime.onMessage.removeListener(handleContentChange);
    };
  }, []);

  useEffect(() => {
    scrapePageData();
  }, []);

  const canCompare =
    scrapedPrice !== null && !!priceInfo && isUsdPrice(priceInfo.text);

  return (
    <div className="bg-white w-[400px] h-[500px] overflow-y-auto">
      <div className="max-w-md mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <div className="flex justify-center items-center text-2xl">
              <span className="font-semibold text-gray-800">BA</span>
              <img
                src="https://res.cloudinary.com/dgvnuwspr/image/upload/v1740441389/wdqjosbtpgjiyi1ovups.png"
                alt=""
                className="h-10 w-10"
              />
              <span className="font-semibold text-gray-800">US</span>
            </div>
          </div>
          <button
            onClick={scrapePageData}
            className="text-gray-500"
            title="Refresh data"
          >
            <span className="block w-6 h-0.5 bg-gray-500 mb-1.5"></span>
            <span className="block w-6 h-0.5 bg-gray-500"></span>
          </button>
        </div>

        <>

          {h1Content && scrapedPrice ? (
            <div className="mb-6">
              <h2 className="text-xs font-medium text-[#b89d7a] mb-2 uppercase">
                Product Information
              </h2>
              <Card className="shadow-none border border-gray-200">
                <CardContent className="p-4">
                  {loading ? (
                    <p className="text-gray-500">Loading content...</p>
                  ) : error ? (
                    <p className="text-black">
                      Reload the page to use the extension
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {h1Content ? (
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 mb-2">
                            Product Name:
                          </h3>
                          <div className="p-2 bg-gray-50 rounded-md">
                            <div className="flex items-center gap-2">
                              <FileText className="h-[16px] w-[16px] text-[#b89d7a]" />
                              <p className="font-medium text-gray-800">
                                {h1Content}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-500">
                          No product name found on this page
                        </p>
                      )}
                      {spiritType && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 mb-2">
                            Spirit Type:
                          </h3>
                          <div className="p-2 bg-gray-50 rounded-md">
                            <div className="flex items-center gap-2">
                              <Droplet className="h-[16px] w-[16px] text-[#b89d7a]" />
                              <p className="font-medium text-gray-800">
                                {spiritType}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {priceInfo ? (
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 mb-2">
                            Price Information:
                          </h3>
                          <div className="p-2 bg-gray-50 rounded-md">
                            <div className="flex items-center gap-2">
                              <Coins className="h-[16px] w-[16px] text-[#b89d7a]" />
                              <p className="font-medium text-gray-800">
                                {priceInfo.text}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-500">
                          No price information found on this page
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-xs font-medium text-[#b89d7a] mb-2 uppercase">
                Product Information
              </h2>

              <Card className="shadow-none border border-gray-200">
                <CardContent className="p-4">
                  <p className="text-black">
                    No product information found on this page. Open a product
                    page to use the extension.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {matchingProducts.length > 0 ? (
            <div className="mb-6">
              <h2 className="text-xs font-medium text-[#b89d7a] mb-2 uppercase">
                Price Comparison
              </h2>
              <Card className="shadow-none border border-gray-200">
                <CardContent className="p-0">
                  {matchingProducts.map((product, index) => {
                    const baxusPrice: number | undefined =
                      product._source?.price;
                    const difference =
                      canCompare && typeof baxusPrice === "number"
                        ? scrapedPrice! - baxusPrice
                        : null;

                    return (
                      <a
                        key={product._source?.id ?? index}
                        href={`https://www.baxus.co/asset/${product._source.id}`}
                        target="_blank"
                        className="block p-4 border-b border-gray-200 last:border-b-0 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-4">
                          {product._source?.imageUrl && (
                            <img
                              src={product._source.imageUrl}
                              alt={product._source.name}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-800">
                              {product._source.name}
                            </h3>
                            <div className="flex items-center gap-2">
                              {typeof baxusPrice === "number" && (
                                <p className="text-[#b89d7a] font-medium">
                                  ${baxusPrice.toFixed(2)}
                                </p>
                              )}
                              {difference !== null && difference > 0 && (
                                <span className="text-xs font-medium text-green-700 bg-green-50 rounded px-1.5 py-0.5">
                                  Save ${difference.toFixed(2)}
                                </span>
                              )}
                              {difference !== null && difference < 0 && (
                                <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">
                                  ${Math.abs(difference).toFixed(2)} more
                                </span>
                              )}
                              {difference === 0 && (
                                <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">
                                  Same price
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                  {!canCompare && priceInfo && (
                    <p className="px-4 py-2 text-xs text-gray-500">
                      This page isn't priced in USD, so savings aren't calculated.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xs font-medium text-[#b89d7a] mb-2 uppercase">
                  Price Comparison
                </h2>
                {isloading && h1Content && scrapedPrice ? (
                  <Card className="shadow-none border border-gray-200">
                    <CardContent className="p-0">
                      <div className="p-4">
                        <p className="text-black">
                          Fetching data from BAXUS marketplace...
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : apiError && h1Content && scrapedPrice ? (
                  <Card className="shadow-none border border-gray-200">
                    <CardContent className="p-0">
                      <div className="p-4">
                        <p className="text-black">
                          Couldn't reach the BAXUS marketplace ({apiError}).
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : h1Content && scrapedPrice ? (
                  <Card className="shadow-none border border-gray-200">
                    <CardContent className="p-0">
                      <div className="p-4">
                        <p className="text-black">No products found.</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="shadow-none border border-gray-200">
                    <CardContent className="p-0">
                      <div className="p-4">
                        <p className="text-black">
                          Search for a product to see price comparisons.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}

          <div className="mb-6">
            <h2 className="text-xs font-medium text-[#b89d7a] mb-2 uppercase">
              Explore the marketplace
            </h2>
            <Card className="shadow-none border border-gray-200">
              <CardContent className="p-0">
                <a
                  href="https://www.baxus.co/"
                  target="_blank"
                  className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src="https://res.cloudinary.com/dgvnuwspr/image/upload/v1740441389/wdqjosbtpgjiyi1ovups.png"
                      alt=""
                      className="h-5 w-5"
                    />
                    <span className="font-medium text-gray-800">BAXUS</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </a>
              </CardContent>
            </Card>
          </div>
        </>
      </div>
    </div>
  );
};
