// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// User Model
const UserSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, unique: true },
  password: String,
  points: { type: Number, default: 0 },
  walletBalance: { type: Number, default: 0 },
  transactions: [{
    type: { type: String, enum: ['airtime', 'data', 'points', 'redemption'] },
    amount: Number,
    date: { type: Date, default: Date.now },
    details: String
  }]
});

const User = mongoose.model('User', UserSchema);

// Safaricom Daraja API Integration
const safaricomAuth = async () => {
  const auth = Buffer.from(`${process.env.SAFARICOM_CONSUMER_KEY}:${process.env.SAFARICOM_CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: {
      Authorization: `Basic ${auth}`
    }
  });
  return response.data.access_token;
};

// User Registration
app.post('/api/register', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, phone, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if (!user) throw new Error('User not found');
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Invalid credentials');
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { name: user.name, phone: user.phone, points: user.points, walletBalance: user.walletBalance } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Purchase Airtime
app.post('/api/purchase/airtime', async (req, res) => {
  try {
    const { phone, amount, userId } = req.body;
    const token = await safaricomAuth();
    
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14);
    const password = Buffer.from(`${process.env.SAFARICOM_BUSINESS_SHORT_CODE}${process.env.SAFARICOM_PASSKEY}${timestamp}`).toString('base64');
    
    const response = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      BusinessShortCode: process.env.SAFARICOM_BUSINESS_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: process.env.SAFARICOM_BUSINESS_SHORT_CODE,
      PhoneNumber: phone,
      CallBackURL: `${process.env.BASE_URL}/api/callback`,
      AccountReference: 'BingwaAirtime',
      TransactionDesc: 'Purchase of airtime'
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    // Update user points (5 points per purchase)
    const user = await User.findById(userId);
    const pointsEarned = 5;
    user.points += pointsEarned;
    user.transactions.push({
      type: 'airtime',
      amount: amount,
      details: `Airtime purchase of KSH ${amount}`
    });
    user.transactions.push({
      type: 'points',
      amount: pointsEarned,
      details: `Earned ${pointsEarned} points for airtime purchase`
    });
    await user.save();
    
    // Check if points reached redemption threshold
    if (user.points >= 200) {
      return res.json({ 
        success: true, 
        message: 'Airtime purchase initiated', 
        points: user.points,
        canRedeem: true
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Airtime purchase initiated', 
      points: user.points,
      canRedeem: false
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Purchase Data Bundle
app.post('/api/purchase/data', async (req, res) => {
  try {
    const { phone, bundle, amount, userId } = req.body;
    // Similar to airtime purchase but for data bundles
    // Implementation would depend on Safaricom API for data bundles
    
    // Update user points (5 points per purchase)
    const user = await User.findById(userId);
    const pointsEarned = 5;
    user.points += pointsEarned;
    user.transactions.push({
      type: 'data',
      amount: amount,
      details: `Data bundle purchase: ${bundle} for KSH ${amount}`
    });
    user.transactions.push({
      type: 'points',
      amount: pointsEarned,
      details: `Earned ${pointsEarned} points for data purchase`
    });
    await user.save();
    
    // Check if points reached redemption threshold
    if (user.points >= 200) {
      return res.json({ 
        success: true, 
        message: 'Data bundle purchase initiated', 
        points: user.points,
        canRedeem: true
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Data bundle purchase initiated', 
      points: user.points,
      canRedeem: false
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Redeem Points
app.post('/api/redeem', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    
    if (user.points < 200) {
      throw new Error('You need at least 200 points to redeem');
    }
    
    const redemptionAmount = 40; // 200 points = 40 KSH
    user.points -= 200;
    user.walletBalance += redemptionAmount;
    user.transactions.push({
      type: 'redemption',
      amount: redemptionAmount,
      details: 'Redeemed 200 points for KSH 40'
    });
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Points redeemed successfully', 
      walletBalance: user.walletBalance,
      points: user.points
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get User Transactions
app.get('/api/transactions/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    res.json(user.transactions);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// WhatsApp Help
app.post('/api/whatsapp-help', async (req, res) => {
  try {
    const { phone, message } = req.body;
    // Integration with WhatsApp Business API would go here
    // This is a placeholder for the actual implementation
    
    res.json({ success: true, message: 'Your help request has been sent to our WhatsApp support' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// User Model
const UserSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, unique: true },
  password: String,
  points: { type: Number, default: 0 },
  walletBalance: { type: Number, default: 0 },
  transactions: [{
    type: { type: String, enum: ['airtime', 'data', 'points', 'redemption'] },
    amount: Number,
    date: { type: Date, default: Date.now },
    details: String
  }]
});

const User = mongoose.model('User', UserSchema);

// Safaricom Daraja API Integration
const safaricomAuth = async () => {
  const auth = Buffer.from(`${process.env.SAFARICOM_CONSUMER_KEY}:${process.env.SAFARICOM_CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: {
      Authorization: `Basic ${auth}`
    }
  });
  return response.data.access_token;
};

// User Registration
app.post('/api/register', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, phone, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if (!user) throw new Error('User not found');
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Invalid credentials');
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { name: user.name, phone: user.phone, points: user.points, walletBalance: user.walletBalance } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Purchase Airtime
app.post('/api/purchase/airtime', async (req, res) => {
  try {
    const { phone, amount, userId } = req.body;
    const token = await safaricomAuth();
    
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14);
    const password = Buffer.from(`${process.env.SAFARICOM_BUSINESS_SHORT_CODE}${process.env.SAFARICOM_PASSKEY}${timestamp}`).toString('base64');
    
    const response = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      BusinessShortCode: process.env.SAFARICOM_BUSINESS_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: process.env.SAFARICOM_BUSINESS_SHORT_CODE,
      PhoneNumber: phone,
      CallBackURL: `${process.env.BASE_URL}/api/callback`,
      AccountReference: 'BingwaAirtime',
      TransactionDesc: 'Purchase of airtime'
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    // Update user points (5 points per purchase)
    const user = await User.findById(userId);
    const pointsEarned = 5;
    user.points += pointsEarned;
    user.transactions.push({
      type: 'airtime',
      amount: amount,
      details: `Airtime purchase of KSH ${amount}`
    });
    user.transactions.push({
      type: 'points',
      amount: pointsEarned,
      details: `Earned ${pointsEarned} points for airtime purchase`
    });
    await user.save();
    
    // Check if points reached redemption threshold
    if (user.points >= 200) {
      return res.json({ 
        success: true, 
        message: 'Airtime purchase initiated', 
        points: user.points,
        canRedeem: true
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Airtime purchase initiated', 
      points: user.points,
      canRedeem: false
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Purchase Data Bundle
app.post('/api/purchase/data', async (req, res) => {
  try {
    const { phone, bundle, amount, userId } = req.body;
    // Similar to airtime purchase but for data bundles
    // Implementation would depend on Safaricom API for data bundles
    
    // Update user points (5 points per purchase)
    const user = await User.findById(userId);
    const pointsEarned = 5;
    user.points += pointsEarned;
    user.transactions.push({
      type: 'data',
      amount: amount,
      details: `Data bundle purchase: ${bundle} for KSH ${amount}`
    });
    user.transactions.push({
      type: 'points',
      amount: pointsEarned,
      details: `Earned ${pointsEarned} points for data purchase`
    });
    await user.save();
    
    // Check if points reached redemption threshold
    if (user.points >= 200) {
      return res.json({ 
        success: true, 
        message: 'Data bundle purchase initiated', 
        points: user.points,
        canRedeem: true
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Data bundle purchase initiated', 
      points: user.points,
      canRedeem: false
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Redeem Points
app.post('/api/redeem', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    
    if (user.points < 200) {
      throw new Error('You need at least 200 points to redeem');
    }
    
    const redemptionAmount = 40; // 200 points = 40 KSH
    user.points -= 200;
    user.walletBalance += redemptionAmount;
    user.transactions.push({
      type: 'redemption',
      amount: redemptionAmount,
      details: 'Redeemed 200 points for KSH 40'
    });
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Points redeemed successfully', 
      walletBalance: user.walletBalance,
      points: user.points
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get User Transactions
app.get('/api/transactions/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    res.json(user.transactions);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// WhatsApp Help
app.post('/api/whatsapp-help', async (req, res) => {
  try {
    const { phone, message } = req.body;
    // Integration with WhatsApp Business API would go here
    // This is a placeholder for the actual implementation
    
    res.json({ success: true, message: 'Your help request has been sent to our WhatsApp support' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
