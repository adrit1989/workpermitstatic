const { getConnection, sql } = require('../db');

module.exports = async function (context, req) {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT Name, Email, Role FROM Users");

        const data = { Requesters: [], Reviewers: [], Approvers: [] };

        result.recordset.forEach(u => {
            const key = u.Role + 's'; 
            if (data[key]) {
                data[key].push({ name: u.Name, email: u.Email });
            }
        });

        context.res = { body: data };
    } catch (e) {
        context.log.error(e);
        context.res = { status: 500, body: { error: e.message } };
    }
};
