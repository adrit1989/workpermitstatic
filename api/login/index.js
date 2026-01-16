const { getConnection, sql } = require('../db');

module.exports = async function (context, req) {
    try {
        const { role, name, password } = req.body;
        
        // Basic validation
        if (!role || !name || !password) {
            context.res = { status: 400, body: "Missing fields" };
            return;
        }

        const pool = await getConnection();
        const r = await pool.request()
            .input('r', sql.NVarChar, role)
            .input('e', sql.NVarChar, name)
            .input('p', sql.NVarChar, password)
            .query('SELECT * FROM Users WHERE Role=@r AND Email=@e AND Password=@p');

        if (r.recordset.length) {
            context.res = {
                body: { 
                    success: true, 
                    user: { 
                        Name: r.recordset[0].Name, 
                        Email: r.recordset[0].Email, 
                        Role: r.recordset[0].Role 
                    } 
                }
            };
        } else {
            context.res = { body: { success: false } };
        }
    } catch (e) {
        context.log.error(e);
        context.res = { status: 500, body: { error: e.message } };
    }
};