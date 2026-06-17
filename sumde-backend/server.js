require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Logger middleware (optional, for debug)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Data tidak lengkap.' });
    }
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    if (existingUser) {
      return res.status(400).json({ error: 'Email sudah terdaftar.' });
    }
    const user = await prisma.user.create({
      data: {
        email,
        password,
        name,
        role: 'customer'
      }
    });
    const { password: _, ...userData } = user;
    res.status(201).json(userData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    }
    const user = await prisma.user.findUnique({
      where: { email }
    });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Kredensial tidak valid.' });
    }
    const { password: _, ...userData } = user;
    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Users Routes
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    const sanitizedUsers = users.map(({ password, ...u }) => u);
    res.json(sanitizedUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users', async (req, res) => {
  try {
    const { id, name, phone, streetAddress, rtRw, province, city, district, village, postalCode, role } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'User ID wajib disertakan.' });
    }
    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (streetAddress !== undefined) dataToUpdate.streetAddress = streetAddress;
    if (rtRw !== undefined) dataToUpdate.rtRw = rtRw;
    if (province !== undefined) dataToUpdate.province = province;
    if (city !== undefined) dataToUpdate.city = city;
    if (district !== undefined) dataToUpdate.district = district;
    if (village !== undefined) dataToUpdate.village = village;
    if (postalCode !== undefined) dataToUpdate.postalCode = postalCode;
    if (role !== undefined) dataToUpdate.role = role;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate
    });
    const { password: _, ...userData } = updatedUser;
    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users', async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: 'User ID wajib disertakan.' });
    }
    await prisma.user.delete({
      where: { id }
    });
    res.json({ message: 'User berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Products Routes
app.get('/api/products', async (req, res) => {
  try {
    const category = req.query.category;
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' }
    });
    let filtered = products;
    if (category && category !== 'Semua') {
      filtered = products.filter(p => p.form.toLowerCase() === category.toLowerCase());
    }
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, price, category, gender, form, coloration, description, image, isPremium, statsForm, statsColor, statsSpirit } = req.body;
    if (!name || price === undefined || !category || !gender || !form || !coloration || !description || !image) {
      return res.status(400).json({ error: 'Data produk tidak lengkap.' });
    }
    const newProduct = await prisma.product.create({
      data: {
        name,
        price: parseFloat(price),
        category,
        gender,
        form,
        coloration,
        description,
        image,
        isPremium: Boolean(isPremium),
        statsForm: statsForm || '9.0/10',
        statsColor: statsColor || '9.0/10',
        statsSpirit: statsSpirit || 'Aktif',
        isSold: false
      }
    });
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id }
    });
    if (!product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan.' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, category, gender, form, coloration, description, image, isPremium, statsForm, statsColor, statsSpirit, isSold } = req.body;
    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (price !== undefined) dataToUpdate.price = parseFloat(price);
    if (category !== undefined) dataToUpdate.category = category;
    if (gender !== undefined) dataToUpdate.gender = gender;
    if (form !== undefined) dataToUpdate.form = form;
    if (coloration !== undefined) dataToUpdate.coloration = coloration;
    if (description !== undefined) dataToUpdate.description = description;
    if (image !== undefined) dataToUpdate.image = image;
    if (isPremium !== undefined) dataToUpdate.isPremium = Boolean(isPremium);
    if (statsForm !== undefined) dataToUpdate.statsForm = statsForm;
    if (statsColor !== undefined) dataToUpdate.statsColor = statsColor;
    if (statsSpirit !== undefined) dataToUpdate.statsSpirit = statsSpirit;
    if (isSold !== undefined) dataToUpdate.isSold = Boolean(isSold);

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: dataToUpdate
    });
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Delete order items that reference this product first to avoid FK constraints
    await prisma.orderItem.deleteMany({
      where: { productId: id }
    });
    await prisma.product.delete({
      where: { id }
    });
    res.json({ message: 'Produk berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Orders Routes
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: true
          }
        },
        user: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { userId, total, status, name, email, phone, streetAddress, rtRw, province, city, district, village, postalCode, items } = req.body;
    if (!name || !email || !phone || !streetAddress || !rtRw || !province || !city || !district || !village || !postalCode || !items || items.length === 0) {
      return res.status(400).json({ error: 'Detail pesanan tidak lengkap.' });
    }
    const order = await prisma.$transaction(async (tx) => {
      // 1. Create order
      const newOrder = await tx.order.create({
        data: {
          userId: userId || null,
          total: parseFloat(total),
          status: status || 'PENDING',
          name,
          email,
          phone,
          streetAddress,
          rtRw,
          province,
          city,
          district,
          village,
          postalCode
        }
      });

      // 2. Create order items and update product sold state
      for (const item of items) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId || item.id,
            quantity: parseInt(item.quantity) || 1,
            price: parseFloat(item.price)
          }
        });

        // Update product as sold
        await tx.product.update({
          where: { id: item.productId || item.id },
          data: { isSold: true }
        });
      }
      return newOrder;
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status
app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid.' });
    }
    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: { include: { product: true } } }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Address Routes
app.get('/api/addresses', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId wajib diisi.' });
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/addresses', async (req, res) => {
  try {
    const { userId, label, recipientName, phone, streetAddress, rtRw, province, city, district, village, postalCode, isDefault } = req.body;
    if (!userId || !recipientName || !phone || !streetAddress || !rtRw || !province || !city || !district || !village || !postalCode) {
      return res.status(400).json({ error: 'Data alamat tidak lengkap.' });
    }
    // If setting as default, unset other defaults first
    if (isDefault) {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    // If this is the first address, auto-set as default
    const count = await prisma.address.count({ where: { userId } });
    const address = await prisma.address.create({
      data: { userId, label: label || 'Rumah', recipientName, phone, streetAddress, rtRw, province, city, district, village, postalCode, isDefault: isDefault || count === 0 }
    });
    res.status(201).json(address);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/addresses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { label, recipientName, phone, streetAddress, rtRw, province, city, district, village, postalCode, isDefault, userId } = req.body;
    if (isDefault && userId) {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const fields = {};
    if (label !== undefined) fields.label = label;
    if (recipientName !== undefined) fields.recipientName = recipientName;
    if (phone !== undefined) fields.phone = phone;
    if (streetAddress !== undefined) fields.streetAddress = streetAddress;
    if (rtRw !== undefined) fields.rtRw = rtRw;
    if (province !== undefined) fields.province = province;
    if (city !== undefined) fields.city = city;
    if (district !== undefined) fields.district = district;
    if (village !== undefined) fields.village = village;
    if (postalCode !== undefined) fields.postalCode = postalCode;
    if (isDefault !== undefined) fields.isDefault = isDefault;
    const updated = await prisma.address.update({ where: { id }, data: fields });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/addresses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const addr = await prisma.address.findUnique({ where: { id } });
    await prisma.address.delete({ where: { id } });
    // If deleted address was default, set the next one as default
    if (addr?.isDefault) {
      const next = await prisma.address.findFirst({ where: { userId: addr.userId }, orderBy: { createdAt: 'asc' } });
      if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    res.json({ message: 'Alamat berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Root Route check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'SUMDE-BETTA API Server is healthy' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
