// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("Custom Dashboard background script running.");
});

// Optional: set a default background URL
const DEFAULT_BG = "default-bg.jpg"; // put a local dark image in the folder

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getDefaultBg") {
    sendResponse({ url: DEFAULT_BG });
  }
});
