// Background script for Manifest V3
// Created: 2025-05-12 10:41:34
// Author: wolketich

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "executeContentScript") {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      files: ["content.js"]
    });
    sendResponse({ success: true });
  }
  return true;
});
