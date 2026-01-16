const { getConnection, sql } = require('../db');

module.exports = async function (context, req) {
    try {
        const { role, email, context: mode } = req.body;
        
        const pool = await getConnection();
        const r = await pool.request().query("SELECT * FROM Workers");
        
        const list = r.recordset.map(w => {
            let d = {};
            try { d = JSON.parse(w.DataJSON); } catch(e) {}
            
            // Merge Pending/Current details
            const details = d.Pending || d.Current || {};
            
            return {
                ...details,
                WorkerID: w.WorkerID,
                Status: w.Status,
                RequestorEmail: w.RequestorEmail,
                ApprovedBy: w.ApprovedBy || details.ApprovedBy,
                ApprovedAt: w.ApprovedOn || details.ApprovedAt,
                IDType: w.IDType || details.IDType,
                IsEdit: w.Status.includes('Edit')
            };
        });

        let finalResult = [];

        if (mode === 'permit_dropdown') {
            // Only show Approved workers for the permit dropdown
            finalResult = list.filter(w => w.Status === 'Approved');
        } else {
            // Dashboard Logic
            if (role === 'Requester') {
                // Requesters see only their own workers OR Approved workers (shared pool)
                finalResult = list.filter(w => w.RequestorEmail === email || w.Status === 'Approved');
            } else {
                // Reviewers/Approvers see everyone
                finalResult = list;
            }
        }

        context.res = { body: finalResult };

    } catch (e) {
        context.log.error(e);
        context.res = { status: 500, body: { error: e.message } };
    }
};