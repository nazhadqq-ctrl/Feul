const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Microsoft SQL Server Configuration
const dbConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Nazhad@5759',
    server: process.env.DB_SERVER || '62.201.232.190',
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    database: process.env.DB_NAME || 'Feul',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 15000,
        requestTimeout: 20000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool = null;

async function getPool() {
    if (!pool) {
        try {
            pool = await sql.connect(dbConfig);
            console.log('Connected to MSSQL Database [Feul] successfully.');
        } catch (err) {
            console.error('Database connection failed:', err.message);
            pool = null;
            throw err;
        }
    }
    return pool;
}

// Ensure FuelRecords table exists on startup
// Helper to convert Kurdish/Arabic numbers (٠-٩ and ۰-۹) to standard digits (0-9)
function normalizeKurdishDigits(val) {
    if (!val) return '';
    const map = {
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
        '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    };
    return String(val).replace(/[٠-٩۰-۹]/g, d => map[d] || d);
}

async function initDb() {
    try {
        const p = await getPool();
        await p.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FuelRecords')
            BEGIN
                CREATE TABLE FuelRecords (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    car_no NVARCHAR(50) NOT NULL,
                    parizga NVARCHAR(100) NOT NULL,
                    bash NVARCHAR(100) NOT NULL,
                    reg_date DATE NOT NULL,
                    reg_time VARCHAR(20) NOT NULL,
                    station_name NVARCHAR(150) NOT NULL,
                    created_at DATETIME DEFAULT GETDATE(),
                    created_by NVARCHAR(100) NULL
                );

                CREATE INDEX IX_FuelRecords_Car_Check 
                ON FuelRecords (car_no, parizga, bash, reg_date);
            END
        `);
        console.log('FuelRecords table verified/ready.');
    } catch (err) {
        console.error('Error initializing database table:', err.message);
    }
}

// ---------------- API ROUTES ---------------- //

// Health / Connection status check
app.get('/api/health', async (req, res) => {
    try {
        const p = await getPool();
        const test = await p.request().query('SELECT 1 as isAlive');
        res.json({ status: 'ok', server: dbConfig.server, database: dbConfig.database });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Login Route (validates against USERS table)
app.post('/api/login', async (req, res) => {
    const { username, password, station } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'تکایە ناوی بەکارهێنەر و وشەی نهێنی بنووسە.' });
    }

    try {
        const p = await getPool();
        const request = p.request();
        request.input('user', sql.NVarChar, username.trim());
        request.input('pass', sql.NVarChar, password.trim());

        const query = `
            SELECT id, User_, permetion, on_off, place 
            FROM [USERS] 
            WHERE User_ = @user AND password = @pass
        `;
        const result = await request.query(query);

        if (result.recordset.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە!' 
            });
        }

        const user = result.recordset[0];

        // Check if account is active (on_off)
        if (user.on_off && user.on_off.toLowerCase() !== 'yes' && user.on_off !== '1' && user.on_off.toLowerCase() !== 'on') {
            return res.status(403).json({ 
                success: false, 
                message: 'ئەم هەژمارە ناچالاک کراوە! تکایە پەیوەندی بە سەرپەرشتیارەوە بکە.' 
            });
        }

        const selectedStation = station && station.trim() ? station.trim() : (user.place || 'بەنزینخانەی سەرەکی');

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.User_,
                permission: user.permetion,
                place: user.place,
                station: selectedStation
            },
            message: 'چوونەژوورەوە سەرکەوتوو بوو'
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'هەڵە لە بەستنەوە بە سێرڤەر: ' + err.message });
    }
});

// 7-day rule check function
async function checkCarFuelEligibility(car_no, parizga, bash, check_date) {
    const p = await getPool();
    const req = p.request();

    // Standardize input
    const cleanCarNo = car_no.trim().toUpperCase();
    const cleanParizga = parizga.trim();
    const cleanBash = bash.trim();

    req.input('car_no', sql.NVarChar, cleanCarNo);
    req.input('parizga', sql.NVarChar, cleanParizga);
    req.input('bash', sql.NVarChar, cleanBash);
    req.input('check_date', sql.Date, check_date || new Date());

    // Query for records within the last 7 calendar days
    // DATEDIFF(day, reg_date, @check_date) < 7
    const query = `
        SELECT TOP 1 id, car_no, parizga, bash, reg_date, reg_time, station_name, created_at,
               DATEDIFF(day, reg_date, @check_date) AS days_passed
        FROM FuelRecords
        WHERE car_no = @car_no 
          AND parizga = @parizga 
          AND bash = @bash
          AND reg_date >= DATEADD(day, -7, @check_date)
          AND reg_date <= @check_date
        ORDER BY reg_date DESC, created_at DESC
    `;

    const result = await req.query(query);

    if (result.recordset.length > 0) {
        const lastRecord = result.recordset[0];
        const daysPassed = lastRecord.days_passed;
        const daysRemaining = 7 - daysPassed;

        // Calculate next allowed date (reg_date + 8 days)
        const lastDate = new Date(lastRecord.reg_date);
        const nextAllowed = new Date(lastDate);
        nextAllowed.setDate(nextAllowed.getDate() + 8);
        const nextAllowedFormatted = nextAllowed.toISOString().split('T')[0];

        // Format Kurdish date
        const regDateFormatted = new Date(lastRecord.reg_date).toISOString().split('T')[0];

        return {
            allowed: false,
            status: 'BLOCKED',
            daysPassed,
            daysRemaining: Math.max(1, daysRemaining),
            nextAllowedDate: nextAllowedFormatted,
            record: {
                ...lastRecord,
                reg_date_str: regDateFormatted
            },
            message: `ئەم ئۆتۆمبێلە (${cleanCarNo} - ${cleanParizga} - بەشی ${cleanBash}) لە بەرواری (${regDateFormatted}) کاتژمێر (${lastRecord.reg_time}) لە وێستگەی (${lastRecord.station_name}) بەنزینی وەرگرتووە! ماوەی (${Math.max(1, daysRemaining)}) ڕۆژی ماوە (لە بەرواری ${nextAllowedFormatted} بۆی هەیە وەربگرێتەوە).`
        };
    }

    return {
        allowed: true,
        status: 'ALLOWED',
        message: 'ئەم ئۆتۆمبێلە مافی وەرگرتنی بەنزینی هەیە.'
    };
}

// Check car eligibility API (Realtime check without saving)
app.post('/api/check-car', async (req, res) => {
    const { car_no, parizga, bash, reg_date } = req.body;

    if (!car_no || !parizga || !bash) {
        return res.status(400).json({ 
            success: false, 
            message: 'تکایە ژمارەی ئۆتۆمبێل و پارێزگا و بەش پڕبکەرەوە.' 
        });
    }

    try {
        const cleanCarNo = normalizeKurdishDigits(car_no).trim().toUpperCase();
        const eligibility = await checkCarFuelEligibility(cleanCarNo, parizga, bash, reg_date);
        res.json({ success: true, ...eligibility });
    } catch (err) {
        console.error('Check car error:', err);
        res.status(500).json({ success: false, message: 'هەڵە لە پشکنینی ئۆتۆمبێل: ' + err.message });
    }
});

// Register car fuel transaction API
app.post('/api/register-car', async (req, res) => {
    const { car_no, parizga, bash, reg_date, reg_time, station_name, created_by } = req.body;

    if (!car_no || !parizga || !bash) {
        return res.status(400).json({ 
            success: false, 
            message: 'تکایە هەموو خانە سەرەکییەکان بە دروستی پڕبکەرەوە.' 
        });
    }

    // Normalize Kurdish/Arabic digits to standard digits
    const cleanCarNo = normalizeKurdishDigits(car_no).trim().toUpperCase();
    if (!cleanCarNo) {
        return res.status(400).json({
            success: false,
            message: 'تکایە ژمارەی ئۆتۆمبێل بنووسە.'
        });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toTimeString().split(' ')[0];

    const finalDate = reg_date || todayStr;
    const finalTime = reg_time || nowTimeStr;
    const finalStation = (station_name && station_name.trim()) ? station_name.trim() : 'بەنزینخانە';
    const finalParizga = parizga.trim();
    const finalBash = bash.trim();

    try {
        // Step 1: Check 7-day rule
        const eligibility = await checkCarFuelEligibility(cleanCarNo, finalParizga, finalBash, finalDate);

        if (!eligibility.allowed) {
            // Block registration and return details
            return res.status(400).json({
                success: false,
                ...eligibility
            });
        }

        // Step 2: Insert into FuelRecords
        const p = await getPool();
        const insertReq = p.request();
        insertReq.input('car_no', sql.NVarChar, cleanCarNo);
        insertReq.input('parizga', sql.NVarChar, finalParizga);
        insertReq.input('bash', sql.NVarChar, finalBash);
        insertReq.input('reg_date', sql.Date, finalDate);
        insertReq.input('reg_time', sql.VarChar, finalTime);
        insertReq.input('station_name', sql.NVarChar, finalStation);
        insertReq.input('created_by', sql.NVarChar, (created_by || 'سەرپەرشتیار').trim());

        const insertQuery = `
            INSERT INTO FuelRecords (car_no, parizga, bash, reg_date, reg_time, station_name, created_by)
            OUTPUT INSERTED.*
            VALUES (@car_no, @parizga, @bash, @reg_date, @reg_time, @station_name, @created_by)
        `;

        const insertResult = await insertReq.query(insertQuery);
        const savedRecord = insertResult.recordset[0];

        res.json({
            success: true,
            status: 'REGISTERED',
            message: `ئۆتۆمبێلی ژمارە (${cleanCarNo} - ${finalParizga} - ${finalBash}) بە سەرکەوتوویی تۆمار کرا!`,
            record: {
                ...savedRecord,
                reg_date_str: new Date(savedRecord.reg_date).toISOString().split('T')[0]
            }
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ success: false, message: 'هەڵە لە تۆمارکردندا: ' + err.message });
    }
});

// Get today's registered cars list
app.get('/api/today-records', async (req, res) => {
    const station = req.query.station;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    try {
        const p = await getPool();
        const request = p.request();
        request.input('target_date', sql.Date, date);

        let query = `
            SELECT TOP 100 id, car_no, parizga, bash, reg_date, reg_time, station_name, created_by, created_at
            FROM FuelRecords
            WHERE reg_date = @target_date
        `;

        if (station && station !== 'all' && station.trim() !== '') {
            request.input('station', sql.NVarChar, station.trim());
            query += ' AND station_name = @station';
        }

        query += ' ORDER BY id DESC';

        const result = await request.query(query);

        // Stats
        const statsReq = p.request();
        statsReq.input('target_date', sql.Date, date);
        const statsQuery = `
            SELECT 
                COUNT(*) AS total_today,
                COUNT(DISTINCT car_no) AS unique_cars_today
            FROM FuelRecords
            WHERE reg_date = @target_date
        `;
        const statsRes = await statsReq.query(statsQuery);

        res.json({
            success: true,
            records: result.recordset.map(r => ({
                ...r,
                reg_date_str: new Date(r.reg_date).toISOString().split('T')[0]
            })),
            stats: statsRes.recordset[0] || { total_today: 0, unique_cars_today: 0 }
        });
    } catch (err) {
        console.error('Error fetching today records:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, async () => {
    console.log(`=========================================`);
    console.log(` Feul Station Web App is running!`);
    console.log(` Local URL: http://localhost:${PORT}`);
    console.log(` Database:  ${dbConfig.database} on ${dbConfig.server}`);
    console.log(`=========================================`);
    await initDb();
});
