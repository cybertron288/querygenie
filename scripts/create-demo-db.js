/**
 * Create Demo SQLite Database
 * 
 * Creates a SQLite database with sample e-commerce data for MVP demo
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'demo.sqlite');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Remove existing database
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

console.log('Creating demo SQLite database...');

// Create database
const db = new Database(dbPath);

try {
  // Create tables
  console.log('Creating tables...');
  
  // Users table
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active',
      total_orders INTEGER DEFAULT 0,
      total_spent DECIMAL(10,2) DEFAULT 0.00
    )
  `);

  // Products table
  db.exec(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      stock INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1
    )
  `);

  // Orders table
  db.exec(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Order items table
  db.exec(`
    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL,
      total_price DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // Insert sample data
  console.log('Inserting sample data...');

  // Sample users
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, status, total_orders, total_spent)
    VALUES (?, ?, ?, ?, ?)
  `);

  const users = [
    ['John Smith', 'john@example.com', 'active', 5, 2450.00],
    ['Jane Doe', 'jane@example.com', 'active', 3, 1230.50],
    ['Mike Johnson', 'mike@example.com', 'active', 8, 3420.75],
    ['Sarah Williams', 'sarah@example.com', 'inactive', 2, 450.25],
    ['David Brown', 'david@example.com', 'active', 12, 5670.80],
    ['Lisa Davis', 'lisa@example.com', 'active', 4, 1890.60],
    ['Tom Wilson', 'tom@example.com', 'active', 6, 2340.45],
    ['Emily Chen', 'emily@example.com', 'active', 9, 4120.30],
    ['Alex Rodriguez', 'alex@example.com', 'active', 3, 980.75],
    ['Maria Garcia', 'maria@example.com', 'active', 7, 3250.90]
  ];

  users.forEach(user => insertUser.run(...user));

  // Sample products
  const insertProduct = db.prepare(`
    INSERT INTO products (name, category, price, stock, is_active)
    VALUES (?, ?, ?, ?, ?)
  `);

  const products = [
    ['iPhone 15 Pro', 'Electronics', 999.99, 50, 1],
    ['MacBook Air M2', 'Electronics', 1199.99, 25, 1],
    ['Nike Air Jordan', 'Footwear', 189.99, 100, 1],
    ['Adidas Ultraboost', 'Footwear', 159.99, 75, 1],
    ['Sony WH-1000XM4', 'Electronics', 349.99, 40, 1],
    ['Levi\'s 501 Jeans', 'Clothing', 89.99, 200, 1],
    ['Coffee Maker Pro', 'Home & Garden', 299.99, 30, 1],
    ['Yoga Mat Premium', 'Sports', 59.99, 80, 1],
    ['Gaming Chair X1', 'Furniture', 399.99, 15, 1],
    ['Wireless Mouse', 'Electronics', 49.99, 150, 1],
    ['Bluetooth Speaker', 'Electronics', 129.99, 60, 1],
    ['Running Shoes Pro', 'Footwear', 139.99, 90, 1],
    ['Laptop Backpack', 'Accessories', 79.99, 120, 1],
    ['Desk Lamp LED', 'Home & Garden', 89.99, 45, 1],
    ['Water Bottle Steel', 'Sports', 29.99, 200, 1]
  ];

  products.forEach(product => insertProduct.run(...product));

  // Sample orders
  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, total_amount, status, created_at)
    VALUES (?, ?, ?, ?)
  `);

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Generate sample orders
  const statuses = ['completed', 'pending', 'shipped', 'cancelled'];
  const orders = [];
  
  for (let i = 1; i <= 50; i++) {
    const userId = Math.floor(Math.random() * 10) + 1;
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const createdAt = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString();
    
    // Insert order
    const result = insertOrder.run(userId, 0, status, createdAt); // Will update total later
    const orderId = result.lastInsertRowid;
    
    // Add 1-4 items per order
    const numItems = Math.floor(Math.random() * 4) + 1;
    let orderTotal = 0;
    
    for (let j = 0; j < numItems; j++) {
      const productId = Math.floor(Math.random() * 15) + 1;
      const quantity = Math.floor(Math.random() * 3) + 1;
      
      // Get product price
      const product = db.prepare('SELECT price FROM products WHERE id = ?').get(productId);
      const unitPrice = product.price;
      const totalPrice = unitPrice * quantity;
      orderTotal += totalPrice;
      
      insertOrderItem.run(orderId, productId, quantity, unitPrice, totalPrice);
    }
    
    // Update order total
    db.prepare('UPDATE orders SET total_amount = ? WHERE id = ?').run(orderTotal, orderId);
  }

  console.log('✅ Demo database created successfully!');
  console.log(`Database location: ${dbPath}`);
  console.log('Tables created: users, products, orders, order_items');
  console.log('Sample data: 10 users, 15 products, 50 orders');

} catch (error) {
  console.error('❌ Error creating demo database:', error);
} finally {
  db.close();
}