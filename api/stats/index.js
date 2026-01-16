const { getConnection, sql } = require('../db');
module.exports = async function (context, req) {
    try {
        const pool = await getConnection();

        // Count Status
        const q1 = await pool.request().query("SELECT Status, COUNT(*) as Cnt FROM Permits GROUP BY Status");
        const statusCounts = {};
        q1.recordset.forEach(r => statusCounts[r.Status] = r.Cnt);

        // Count Types
        const q2 = await pool.request().query("SELECT WorkType, COUNT(*) as Cnt FROM Permits GROUP BY WorkType");
        const typeCounts = {};
        q2.recordset.forEach(r => typeCounts[r.WorkType] = r.Cnt);

        context.res = { body: { statusCounts, typeCounts } };
    } catch (e) {
        context.res = { status: 500, body: { error: e.message } };
    }
};
