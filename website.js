const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3074;

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🌐 Website running on: http://localhost:${PORT}`);
});

module.exports = app;