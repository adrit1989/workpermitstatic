const { getConnection, sql } = require('../db');
module.exports = async function (context, req) {
    try {
        const { PermitID, userRole, userName, action, 
                RenewalValidFrom, RenewalValidTo, hc, toxic, oxygen, precautions, 
                rejectionReason, renewalWorkers } = req.body;

        const pool = await getConnection();

        // 1. Get existing JSON
        const getRes = await pool.request().input('pid', PermitID).query("SELECT RenewalsJSON, Status FROM Permits WHERE PermitID = @pid");
        let renewals = [];
        try { renewals = JSON.parse(getRes.recordset[0].RenewalsJSON); } catch(e){}
        if(!Array.isArray(renewals)) renewals = [];

        const now = new Date().toISOString();

        if (userRole === 'Requester') {
            // Add new pending request
            renewals.push({
                status: 'pending_review',
                req_name: userName,
                req_at: now,
                valid_from: RenewalValidFrom,
                valid_till: RenewalValidTo,
                hc, toxic, oxygen, precautions,
                worker_list: renewalWorkers
            });
            await pool.request().input('pid', PermitID).query("UPDATE Permits SET Status='Renewal Pending Review' WHERE PermitID=@pid");
        } 
        else if (userRole === 'Reviewer') {
            // Update last entry
            const last = renewals[renewals.length - 1];
            if (action === 'approve') {
                last.status = 'pending_approval';
                last.rev_name = userName;
                last.rev_at = now;
                await pool.request().input('pid', PermitID).query("UPDATE Permits SET Status='Renewal Pending Approval' WHERE PermitID=@pid");
            } else {
                last.status = 'rejected';
                last.rev_name = userName;
                last.rev_at = now;
                last.rejection_reason = rejectionReason;
                await pool.request().input('pid', PermitID).query("UPDATE Permits SET Status='Active' WHERE PermitID=@pid"); // Back to active (renewal failed)
            }
        }
        else if (userRole === 'Approver') {
            const last = renewals[renewals.length - 1];
            if (action === 'approve') {
                last.status = 'approved';
                last.app_name = userName;
                last.app_at = now;
                await pool.request().input('pid', PermitID).query("UPDATE Permits SET Status='Active' WHERE PermitID=@pid"); // Active (Renewal success)
            } else {
                last.status = 'rejected';
                last.app_name = userName;
                last.app_at = now;
                last.rejection_reason = rejectionReason;
                await pool.request().input('pid', PermitID).query("UPDATE Permits SET Status='Active' WHERE PermitID=@pid");
            }
        }

        // Save JSON back
        const jsonStr = JSON.stringify(renewals);
        await pool.request()
            .input('pid', PermitID)
            .input('json', jsonStr)
            .query("UPDATE Permits SET RenewalsJSON = @json WHERE PermitID = @pid");

        context.res = { body: { success: true } };

    } catch (e) {
        context.res = { status: 500, body: { error: e.message } };
    }
};
