import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(`
    #graphql
    query {
      products(first: 20) {
        nodes {
          id
          title
          totalInventory
          variants(first: 20) {
            nodes {
              inventoryItem {
                tracked
              }
            }
          }
        }
      }
    }
  `);

  const data = await response.json();

  const settings = await db.settings.findUnique({
    where: {
      shop: session.shop,
    },
  });

  const inventoryEvents = await db.inventoryEvent.findMany({
    where: {
      shop: session.shop,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  return {
    products: data.data.products.nodes,
    savedThreshold: settings?.threshold ?? 5,
    inventoryEvents,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const threshold = Number(formData.get("threshold"));

  await db.settings.upsert({
    where: {
      shop: session.shop,
    },
    update: {
      threshold: threshold,
    },
    create: {
      shop: session.shop,
      threshold: threshold,
    },
  });

  return { success: true };
};

export default function Index() {
  const { products, savedThreshold, inventoryEvents } = useLoaderData();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  useEffect(() => {
      const interval = setInterval(() => {
        revalidator.revalidate();
      }, 5000);

      return () => clearInterval(interval);
    }, [revalidator]);

  const [inputThreshold, setInputThreshold] = useState(savedThreshold);
  const [threshold, setThreshold] = useState(savedThreshold);

  const trackedProducts = products.filter((product) =>
      product.variants.nodes.some(
        (variant) => variant.inventoryItem?.tracked === true
      )
    );
 
  const totalProducts = trackedProducts.length;

  const criticalProducts = trackedProducts.filter(
    (product) => product.totalInventory <= 5
  ).length;

  const lowStockProducts = trackedProducts.filter(
    (product) =>
      product.totalInventory > 5 &&
      product.totalInventory <= threshold
  ).length;

  return (
    <s-page heading="Low Stock Manager">
      <s-section heading="Inventory Dashboard">
        <s-paragraph>
          Total products: {totalProducts}
        </s-paragraph>

        <s-paragraph>
          🟠 Low stock products: {lowStockProducts}
        </s-paragraph>

        <s-paragraph>
          🔴 Critical stock products: {criticalProducts}
        </s-paragraph>
      </s-section>
      <s-section heading="System status">
        <s-paragraph>
          Inventory monitoring active — stock changes are checked automatically.
        </s-paragraph>
      </s-section>
      <s-section heading="Inventory settings">
        <s-paragraph>
          Set the stock level at which a product should be considered low stock.
        </s-paragraph>

        <s-text-field
          label="Low stock threshold"
          type="number"
          value={inputThreshold}
          onInput={(e) => setInputThreshold(Number(e.target.value))}
        ></s-text-field>

        <s-button
          variant="primary"
          onClick={() => {
            setThreshold(inputThreshold);

            fetcher.submit(
              { threshold: inputThreshold },
              { method: "post" }
            );
          }}
        >
          Save threshold
        </s-button>
      </s-section>

     <s-section heading="Low stock products">
        {trackedProducts.filter((product) => product.totalInventory <= threshold).length === 0 ? (
          <s-paragraph>No low stock products.</s-paragraph>
        ) : (
          trackedProducts
            .filter((product) => product.totalInventory <= threshold)
            .map((product) => (
              <s-paragraph key={product.id}>
                {product.title} — Stock: {product.totalInventory} —{" "}
                {product.totalInventory <= 5
                  ? "🔴 CRITICAL STOCK"
                  : "🟠 LOW STOCK"}
              </s-paragraph>
            ))
        )}
      </s-section>
      <s-section heading="Inventory event history">
        {inventoryEvents.length === 0 ? (
          <s-paragraph>No inventory events yet.</s-paragraph>
        ) : (
          inventoryEvents.map((event) => (
            <s-paragraph key={event.id}>
              {event.productTitle ?? "Unknown product"} — Stock: {event.quantity} — Threshold: {event.threshold} — Status: {
                event.status === "CRITICAL"
                  ? "🔴 CRITICAL STOCK"
                  : event.status === "LOW_STOCK"
                  ? "🟠 LOW STOCK"
                  : "🟢 SUFFICIENT STOCK"
              } — {new Date(event.createdAt).toLocaleString()}
            </s-paragraph>
          ))
        )}
      </s-section>
    </s-page>
  );
}