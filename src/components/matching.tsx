export const matchedPrducts = (
  scrapedName: string,
  targetName: string
): boolean => {
  const commonWords = [
    "the",
    "and",
    "with",
    "from",
    "for",
    "of",
    "year",
    "old",
    "single",
    "double",
  ];

  const scrapedTokens = scrapedName.toLowerCase().split(" ");
  const targetTokens = targetName.toLowerCase().split(" ");

  const scrapedWords = scrapedTokens.filter(
    (word) =>
      word.length > 2 && !commonWords.includes(word)
  );

  const targetWords = targetTokens.filter(
    (word) =>
      word.length > 2 && !commonWords.includes(word)
  );

  if (scrapedWords.length === 0) {
    return false;
  }

  let totalWeight = 0;
  let matchWeight = 0;

  scrapedWords.forEach((word, index) => {
    const positionWeight = 1 - (index / scrapedWords.length) * 0.5; 
    totalWeight += positionWeight;
    
    if (targetWords.some(
      (targetWord) => targetWord.includes(word) || word.includes(targetWord)
    )) {
      matchWeight += positionWeight;
    }
  });

  const matchPercentage = (matchWeight / totalWeight) * 100;

  if (matchPercentage >= 20) {
    console.log(`Scraped Name: ${scrapedName}`);
    console.log(`Target Name: ${targetName}`);
    console.log(`Filtered Scraped Words: ${scrapedWords.join(", ")}`);
    console.log(`Filtered Target Words: ${targetWords.join(", ")}`);
    console.log(`Match Weight: ${matchWeight.toFixed(2)}`);
    console.log(`Total Weight: ${totalWeight.toFixed(2)}`);
    console.log(`Weighted Match Percentage: ${matchPercentage.toFixed(2)}%`);
  }

  return matchPercentage >= 40;
};
