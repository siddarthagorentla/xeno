const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.send('Xeno Internship Assignment API');
});

// --- TENANT ONBOARDING ---
// In a real app, this would be the OAuth callback.
// For assignment, we manually add a tenant with their token.
app.post('/api/tenants', async (req, res) => {
    const { shopDomain, accessToken } = req.body;
    if (!shopDomain || !accessToken) {
        return res.status(400).json({ error: 'Missing logic' });
    }

    try {
        const tenant = await prisma.tenant.upsert({
            where: { shopDomain },
            update: { accessToken },
            create: { shopDomain, accessToken }
        });
        res.json(tenant);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to register tenant' });
    }
});

// --- INGESTION SERVICE ---
async function fetchShopifyData(url, accessToken) {
    let results = [];
    let nextUrl = url;

    while (nextUrl) {
        console.log(`Fetching: ${nextUrl}`);
        const response = await axios.get(nextUrl, {
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json'
            }
        });

        // Handle data array (products, customers, orders keys vary)
        const keys = Object.keys(response.data);
        const dataKey = keys.find(k => Array.isArray(response.data[k]));
        if (dataKey) {
            results = results.concat(response.data[dataKey]);
        }

        // Pagination
        const linkHeader = response.headers['link'];
        nextUrl = null;
        if (linkHeader) {
            const matches = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            if (matches) {
                nextUrl = matches[1];
            }
        }
    }
    return results;
}

app.post('/api/ingest', async (req, res) => {
    const { shopDomain } = req.body;

    try {
        const tenant = await prisma.tenant.findUnique({
            where: { shopDomain }
        });

        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        // 1. Ingest Customers
        // https://shopify.dev/docs/api/admin-rest/2023-10/resources/customer
        try {
            const customers = await fetchShopifyData(`https://${shopDomain}/admin/api/2023-10/customers.json?limit=250`, tenant.accessToken);

            for (const c of customers) {
                await prisma.customer.upsert({
                    where: {
                        tenantId_shopifyId: {
                            tenantId: tenant.id,
                            shopifyId: c.id.toString()
                        }
                    },
                    update: {
                        firstName: c.first_name,
                        lastName: c.last_name,
                        email: c.email,
                        totalSpent: c.total_spent
                    },
                    create: {
                        shopifyId: c.id.toString(),
                        firstName: c.first_name,
                        lastName: c.last_name,
                        email: c.email,
                        totalSpent: c.total_spent,
                        tenantId: tenant.id
                    }
                });
            }
            console.log(`Ingested ${customers.length} customers`);
        } catch (e) {
            console.error("Error ingesting customers", e.message);
        }

        // 2. Ingest Products
        try {
            const products = await fetchShopifyData(`https://${shopDomain}/admin/api/2023-10/products.json?limit=250`, tenant.accessToken);
            for (const p of products) {
                await prisma.product.upsert({
                    where: {
                        tenantId_shopifyId: {
                            tenantId: tenant.id,
                            shopifyId: p.id.toString()
                        }
                    },
                    update: {
                        title: p.title,
                        variants: JSON.stringify(p.variants)
                    },
                    create: {
                        shopifyId: p.id.toString(),
                        title: p.title,
                        variants: JSON.stringify(p.variants),
                        tenantId: tenant.id
                    }
                });
            }
            console.log(`Ingested ${products.length} products`);
        } catch (e) {
            console.error("Error ingesting products", e.message);
        }

        // 3. Ingest Orders
        try {
            const orders = await fetchShopifyData(`https://${shopDomain}/admin/api/2023-10/orders.json?status=any&limit=250`, tenant.accessToken);
            for (const o of orders) {
                // Find customer if exists
                let customerId = null;
                if (o.customer) {
                    const dbCust = await prisma.customer.findUnique({
                        where: {
                            tenantId_shopifyId: {
                                tenantId: tenant.id,
                                shopifyId: o.customer.id.toString()
                            }
                        }
                    });
                    if (dbCust) customerId = dbCust.id;
                }

                await prisma.order.upsert({
                    where: {
                        tenantId_shopifyId: {
                            tenantId: tenant.id,
                            shopifyId: o.id.toString()
                        }
                    },
                    update: {
                        totalPrice: o.total_price,
                        customerId: customerId
                    },
                    create: {
                        shopifyId: o.id.toString(),
                        totalPrice: o.total_price,
                        currency: o.currency,
                        createdAt: new Date(o.created_at),
                        customerId: customerId,
                        tenantId: tenant.id
                    }
                });
            }
            console.log(`Ingested ${orders.length} orders`);
        } catch (e) {
            console.error("Error ingesting orders", e.message);
        }

        res.json({ message: 'Ingestion started/completed successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// --- DASHBOARD ANALYTICS ---
app.get('/api/dashboard/:shopDomain', async (req, res) => {
    const { shopDomain } = req.params;
    const tenant = await prisma.tenant.findUnique({ where: { shopDomain } });
    if (!tenant) return res.status(404).json({ error: 'Not found' });

    const totalCustomers = await prisma.customer.count({ where: { tenantId: tenant.id } });
    const totalOrders = await prisma.order.count({ where: { tenantId: tenant.id } });

    // Total Revenue (aggregate)
    const revenue = await prisma.order.aggregate({
        where: { tenantId: tenant.id },
        _sum: { totalPrice: true }
    });

    // Orders over time (group by day) - doing raw or js processing
    // For simplicity, fetch all and group in JS (not efficient for large data but okay for assignment)
    // Or use Prisma groupBy if date can be truncated. Prisma doesn't support date truncation easily without raw query.
    // We will return last 30 orders for the chart.
    const recentOrders = await prisma.order.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    res.json({
        totalCustomers,
        totalOrders,
        totalRevenue: revenue._sum.totalPrice || 0,
        recentOrders
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
