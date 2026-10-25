import { authenticate, unauthenticated } from "../shopify.server";
import db from "../db.server";
import { sendTelegramMessage } from "../telegram.server";

export const action = async ({ request }) => {
  const { topic, shop, payload, session } = await authenticate.webhook(request);
  const { admin } = await unauthenticated.admin(shop);

  const inventoryItemId = `gid://shopify/InventoryItem/${payload.inventory_item_id}`;

    const response = await admin.graphql(
    `#graphql
    query GetInventoryItem($id: ID!) {
        inventoryItem(id: $id) {
        variant {
            product {
            title
            }
        }
        }
    }`,
    {
        variables: {
        id: inventoryItemId,
        },
    }
    );

    const data = await response.json();

    const productTitle =
    data.data.inventoryItem?.variant?.product?.title ?? "Unknown product";

    console.log("Product title:", productTitle);

    const settings = await db.settings.findUnique({
        where: {
        shop: shop,
        },
    });

    const threshold = settings?.threshold ?? 5;
    const quantity = payload.available;

    let status;

    if (quantity <= 5) {
      status = "CRITICAL";
    } else if (quantity <= threshold) {
      status = "LOW_STOCK";
    } else {
      status = "OK";
    }


  const previousEvent = await db.inventoryEvent.findFirst({
    where: {
      shop: shop,
      inventoryItemId: String(payload.inventory_item_id),
    },
    orderBy: {
      id: "desc",
    },
  });

  const statusChanged =
    previousEvent === null || previousEvent.status !== status;

  await db.inventoryEvent.create({
    data: {
      shop: shop,
      inventoryItemId: String(payload.inventory_item_id),
      productTitle: productTitle,
      quantity: quantity,
      threshold: threshold,
      status: status,
    },
  });

  console.log("Inventory webhook received!");
  console.log("Topic:", topic);
  console.log("Shop:", shop);
  console.log("Inventory item ID:", payload.inventory_item_id);
  console.log("New quantity:", quantity);
  console.log("Threshold:", threshold);
  console.log("Status:", status);
  console.log("Event saved to database!");

  let stockStatus;

  if (status === "CRITICAL") {
    stockStatus = "🔴 CRITICAL STOCK";
  } else if (status === "LOW_STOCK") {
    stockStatus = "🟠 LOW STOCK";
  } else {
    stockStatus = "🟢 SUFFICIENT STOCK";
  }

  const message =
    `📦 Product Stock Notification\n\n` +
    `Product: ${productTitle}\n` +
    `Quantity: ${quantity} units\n` +
    `Low stock threshold: ${threshold} units\n` +
    `Status: ${stockStatus}`;

    if (statusChanged) {
      await sendTelegramMessage(message);
      console.log("Telegram notification sent!");
    } else {
      console.log("Stock status unchanged. Telegram notification skipped.");
    }

  return new Response();
};