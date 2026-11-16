/**
 * Read/write Shopify template JSON (supports auto-generated header comments).
 */
const fs = require('fs');

const PRODUCT_JSON_HEADER = `/*
 * ------------------------------------------------------------
 * IMPORTANT: The contents of this file are auto-generated.
 *
 * This file may be updated by the Shopify admin theme editor
 * or related systems. Please exercise caution as any changes
 * made to this file may be overwritten.
 * ------------------------------------------------------------
 */
`;

function readShopifyJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  return JSON.parse(raw);
}

function writeShopifyJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function writeProductJson(filePath, data) {
  fs.writeFileSync(filePath, PRODUCT_JSON_HEADER + JSON.stringify(data, null, 2) + '\n');
}

module.exports = { readShopifyJson, writeShopifyJson, writeProductJson, PRODUCT_JSON_HEADER };
