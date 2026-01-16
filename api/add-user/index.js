const { getConnection, sql } = require('../db');

module.exports = async function (context, req) {
    try {
        const { name, email, role, password } = req.body;

        if (!name || !email || !role || !password) {
            context.res = { status: 400, body: { error: "Missing fields" } };
            return;
        }

        const pool = await getConnection();

        const check = await pool.request().input('e', email).query("SELECT Email FROM Users WHERE Email=@e");
        if(check.recordset.length > 0) {
            context.res = { status: 400, body: { error: "User already exists" } };
            return;
        }

        await pool.request()
            .input('n', name).input('e', email).input('r', role).input('p', password)
            .query("INSERT INTO Users (Name, Email, Role, Password) VALUES (@n, @e, @r, @p)");

        context.res = { body: { success: true } };

    } catch (e) {
        context.log.error(e);
        context.res = { status: 500, body: { error: e.message } };
    }
};
