// App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, IconButton, Drawer, List, ListItem, ListItemText, Box, Paper, TextField, Card, CardContent, Avatar, Badge } from '@mui/material';
import { ShoppingCart, AccountCircle, Help, WhatsApp, LocalAtm, Redeem, History } from '@mui/icons-material';
import axios from 'axios';

// Components
const Login = ({ onLogin }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/login', { phone, password });
      onLogin(response.data);
    } catch (error) {
      alert(error.response?.data?.error || 'Login failed');
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>Login to Bingwa Sokoni</Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Phone Number"
            variant="outlined"
            fullWidth
            margin="normal"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            variant="outlined"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>
            Login
          </Button>
        </form>
        <Typography variant="body2" sx={{ mt: 2 }}>
          Don't have an account? <Link to="/register">Register</Link>
        </Typography>
      </Paper>
    </Box>
  );
};

const Register = ({ onRegister }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/register', { name, phone, password });
      alert('Registration successful! Please login.');
      onRegister();
    } catch (error) {
      alert(error.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>Register for Bingwa Sokoni</Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Full Name"
            variant="outlined"
            fullWidth
            margin="normal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextField
            label="Phone Number"
            variant="outlined"
            fullWidth
            margin="normal"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            variant="outlined"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>
            Register
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('buy');
  const [airtimeAmount, setAirtimeAmount] = useState('');
  const [dataBundle, setDataBundle] = useState('');
  const [showRedeem, setShowRedeem] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [helpMessage, setHelpMessage] = useState('');

  useEffect(() => {
    if (user.points >= 200) {
      setShowRedeem(true);
    }
    // Fetch transactions
    axios.get(`/api/transactions/${user.userId}`)
      .then(response => setTransactions(response.data))
      .catch(error => console.error(error));
  }, [user]);

  const handleAirtimePurchase = () => {
    axios.post('/api/purchase/airtime', {
      phone: user.phone,
      amount: airtimeAmount,
      userId: user.userId
    })
    .then(response => {
      alert(response.data.message);
      if (response.data.canRedeem) {
        setShowRedeem(true);
      }
      // Refresh user data
      // In a real app, you would update the user context or fetch updated data
    })
    .catch(error => alert(error.response?.data?.error || 'Purchase failed'));
  };

  const handleDataPurchase = () => {
    axios.post('/api/purchase/data', {
      phone: user.phone,
      bundle: dataBundle,
      amount: getBundlePrice(dataBundle),
      userId: user.userId
    })
    .then(response => {
      alert(response.data.message);
      if (response.data.canRedeem) {
        setShowRedeem(true);
      }
    })
    .catch(error => alert(error.response?.data?.error || 'Purchase failed'));
  };

  const handleRedeem = () => {
    axios.post('/api/redeem', { userId: user.userId })
      .then(response => {
        alert(response.data.message);
        setShowRedeem(false);
        // Refresh user data
      })
      .catch(error => alert(error.response?.data?.error || 'Redemption failed'));
  };

  const handleHelpRequest = () => {
    axios.post('/api/whatsapp-help', {
      phone: user.phone,
      message: helpMessage
    })
    .then(() => {
      alert('Help request sent to WhatsApp support');
      setHelpMessage('');
    })
    .catch(error => alert('Failed to send help request'));
  };

  const getBundlePrice = (bundle) => {
    const bundles = {
      'Daily 50MB': 20,
      'Daily 100MB': 50,
      'Weekly 500MB': 100,
      'Monthly 1GB': 500,
      'Monthly 5GB': 1000
    };
    return bundles[bundle] || 0;
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Bingwa Sokoni
          </Typography>
          <IconButton color="inherit" onClick={() => setActiveTab('help')}>
            <Help />
          </IconButton>
          <IconButton color="inherit" onClick={onLogout}>
            <AccountCircle />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Card sx={{ minWidth: 150 }}>
            <CardContent>
              <Typography color="text.secondary">Points</Typography>
              <Typography variant="h5">{user.points}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 150 }}>
            <CardContent>
              <Typography color="text.secondary">Wallet</Typography>
              <Typography variant="h5">KSH {user.walletBalance}</Typography>
            </CardContent>
          </Card>
        </Box>

        {showRedeem && (
          <Paper elevation={3} sx={{ p: 2, mb: 3, backgroundColor: '#e3f2fd' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography>You have 200+ points! Redeem for KSH 40</Typography>
              <Button variant="contained" color="secondary" onClick={handleRedeem}>
                <Redeem sx={{ mr: 1 }} /> Redeem Now
              </Button>
            </Box>
          </Paper>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Button 
            variant={activeTab === 'buy' ? 'contained' : 'text'} 
            onClick={() => setActiveTab('buy')}
            sx={{ mr: 2 }}
          >
            Buy
          </Button>
          <Button 
            variant={activeTab === 'history' ? 'contained' : 'text'} 
            onClick={() => setActiveTab('history')}
            sx={{ mr: 2 }}
          >
            <History sx={{ mr: 1 }} /> History
          </Button>
          <Button 
            variant={activeTab === 'help' ? 'contained' : 'text'} 
            onClick={() => setActiveTab('help')}
          >
            <WhatsApp sx={{ mr: 1 }} /> Help
          </Button>
        </Box>

        {activeTab === 'buy' && (
          <Box>
            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Buy Airtime</Typography>
              <TextField
                label="Amount (KSH)"
                variant="outlined"
                type="number"
                fullWidth
                margin="normal"
                value={airtimeAmount}
                onChange={(e) => setAirtimeAmount(e.target.value)}
              />
              <Button 
                variant="contained" 
                color="primary" 
                fullWidth 
                onClick={handleAirtimePurchase}
                disabled={!airtimeAmount}
              >
                Buy Airtime (Earn 5 Points)
              </Button>
            </Paper>

            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Buy Data Bundle</Typography>
              <TextField
                select
                label="Select Bundle"
                variant="outlined"
                fullWidth
                margin="normal"
                value={dataBundle}
                onChange={(e) => setDataBundle(e.target.value)}
                SelectProps={{
                  native: true,
                }}
              >
                <option value=""></option>
                <option value="Daily 50MB">Daily 50MB - KSH 20</option>
                <option value="Daily 100MB">Daily 100MB - KSH 50</option>
                <option value="Weekly 500MB">Weekly 500MB - KSH 100</option>
                <option value="Monthly 1GB">Monthly 1GB - KSH 500</option>
                <option value="Monthly 5GB">Monthly 5GB - KSH 1000</option>
              </TextField>
              <Button 
                variant="contained" 
                color="primary" 
                fullWidth 
                onClick={handleDataPurchase}
                disabled={!dataBundle}
              >
                Buy {dataBundle || 'Bundle'} (Earn 5 Points)
              </Button>
            </Paper>
          </Box>
        )}

        {activeTab === 'history' && (
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Transaction History</Typography>
            <List>
              {transactions.length > 0 ? (
                transactions.map((tx, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={tx.details}
                      secondary={new Date(tx.date).toLocaleString()}
                    />
                    <Typography color={tx.type === 'redemption' ? 'success.main' : 'text.primary'}>
                      {tx.amount}
                    </Typography>
                  </ListItem>
                ))
              ) : (
                <Typography>No transactions yet</Typography>
              )}
            </List>
          </Paper>
        )}

        {activeTab === 'help' && (
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Customer Support</Typography>
            <Typography paragraph>
              Need help? Contact us via WhatsApp and our team will assist you.
            </Typography>
            <TextField
              label="Your Message"
              variant="outlined"
              fullWidth
              multiline
              rows={4}
              margin="normal"
              value={helpMessage}
              onChange={(e) => setHelpMessage(e.target.value)}
            />
            <Button 
              variant="contained" 
              color="success" 
              startIcon={<WhatsApp />}
              onClick={handleHelpRequest}
              disabled={!helpMessage}
              sx={{ mt: 2 }}
            >
              Send via WhatsApp
            </Button>
          </Paper>
        )}
      </Box>

      <Box sx={{ position: 'fixed', bottom: 16, right: 16 }}>
        <IconButton 
          color="primary" 
          aria-label="whatsapp help"
          href={`https://wa.me/254YOURWHATSAPPNUMBER?text=Hello%20Bingwa%20Sokoni%20Support`}
          target="_blank"
          sx={{ 
            backgroundColor: '#25D366', 
            color: 'white',
            '&:hover': { backgroundColor: '#128C7E' }
          }}
        >
          <WhatsApp fontSize="large" />
        </IconButton>
      </Box>
    </Box>
  );
};

const App = () => {
  const [user, setUser] = useState(null);

  const handleLogin = (data) => {
    setUser({
      userId: data.user._id,
      name: data.user.name,
      phone: data.user.phone,
      points: data.user.points,
      walletBalance: data.user.walletBalance,
      token: data.token
    });
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register onRegister={() => window.location.href = '/'} />} />
      </Routes>
    </Router>
  );
};

export default App;
