const { getConnection, sql } = require('../db');

module.exports = async function (context, req) {
    try {
        const { role, email } = req.body;
        
        const pool = await getConnection();
        // Get only the necessary columns for the dashboard to make it fast
        const r = await pool.request().query("SELECT PermitID, Status, ValidFrom, ValidTo, RequesterEmail, ReviewerEmail, ApproverEmail, FullDataJSON FROM Permits");
        
        const permits = r.recordset.map(x => {
            let fullData = {};
            try { fullData = JSON.parse(x.FullDataJSON); } catch(e) {}
            
            return {
                ...fullData,
                PermitID: x.PermitID,
                Status: x.Status,
                ValidFrom: x.ValidFrom,
                // These specific fields are needed for filtering
                RequesterEmail: x.RequesterEmail,
                ReviewerEmail: x.ReviewerEmail,
                ApproverEmail: x.ApproverEmail
            };
        });

        // Filter: If user is 'Requester', only show their own permits. Otherwise show all.
        const filtered = permits.filter(x => (role === 'Requester' ? x.RequesterEmail === email : true));

        // Sort: Newest IDs at the top
        filtered.sort((a, b) => b.PermitID.localeCompare(a.PermitID));

        context.res = { body: filtered };

    } catch (e) {
        context.log.error(e);
        context.res = { status: 500, body: { error: e.message } };
    }
};