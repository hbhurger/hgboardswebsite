require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 1. Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected securely to MongoDB Atlas.'))
    .catch(err => console.error('Database connection error:', err));

// Updated Schema for HG BOARDS Questions
const ResponseSchema = new mongoose.Schema({
    discordId: String,
    discordUsername: String,
    robloxUsername: String,
    company: String,
    campaignDuration: String,
    submittedAt: { type: Date, default: Date.now }
});
const Response = mongoose.model('Response', ResponseSchema);

// 2. Session Management
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: true, // Required for HTTPS on Render
        sameSite: 'none' // Required for embedding in iframes (Google Sites)
    }
}));

app.set('trust proxy', 1);

const ADMIN_DISCORD_IDS = process.env.ADMIN_DISCORD_IDS ? process.env.ADMIN_DISCORD_IDS.split(',') : [];

// Modern Montserrat UI Shell layout
const layout = (title, body) => `
<!DOCTYPE html>
<html>
<head>
    <title>${title} | HG BOARDS</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <!-- Google Fonts: Montserrat -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { 
            font-family: 'Montserrat', sans-serif; 
            background-color: #0d0e12; 
            color: #f3f4f6; 
            padding: 20px; 
            display: flex; 
            justify-content: center; 
            align-items: center;
            min-height: 90vh;
            margin: 0;
        }
        .card { 
            background: #16181f; 
            padding: 40px; 
            border-radius: 16px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
            width: 100%; 
            max-width: 550px; 
            box-sizing: border-box; 
            border: 1px solid #232631;
        }
        .logo-header {
            text-align: center;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 2px;
            color: #5865F2;
            margin-bottom: 30px;
            text-transform: uppercase;
        }
        p { color: #9ca3af; font-size: 14px; line-height: 1.6; }
        .form-group {
            margin-bottom: 20px;
        }
        label { 
            font-weight: 600; 
            display: block; 
            margin-bottom: 8px; 
            font-size: 13px; 
            text-transform: uppercase; 
            letter-spacing: 0.5px;
            color: #9ca3af;
        }
        .required::after {
            content: " *";
            color: #ef4444;
        }
        input[type="text"], select { 
            width: 100%; 
            padding: 12px 16px; 
            background: #1f222e;
            border: 1px solid #2e3346; 
            border-radius: 8px; 
            box-sizing: border-box; 
            font-family: 'Montserrat', sans-serif;
            font-size: 14px; 
            color: #ffffff;
            transition: border-color 0.3s ease;
        }
        input[type="text"]:focus, select:focus {
            outline: none;
            border-color: #5865F2;
        }
        input[readonly] {
            background: #13151c;
            color: #6b7280;
            border-color: #1f222e;
            cursor: not-allowed;
        }
        .notice-box {
            background-color: rgba(88, 101, 242, 0.1);
            border-left: 4px solid #5865F2;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 25px;
            font-size: 12px;
            color: #d1d5db;
        }
        .btn { 
            display: inline-block; 
            background-color: #5865F2; 
            color: white; 
            padding: 14px 20px; 
            border: none; 
            border-radius: 8px; 
            text-decoration: none; 
            font-size: 14px; 
            font-weight: 700; 
            cursor: pointer; 
            width: 100%; 
            text-align: center; 
            box-sizing: border-box; 
            font-family: 'Montserrat', sans-serif;
            transition: background 0.2s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .btn:hover { background-color: #4752C4; }
        .btn-secondary {
            background-color: #2e3346;
            margin-top: 10px;
        }
        .btn-secondary:hover {
            background-color: #1f222e;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo-header">HG BOARDS</div>
        ${body}
    </div>
</body>
</html>
`;

// 3. Routes
app.get('/', (req, res) => {
    if (!req.session.user) {
        return res.send(layout('Sign In Required', `
            <p style="text-align: center; margin-bottom: 25px;">To secure campaign bookings and prevent spam, we require you to authenticate with Discord first.</p>
            <a href="/auth/discord" class="btn">Connect Discord</a>
        `));
    }

    res.send(layout('Campaign Application', `
        <form action="/submit" method="POST">
            
            <div class="form-group">
                <label class="required">Discord Username</label>
                <input type="text" name="discordUsername" value="${req.session.user.username}" readonly required>
            </div>

            <div class="form-group">
                <label class="required">Roblox Username</label>
                <input type="text" name="robloxUsername" placeholder="e.g. Builderman" required>
            </div>

            <div class="form-group">
                <label class="required">Company Name</label>
                <input type="text" name="company" placeholder="e.g. Blox Apparel Corp" required>
            </div>

            <div class="form-group">
                <label class="required">Campaign Duration</label>
                <select name="campaignDuration" required>
                    <option value="" disabled selected>Select an option...</option>
                    <option value="24 Hours ($2AUD)">24 Hours ($2AUD)</option>
                    <option value="48 Hours ($4AUD)">48 Hours ($4AUD)</option>
                    <option value="Week ($14AUD)">Week ($14AUD)</option>
                    <option value="Ongoing (Custom Rates)">Ongoing (Custom Rates)</option>
                </select>
            </div>

            <div class="notice-box">
                <strong>Notice:</strong> You are required to provide your own creative works; exact template size configurations will be provided directly to you after successful payment.
            </div>

            <button type="submit" class="btn">Submit Campaign</button>
        </form>
    `));
});

// Redirect to Discord OAuth
app.get('/auth/discord', (req, res) => {
    const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
    res.redirect(discordAuthUrl);
});

// OAuth Callback Handler
app.get('/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('No authorization code provided.');

    try {
        const tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token', 
            new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.REDIRECT_URI,
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });

        req.session.user = {
            id: userResponse.data.id,
            username: userResponse.data.username,
        };

        res.redirect('/');
    } catch (error) {
        console.error('OAuth Error:', error.response?.data || error.message);
        res.status(500).send('Authentication failed.');
    }
});

// Handle Form Submission
app.post('/submit', async (req, res) => {
    if (!req.session.user) return res.status(401).send('Unauthorized');

    try {
        const newResponse = new Response({
            discordId: req.session.user.id,
            discordUsername: req.session.user.username,
            robloxUsername: req.body.robloxUsername,
            company: req.body.company,
            campaignDuration: req.body.campaignDuration
        });
        await newResponse.save();
        
        res.send(layout('Submission Success', `
            <div style="text-align: center;">
                <h3 style="color: #2da44e; margin-top:0;">Application Received</h3>
                <p>Thanks, your campaign inquiry has been registered. Our admin team will contact you on Discord shortly.</p>
                <a href="/" class="btn btn-secondary">Submit another</a>
            </div>
        `));
    } catch (err) {
        res.status(500).send('Error saving submission.');
    }
});

// Secure Admin Dashboard
app.get('/admin', async (req, res) => {
    if (!req.session.user) {
        return res.send(layout('Admin Login', `
            <p style="text-align: center; margin-bottom: 25px;">Please authenticate with your Admin Discord account to view form data.</p>
            <a href="/auth/discord" class="btn">Login to Portal</a>
        `));
    }

    if (!ADMIN_DISCORD_IDS.includes(req.session.user.id)) {
        return res.status(403).send(layout('Access Denied', `
            <h2 style="color: #ef4444; margin-top:0;">Access Denied</h2>
            <p>Your ID (${req.session.user.id}) does not match an authorized administrator profile.</p>
            <a href="/" class="btn btn-secondary">Back to Form</a>
        `));
    }

    try {
        const submissions = await Response.find().sort({ submittedAt: -1 });
        let rows = submissions.map(s => `
            <tr>
                <td><strong>${s.discordUsername}</strong><br><span style="font-size:10px; color:#6b7280;">ID: ${s.discordId}</span></td>
                <td>${s.robloxUsername}</td>
                <td>${s.company}</td>
                <td><span style="background:#5865F2; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600;">${s.campaignDuration}</span></td>
                <td>${new Date(s.submittedAt).toLocaleDateString()}</td>
            </tr>
        `).join('');

        res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Dashboard | HG BOARDS</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Montserrat', sans-serif; background-color: #0d0e12; color: #f3f4f6; padding: 40px; margin: 0; }
                .container { background: #16181f; padding: 30px; border-radius: 12px; border: 1px solid #232631; max-width: 1000px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                h2 { font-weight: 700; color: #ffffff; letter-spacing: 1px; margin-top:0; }
                table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                th, td { padding: 16px; border-bottom: 1px solid #232631; text-align: left; font-size: 14px; }
                th { background-color: #1f222e; color: #9ca3af; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
                tr:hover { background-color: #1a1d27; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>HG BOARDS - Admin Panel</h2>
                <p>Viewing submissions as: <strong>${req.session.user.username}</strong></p>
                <div style="overflow-x:auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Discord User</th>
                                <th>Roblox User</th>
                                <th>Company</th>
                                <th>Duration Selected</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || '<tr><td colspan="5" style="text-align:center; color:#6b7280;">No responses submitted yet.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </body>
        </html>
        `);
    } catch (err) {
        res.status(500).send('Error retrieving data.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Active on port ${PORT}`));
