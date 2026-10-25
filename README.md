# Low Stock Manager

The idea is to help store owners keep track of their product stock. The app checks inventory changes, shows which products are running low, and sends Telegram messages when a product's stock status changes.

## Features

- Shows products with low or critical stock.
- Lets the user set a low stock threshold.
- Sends Telegram notifications when the stock status changes.
- Saves inventory changes in a database.
- Shows recent inventory changes in the app.
- Has a simple dashboard with product statistics.
- Refreshes the displayed data every 5 seconds.

## How it works

When a product's stock changes in Shopify, Shopify sends a webhook to the app.

The app then:

1. Gets the product name using the Shopify API.
2. Checks the new stock quantity.
3. Compares the quantity with the low stock threshold.
4. Saves the change in the database.
5. Checks whether the stock status has changed.
6. Sends a Telegram message if the status is different from the previous one.

For example, if the low stock threshold is set to 30:

| Stock quantity | Status |
|---|---|
| 0–5 | Critical Stock |
| 6–30 | Low Stock |
| More than 30 | Sufficient Stock |

The critical stock limit is currently fixed at 5.

The app does not send a Telegram message for every quantity change. It only sends one when the stock status changes, so the user doesn't get too many notifications.

## Technologies used

- JavaScript
- Node.js
- React Router
- Shopify API and Webhooks
- Prisma
- SQLite
- Telegram Bot API