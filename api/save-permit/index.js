const { getConnection, sql } = require('../db');
const { getNowIST } = require('../utils');

module.exports = async function (context, req) {
    try {
        // Handle both JSON and Form data (if parsed)
        const body = req.body;
        const PermitID = body.PermitID;
        
        console.log("Saving Permit:", PermitID);

        // 1. Date Validation
        let vf, vt;
        try {
            vf = body.ValidFrom ? new Date(body.ValidFrom) : null;
            vt = body.ValidTo ? new Date(body.ValidTo) : null;
        } catch (err) {
            context.res = { status: 400, body: { error: "Invalid Date Format" } };
            return;
        }

        if (!vf || !vt) {
            context.res = { status: 400, body: { error: "Start/End dates required" } };
            return;
        }
        
        const pool = await getConnection();

        // 2. ID Generation Logic
        let pid = PermitID;
        if (!pid || pid === 'undefined' || pid === '') {
            const idRes = await pool.request().query("SELECT TOP 1 PermitID FROM Permits ORDER BY Id DESC");
            const lastId = idRes.recordset.length > 0 ? idRes.recordset[0].PermitID : 'WP-1000';
            const numPart = parseInt(lastId.split('-')[1] || 1000);
            pid = `WP-${numPart + 1}`;
        }

        // 3. Workers & Renewals Parsing
        let workers = body.SelectedWorkers;
        if (typeof workers === 'string') { try { workers = JSON.parse(workers); } catch (e) { workers = []; } }
        
        let renewalsArr = [];
        if(body.InitRen === 'Y') {
            renewalsArr.push({
                status: 'pending_review',
                valid_from: body.InitRenFrom || '',
                valid_till: body.InitRenTo || '',
                hc: body.InitRenHC || '', 
                toxic: body.InitRenTox || '', 
                oxygen: body.InitRenO2 || '',
                precautions: body.InitRenPrec || 'As per Permit',
                req_name: body.RequesterName || '',
                req_at: getNowIST(),
                worker_list: Array.isArray(workers) ? workers.map(w => w.Name) : []
            });
        }

        const data = { ...body, SelectedWorkers: workers, PermitID: pid, CreatedDate: getNowIST(), GSR_Accepted: body.GSR_Accepted || 'Y' };
        
        // 4. Database Operation
        // Helper to handle nulls
        const cleanGeo = (val) => (!val || String(val).trim() === '') ? null : String(val);

        const chk = await pool.request().input('p', sql.NVarChar, pid).query("SELECT Status FROM Permits WHERE PermitID=@p");
        
        const q = pool.request()
            .input('p', sql.NVarChar(50), pid)
            .input('s', sql.NVarChar(50), 'Pending Review')
            .input('w', sql.NVarChar(50), body.WorkType || '')
            .input('re', sql.NVarChar(100), body.RequesterEmail || '')
            .input('rv', sql.NVarChar(100), body.ReviewerEmail || '')
            .input('ap', sql.NVarChar(100), body.ApproverEmail || '')
            .input('vf', sql.DateTime, vf)
            .input('vt', sql.DateTime, vt)
            .input('lat', sql.NVarChar(50), cleanGeo(body.Latitude))
            .input('lng', sql.NVarChar(50), cleanGeo(body.Longitude))
            .input('j', sql.NVarChar(sql.MAX), JSON.stringify(data))
            .input('ren', sql.NVarChar(sql.MAX), JSON.stringify(renewalsArr));

        if (chk.recordset.length > 0) {
            await q.query("UPDATE Permits SET FullDataJSON=@j, WorkType=@w, ValidFrom=@vf, ValidTo=@vt, Latitude=@lat, Longitude=@lng WHERE PermitID=@p");
        } else {
            await q.query("INSERT INTO Permits (PermitID, Status, WorkType, RequesterEmail, ReviewerEmail, ApproverEmail, ValidFrom, ValidTo, Latitude, Longitude, FullDataJSON, RenewalsJSON) VALUES (@p, @s, @w, @re, @rv, @ap, @vf, @vt, @lat, @lng, @j, @ren)");
        }

        context.res = { body: { success: true, permitId: pid } };

    } catch (e) {
        context.log.error(e);
        context.res = { status: 500, body: { error: e.message } };
    }
};