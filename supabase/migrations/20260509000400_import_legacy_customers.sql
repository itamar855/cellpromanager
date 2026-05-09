-- Import missing customers from service_orders
INSERT INTO customers (name, phone, cpf, created_by, store_id, created_at)
SELECT DISTINCT ON (LOWER(customer_name), customer_phone)
    customer_name,
    customer_phone,
    customer_cpf,
    created_by,
    store_id,
    created_at
FROM service_orders
WHERE customer_name IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM customers 
    WHERE LOWER(customers.name) = LOWER(service_orders.customer_name)
)
ON CONFLICT DO NOTHING;

-- Import missing customers from sales
INSERT INTO customers (name, phone, cpf, created_by, store_id, created_at)
SELECT DISTINCT ON (LOWER(customer_name), customer_phone)
    customer_name,
    customer_phone,
    customer_cpf,
    created_by,
    store_id,
    created_at
FROM sales
WHERE customer_name IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM customers 
    WHERE LOWER(customers.name) = LOWER(sales.customer_name)
)
ON CONFLICT DO NOTHING;
