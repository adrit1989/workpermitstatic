const { getConnection, sql } = require('../db');
module.exports = async function (context, req) {
    try {
        const { permitId } = req.body;
        const pool = await getConnection();

        // 1. Get Permit Details
        const result = await pool.request().input('p', permitId).query("SELECT * FROM Permits WHERE PermitID = @p");

        // 2. Get the specific IOCL Supervisors for this permit (if any)
        // Note: We are storing them as JSON in the main table for simplicity, 
        // but if you had a separate table, we would query it here. 
        // For now, we return the permit row directly.

        if (result.recordset.length === 0) {
            context.res = { status: 404, body: { error: "Permit not found" } };
        } else {
            context.res = { body: result.recordset[0] };
        }
    } catch (e) {
        context.res = { status: 500, body: { error: e.message } };
    }
};
