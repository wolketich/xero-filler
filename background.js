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

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Xero Budget Manager extension installed');
});

// Keep service worker alive if needed
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "keepAlive") {
    sendResponse({success: true});
  }
  return true;
});