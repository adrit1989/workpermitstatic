const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        enableArithAbort: true
    }
};

async function getConnection() {
    try {
        return await sql.connect(config);
    } catch (err) {
        console.error("SQL Connection Error: ", err);
        throw err;
    }
}

module.exports = { getConnection, sql };
